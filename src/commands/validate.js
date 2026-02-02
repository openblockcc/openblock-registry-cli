/**
 * Validate command
 * Validates a plugin without publishing
 */

const chalk = require('chalk');
const ora = require('ora');

const validatePackageJson = require('../validators/package-json');
const validateGitStatus = require('../validators/git-status');
const validateRequiredFiles = require('../validators/required-files');
const validateRemoteRepo = require('../validators/remote-repo');
const {validateIdUniqueness} = require('../validators/id-uniqueness');
const validatePackageStructure = require('../validators/package-structure');
const validateTranslations = require('../validators/translations');
const logger = require('../utils/logger');

// GitHub URL pattern: https://github.com/owner/repo
const GITHUB_URL_PATTERN = /^https:\/\/github\.com\/[^/]+\/[^/]+$/;

/**
 * Extract clean GitHub URL from repository info
 * @param {object|string} repository - Repository info from package.json
 * @param {object} repoInfo - Repository info from GitHub API
 * @returns {string} Clean GitHub URL
 */
const getGitHubUrl = (repository, repoInfo) => {
    // Prefer repoInfo from GitHub API
    if (repoInfo && repoInfo.html_url) {
        return repoInfo.html_url;
    }

    // Fallback to package.json repository
    if (repository) {
        let url = typeof repository === 'string' ? repository : repository.url;
        if (url) {
            // Remove .git suffix and git+ prefix
            url = url.replace(/\.git$/, '').replace(/^git\+/, '');
            return url;
        }
    }

    return '';
};

/**
 * Execute validate command
 * @param {object} options - Validation options
 * @param {boolean} options.silent - If true, don't print summary messages
 * @param {boolean} options.skipTag - If true, skip Git tag validation
 * @returns {object} Validation result with packageInfo, repoInfo, repoUrl
 */
const validate = async function (options = {}) {
    if (!options.silent) {
        console.log(chalk.cyan('\nOpenBlock Plugin Validator\n'));
    }

    const spinner = ora();

    try {
        // 1. Validate package.json
        spinner.start('Checking package.json...');
        const packageInfo = await validatePackageJson();
        spinner.succeed(`package.json validated: ${chalk.green(packageInfo.openblock.id)} v${packageInfo.version}`);

        // 2. Validate Git status (skip if --skip-tag is set)
        if (options.skipTag) {
            spinner.info('Git tag validation skipped (--skip-tag)');
        } else {
            spinner.start('Checking Git status...');
            await validateGitStatus(packageInfo.version);
            spinner.succeed(`Git tag ${chalk.green(packageInfo.version)} exists and pushed`);
        }

        // 3. Validate required files
        spinner.start('Validating required files...');
        await validateRequiredFiles();
        spinner.succeed('Required files validated');

        // 4. Validate remote repository
        spinner.start('Checking remote repository...');
        const repoInfo = await validateRemoteRepo(packageInfo.repository);
        spinner.succeed('Remote repository accessible');

        // 5. Validate GitHub URL format
        spinner.start('Validating GitHub URL...');
        const repoUrl = getGitHubUrl(packageInfo.repository, repoInfo);
        if (!repoUrl || !GITHUB_URL_PATTERN.test(repoUrl)) {
            throw new Error(
                'Repository must be a valid GitHub URL.\n' +
                '   Expected format: https://github.com/owner/repo\n' +
                `   Got: ${repoUrl || '(empty)'}`
            );
        }
        spinner.succeed(`GitHub URL: ${chalk.green(repoUrl)}`);

        // 6. Check plugin ID uniqueness
        spinner.start('Checking plugin ID uniqueness...');
        const idCheckResult = await validateIdUniqueness(packageInfo, repoInfo);
        if (idCheckResult.isNew) {
            spinner.succeed(`Plugin ID ${chalk.green(packageInfo.openblock.id)} is available`);
        } else {
            spinner.succeed(`Plugin ID ${chalk.green(packageInfo.openblock.id)} exists (updating)`);
        }

        // 7. Validate package.json structure
        spinner.start('Validating package.json structure...');
        const structureResult = validatePackageStructure(packageInfo);
        if (!structureResult.valid) {
            spinner.fail('Package.json structure validation failed');
            console.log(chalk.red('\nStructure validation errors:'));
            structureResult.errors.forEach(error => {
                console.log(chalk.red(`   ✗ ${error}`));
            });
            throw new Error('Package.json structure validation failed');
        }
        spinner.succeed('Package.json structure validated');

        // 8. Validate translations
        spinner.start('Validating translations...');
        const translationsResult = validateTranslations(packageInfo);
        if (!translationsResult.valid) {
            spinner.fail('Translations validation failed');
            console.log(chalk.red('\nTranslations validation errors:'));
            translationsResult.errors.forEach(error => {
                console.log(chalk.red(`   ✗ ${error}`));
            });
            throw new Error('Translations validation failed');
        }
        spinner.succeed('Translations validated');

        // Summary
        if (!options.silent) {
            console.log(chalk.green('\n[OK] All validations passed!\n'));
            console.log('   Your plugin is ready to publish.');
            console.log(`   Run ${chalk.cyan('openblock-cli publish')} to submit.\n`);
        }

        return {
            packageInfo,
            repoInfo,
            repoUrl
        };

    } catch (error) {
        spinner.fail(error.message);
        logger.error(error);
        process.exit(1);
    }
};

module.exports = validate;
