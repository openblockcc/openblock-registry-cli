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
const logger = require('../utils/logger');

/**
 * Execute validate command
 */
const validate = async function () {
    console.log(chalk.cyan('\nOpenBlock Plugin Validator\n'));

    const spinner = ora();
    const results = [];

    try {
        // 1. Validate package.json
        spinner.start('Checking package.json...');
        const packageInfo = await validatePackageJson();
        spinner.succeed(`package.json: ${chalk.green('OK')}`);
        results.push({name: 'package.json', status: 'pass', info: packageInfo});

        // 2. Validate Git status
        spinner.start('Checking Git status...');
        const gitInfo = await validateGitStatus(packageInfo.version);
        spinner.succeed(`Git status: ${chalk.green('OK')}`);
        results.push({name: 'git-status', status: 'pass', info: gitInfo});

        // 3. Validate required files
        spinner.start('Validating required files...');
        const filesInfo = await validateRequiredFiles();
        spinner.succeed(`Required files: ${chalk.green('OK')}`);
        results.push({name: 'required-files', status: 'pass', info: filesInfo});

        // 4. Validate remote repository
        spinner.start('Checking remote repository...');
        await validateRemoteRepo(packageInfo.repository);
        spinner.succeed(`Remote repository: ${chalk.green('OK')}`);
        results.push({name: 'remote-repo', status: 'pass'});

        // Summary
        console.log(chalk.green('\n[OK] All validations passed!\n'));
        console.log('   Your plugin is ready to publish.');
        console.log(`   Run ${chalk.cyan('openblock-cli publish')} to submit.\n`);

        return results;

    } catch (error) {
        spinner.fail(error.message);
        logger.error(error);
        process.exit(1);
    }
};

module.exports = validate;
