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
        spinner.start('Creating Pull Request...');
        const prResult = await createPullRequest(token, packageInfo, repoUrl);

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
