/**
 * Info command
 * Shows information about published plugin versions
 */

const chalk = require('chalk');
const ora = require('ora');
const fetch = require('node-fetch');

const logger = require('../utils/logger');
const validatePackageJson = require('../validators/package-json');

const REGISTRY_URL = 'https://registry.openblock.cc/packages.json';

/**
 * Execute info command
 * @param {object} options - Command options
 * @param {boolean} options.all - Show all versions
 */
const info = async function (options = {}) {
    console.log(chalk.cyan('\nOpenBlock Plugin Info\n'));

    const spinner = ora();

    try {
        // Validate and read package.json (this normalizes deviceId/extensionId to id)
        const packageJson = await validatePackageJson();
        const openblock = packageJson.openblock;

        console.log(`   ${chalk.bold('Local package:')} ${openblock.id}`);
        console.log(`   ${chalk.bold('Local version:')} ${packageJson.version}\n`);

        // Fetch registry
        spinner.start('Fetching registry...');
        const response = await fetch(REGISTRY_URL);

        if (!response.ok) {
            throw new Error(`Failed to fetch registry: ${response.status}`);
        }

        const registry = await response.json();
        spinner.succeed('Registry fetched');

        // Find package in registry
        const packageType = `${openblock.pluginType}s`; // device -> devices, extension -> extensions
        const packages = registry.packages[packageType] || [];

        // The registry structure is a flat array where each entry is a version
        // Filter all entries that match our plugin ID
        const idField = openblock.pluginType === 'device' ? 'deviceId' : 'extensionId';
        const matchingVersions = packages.filter(p => p[idField] === openblock.id);

        if (matchingVersions.length === 0) {
            console.log(chalk.yellow('\n[WARN] Package not found in registry'));
            console.log(`   This package has not been published yet.\n`);
            return;
        }

        // Get the first entry for name and other metadata
        const firstEntry = matchingVersions[0];

        // Display versions
        console.log(chalk.green(`\n[OK] Found in registry: ${firstEntry.name}\n`));
        console.log(`   ${chalk.bold('Published versions:')}`);

        const versionsToShow = options.all ? matchingVersions : matchingVersions.slice(0, 5);
        versionsToShow.forEach(v => {
            const isCurrent = v.version === packageJson.version;
            const marker = isCurrent ? chalk.green(' (current)') : '';
            console.log(`   - ${v.version}${marker}`);
        });

        if (!options.all && matchingVersions.length > 5) {
            console.log(`   ... and ${matchingVersions.length - 5} more (use --all to see all)`);
        }

        console.log('');

    } catch (error) {
        spinner.fail(error.message);
        logger.error(error);
        process.exit(1);
    }
};

module.exports = info;
