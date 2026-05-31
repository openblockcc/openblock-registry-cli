/**
 * Publish command
 * Validates and publishes a plugin to OpenBlock Registry
 */

const chalk = require('chalk');
const ora = require('ora');

const validate = require('./validate');
const {getGitHubToken} = require('../github/auth');
const {createPullRequest} = require('../github/pr');
const logger = require('../utils/logger');

/**
 * Execute publish command
 * @param {object} options - Command options
 * @param {boolean} options.dryRun - If true, only validate without creating PR
 */
const publish = async function (options = {}) {
    console.log(chalk.cyan('\nOpenBlock Plugin Publisher\n'));

    const spinner = ora();

    try {
        // 1. Run all validations (same as validate command)
        const {packageInfo, repoUrl} = await validate({silent: true});

        if (options.dryRun) {
            console.log(chalk.green('\n[OK] Validation passed! (dry-run mode, PR not created)\n'));
            return;
        }

        // 2. Get GitHub token
        const token = await getGitHubToken();

        // 3. Create or Update Pull Request
        spinner.start('Submitting to OpenBlock Registry...');
        const prResult = await createPullRequest(token, packageInfo, repoUrl);

        // Already registered: the registry only tracks repository URLs, and new
        // versions are synced automatically from git tags. Re-submitting would
        // only open an empty PR, so skip it and tell the user what to do instead.
        if (prResult.skipped) {
            spinner.info('This repository is already registered');
            console.log(chalk.green('\n[OK] Nothing to submit.\n'));
            console.log('   Your repository is already in the registry, so no pull request is needed.');
            console.log('   To publish a new version, push a new X.Y.Z git tag to your repository -');
            console.log('   it will be picked up automatically during the next daily scan.\n');
            return;
        }

        if (prResult.isUpdate) {
            spinner.succeed('Existing Pull Request updated');
        } else {
            spinner.succeed('Pull Request created');
        }

        // Success message
        console.log(chalk.green('\n[OK] Submission successful!\n'));
        console.log('   PR will be automatically validated.');
        console.log('   After validation, wait for maintainer review.');
        console.log('   Once merged, your plugin will be processed during the next daily scan.\n');
        console.log(`   ${chalk.cyan('View PR:')} ${prResult.url}\n`);

    } catch (error) {
        spinner.fail(error.message);
        logger.error(error);
        process.exit(1);
    }
};

module.exports = publish;
