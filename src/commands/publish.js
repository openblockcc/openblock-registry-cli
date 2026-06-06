/**
 * Publish command
 * Validates and publishes a plugin to OpenBlock Registry
 */

const chalk = require('chalk');
const ora = require('ora');

const validate = require('./validate');
const {getGitHubToken} = require('../github/auth');
const {createPullRequest} = require('../github/pr');
const {resolveApprovedPlan} = require('../lib/approved-baseline');
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

        // 2. Resolve the display-freeze baseline. A display change (name, icon,
        //    description, ...) needs a reviewed PR updating approved/{id}.json;
        //    a pure functional update leaves the baseline untouched.
        spinner.start('Checking display baseline...');
        const approvedPlan = await resolveApprovedPlan(packageInfo, repoUrl, process.cwd());
        if (approvedPlan.needsUpdate) {
            spinner.info('Display fields changed - a baseline review PR will be opened');
        } else {
            spinner.succeed('Display baseline unchanged');
        }

        // 3. Get GitHub token
        const token = await getGitHubToken();

        // 4. Create or Update Pull Request
        spinner.start('Submitting to OpenBlock Registry...');
        const prResult = await createPullRequest(token, packageInfo, repoUrl, approvedPlan);

        // Nothing changed: the repo is already registered and its display is
        // unchanged. New code versions sync automatically from git tags, so no PR
        // is needed.
        if (prResult.skipped) {
            spinner.info('This repository is already registered');
            console.log(chalk.green('\n[OK] Nothing to submit.\n'));
            console.log('   Your repository is already in the registry and its display is unchanged,');
            console.log('   so no pull request is needed.');
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
