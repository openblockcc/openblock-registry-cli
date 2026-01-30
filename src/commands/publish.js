/**
 * Publish command
 * Validates and publishes a plugin to OpenBlock Registry
 */

const fs = require('fs');
const path = require('path');
const chalk = require('chalk');
const ora = require('ora');

const validatePackageJson = require('../validators/package-json');
const validateGitStatus = require('../validators/git-status');
const validateRequiredFiles = require('../validators/required-files');
const validateRemoteRepo = require('../validators/remote-repo');
const {validateIdUniqueness} = require('../validators/id-uniqueness');
const {getGitHubToken} = require('../github/auth');
const {createPullRequest} = require('../github/pr');
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
 * Execute publish command
 * @param {object} options - Command options
 * @param {boolean} options.dryRun - If true, only validate without creating PR
 */
const publish = async function (options = {}) {
    console.log(chalk.cyan(`\nOpenBlock Plugin Publisher\n`));

    const spinner = ora();

    try {
        // Determine the directory to validate and publish
        const distDir = path.join(process.cwd(), 'dist');

        // Check if dist directory exists
        if (!fs.existsSync(distDir)) {
            throw new Error(
                'dist directory not found.\n' +
                '   Please build your plugin first using: npm run build'
            );
        }

        // 1. Validate package.json in dist directory
        spinner.start('Checking package.json...');
        const packageInfo = await validatePackageJson(distDir);
        spinner.succeed(`package.json validated: ${chalk.green(packageInfo.openblock.id)} v${packageInfo.version}`);

        // 2. Validate Git status (uses current directory for git operations)
        spinner.start('Checking Git status...');
        await validateGitStatus(packageInfo.version);
        spinner.succeed(`Git tag ${chalk.green(packageInfo.version)} exists and pushed`);

        // 3. Validate required files in dist directory
        spinner.start('Validating plugin structure...');
        await validateRequiredFiles(distDir);
        spinner.succeed('Required files validated');

        // 4. Validate remote repository
        spinner.start('Checking remote repository...');
        const repoInfo = await validateRemoteRepo(packageInfo.repository);
        spinner.succeed('Remote repository accessible');

        // 5. Validate GitHub URL
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

        // 6. Check plugin ID uniqueness (against R2 packages.json)
        spinner.start('Checking plugin ID uniqueness...');
        const idCheckResult = await validateIdUniqueness(packageInfo, repoInfo);
        if (idCheckResult.isNew) {
            spinner.succeed(`Plugin ID ${chalk.green(packageInfo.openblock.id)} is available`);
        } else {
            spinner.succeed(`Plugin ID ${chalk.green(packageInfo.openblock.id)} exists (updating)`);
        }

        if (options.dryRun) {
            console.log(chalk.green('\n[OK] Validation passed! (dry-run mode, PR not created)\n'));
            return;
        }

        // 7. Get GitHub token
        const token = await getGitHubToken();

        // 8. Create or Update Pull Request
        spinner.start('Creating Pull Request...');
        const prResult = await createPullRequest(token, packageInfo, repoUrl);

        if (prResult.isUpdate) {
            spinner.succeed('Existing Pull Request updated');
        } else {
            spinner.succeed('Pull Request created');
        }

        // Success message
        console.log(chalk.green('\n[OK] Submission successful!\n'));
        console.log(`   PR will be automatically validated.`);
        console.log(`   After validation, wait for maintainer review.`);
        console.log(`   Once merged, your plugin will be available in ~10 minutes.\n`);
        console.log(`   ${chalk.cyan('View PR:')} ${prResult.url}\n`);

    } catch (error) {
        spinner.fail(error.message);
        logger.error(error);
        process.exit(1);
    }
};

module.exports = publish;
