/**
 * Publish command
 * Validates and publishes a plugin to OpenBlock Registry
 */

const chalk = require('chalk');
const ora = require('ora');
const pkg = require('../../package.json');

const validatePackageJson = require('../validators/package-json');
const validateGitStatus = require('../validators/git-status');
const validateRequiredFiles = require('../validators/required-files');
const validateRemoteRepo = require('../validators/remote-repo');
const {validateIdUniqueness} = require('../validators/id-uniqueness');
const {processLibrariesForPublish} = require('../lib/library-processor');
const {getGitHubToken} = require('../github/auth');
const {createPullRequest} = require('../github/pr');
const logger = require('../utils/logger');

/**
 * Execute publish command
 * @param {object} options - Command options
 * @param {boolean} options.dryRun - If true, only validate without creating PR
 */
const publish = async function (options = {}) {
    console.log(chalk.cyan(`\n🚀 OpenBlock Plugin Publisher v${pkg.version}\n`));

    const spinner = ora();

    try {
        // 1. Validate package.json
        spinner.start('Checking package.json...');
        const packageInfo = await validatePackageJson();
        spinner.succeed(`package.json validated: ${chalk.green(packageInfo.openblock.id)} v${packageInfo.version}`);

        // 2. Validate Git status
        spinner.start('Checking Git status...');
        const gitInfo = await validateGitStatus(packageInfo.version);
        spinner.succeed(`Git tag ${chalk.green(`v${packageInfo.version}`)} exists and pushed`);

        // 3. Validate required files
        spinner.start('Validating plugin structure...');
        await validateRequiredFiles();
        spinner.succeed('Required files validated');

        // 4. Validate remote repository
        spinner.start('Checking remote repository...');
        const repoInfo = await validateRemoteRepo(packageInfo.repository);
        spinner.succeed('Remote repository accessible');

        // 5. Check plugin ID uniqueness
        spinner.start('Checking plugin ID uniqueness...');
        const idCheckResult = await validateIdUniqueness(packageInfo, repoInfo);
        if (idCheckResult.isNew) {
            spinner.succeed(`Plugin ID ${chalk.green(packageInfo.openblock.id)} is available`);
        } else {
            spinner.succeed(`Plugin ID ${chalk.green(packageInfo.openblock.id)} exists (updating)`);
        }

        // 6. Process libraries
        spinner.start('Processing libraries...');
        const libraryResult = await processLibrariesForPublish(process.cwd());
        const libMsg = `${libraryResult.extracted.length} shared, ${libraryResult.kept.length} kept`;
        spinner.succeed(`Libraries processed: ${libMsg}`);

        // Show warnings if any
        if (libraryResult.warnings.length > 0) {
            libraryResult.warnings.forEach(warning => {
                console.log(chalk.yellow(`   ${warning}`));
            });
        }

        // Merge library dependencies into packageInfo
        if (Object.keys(libraryResult.dependencies.libraries).length > 0) {
            packageInfo.dependencies = packageInfo.dependencies || {};
            packageInfo.dependencies.libraries = libraryResult.dependencies.libraries;
        }

        if (options.dryRun) {
            console.log(chalk.green('\n✅ Validation passed! (dry-run mode, PR not created)\n'));
            return;
        }

        // 8. Get GitHub token
        const token = await getGitHubToken();

        // 9. Create Pull Request
        spinner.start('Creating Pull Request...');
        const prUrl = await createPullRequest(
            token, packageInfo, gitInfo, repoInfo, idCheckResult
        );
        spinner.succeed('Pull Request created');

        // Success message
        console.log(chalk.green('\n🎉 Submission successful!\n'));
        console.log(`   PR will be automatically validated.`);
        console.log(`   After validation, wait for maintainer review.`);
        console.log(`   Once merged, your plugin will be available in ~10 minutes.\n`);
        console.log(`   ${chalk.cyan('View PR:')} ${prUrl}\n`);

    } catch (error) {
        spinner.fail(error.message);
        logger.error(error);
        process.exit(1);
    }
};

module.exports = publish;
