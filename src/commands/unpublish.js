/**
 * Unpublish command
 * Removes a published version from the registry
 */

const chalk = require('chalk');
const ora = require('ora');
const inquirer = require('inquirer');
const path = require('path');
const fs = require('fs');

const {getGitHubToken} = require('../github/auth');
const {createUnpublishPR} = require('../github/pr');
const logger = require('../utils/logger');

/**
 * Execute unpublish command
 * @param {string} version - Version to unpublish
 */
const unpublish = async function (version) {
    console.log(chalk.cyan('\nOpenBlock Plugin Unpublish\n'));

    const spinner = ora();

    try {
        // Read local package.json
        const packageJsonPath = path.join(process.cwd(), 'package.json');
        if (!fs.existsSync(packageJsonPath)) {
            throw new Error('package.json not found in current directory');
        }

        const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf-8'));
        const openblock = packageJson.openblock;

        if (!openblock || !openblock.id) {
            throw new Error('No openblock.id found in package.json');
        }

        // Use current version if not specified
        const targetVersion = version || packageJson.version;

        console.log(`   ${chalk.bold('Package:')} ${openblock.id}`);
        console.log(`   ${chalk.bold('Version to remove:')} ${targetVersion}\n`);

        // Confirm
        const {confirmed} = await inquirer.prompt([
            {
                type: 'confirm',
                name: 'confirmed',
                message: chalk.yellow(`Are you sure you want to unpublish ${openblock.id}@${targetVersion}?`),
                default: false
            }
        ]);

        if (!confirmed) {
            console.log(chalk.gray('\nUnpublish cancelled.\n'));
            return;
        }

        // Get GitHub token
        const token = await getGitHubToken();

        // Create unpublish PR
        spinner.start('Creating unpublish Pull Request...');
        const prUrl = await createUnpublishPR(token, openblock.id, targetVersion);
        spinner.succeed('Unpublish PR created');

        console.log(chalk.green('\n[OK] Unpublish request submitted!\n'));
        console.log(`   A PR has been created to remove version ${targetVersion}.`);
        console.log(`   Wait for maintainer review and approval.\n`);
        console.log(`   ${chalk.cyan('View PR:')} ${prUrl}\n`);

    } catch (error) {
        spinner.fail(error.message);
        logger.error(error);
        process.exit(1);
    }
};

module.exports = unpublish;
