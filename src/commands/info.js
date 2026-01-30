/**
 * Info command
 * Shows information about published plugin versions
 */

const chalk = require('chalk');
const ora = require('ora');
const path = require('path');
const fs = require('fs');
const fetch = require('node-fetch');

const logger = require('../utils/logger');

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
        const packageType = `${openblock.type}s`; // device -> devices
        const packages = registry.packages[packageType] || [];
        const pkg = packages.find(p => p.id === openblock.id);

        if (!pkg) {
            console.log(chalk.yellow('\n[WARN] Package not found in registry'));
            console.log(`   This package has not been published yet.\n`);
            return;
        }

        // Display versions
        console.log(chalk.green(`\n[OK] Found in registry: ${pkg.name}\n`));
        console.log(`   ${chalk.bold('Published versions:')}`);

        const versions = options.all ? pkg.versions : pkg.versions.slice(0, 5);
        versions.forEach(v => {
            const isCurrent = v.version === packageJson.version;
            const marker = isCurrent ? chalk.green(' (current)') : '';
            console.log(`   - ${v.version} (${v.releaseDate})${marker}`);
        });

        if (!options.all && pkg.versions.length > 5) {
            console.log(`   ... and ${pkg.versions.length - 5} more (use --all to see all)`);
        }

        console.log('');

    } catch (error) {
        spinner.fail(error.message);
        logger.error(error);
        process.exit(1);
    }
};

module.exports = info;
