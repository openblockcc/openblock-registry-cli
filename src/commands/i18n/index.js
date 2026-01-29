/**
 * i18n command entry point
 *
 * Provides subcommands for translation management:
 * - extract: Extract formatMessage() calls from source files
 * - push: Push extracted translations to Transifex
 * - update: Pull translations from Transifex and generate translation files
 */

const path = require('path');
const {spawn} = require('child_process');

/**
 * Get the script path for a given subcommand
 * @param {string} subcommand - The subcommand name
 * @returns {string} The path to the script file
 */
const getScriptPath = subcommand => {
    const scripts = {
        extract: 'extract-format-message.js',
        push: 'push-format-message.js',
        update: 'update-translations.js'
    };
    const scriptFile = scripts[subcommand];
    if (!scriptFile) {
        return null;
    }
    return path.join(__dirname, scriptFile);
};

/**
 * Run i18n subcommand
 * @param {string} subcommand - The subcommand to run (extract/push/update)
 * @param {object} options - Command options
 */
const i18nCommand = (subcommand, options) => {
    const validSubcommands = ['extract', 'push', 'update'];

    if (!subcommand) {
        console.log('Usage: openblock-registry-cli i18n <subcommand> [options]');
        console.log('');
        console.log('Subcommands:');
        console.log('  extract   Extract formatMessage() calls from source files');
        console.log('  push      Push extracted translations to Transifex');
        console.log('  update    Pull translations and generate translation files');
        console.log('');
        console.log('Options:');
        console.log('  --dir=<path>   Working directory (default: current directory)');
        return;
    }

    if (!validSubcommands.includes(subcommand)) {
        console.error(`Error: Unknown subcommand "${subcommand}"`);
        console.error(`Valid subcommands: ${validSubcommands.join(', ')}`);
        process.exit(1);
    }

    const scriptPath = getScriptPath(subcommand);

    // Build arguments
    const args = [];
    if (options.dir) {
        args.push(`--dir=${options.dir}`);
    }

    // Run the script
    const child = spawn(process.execPath, [scriptPath, ...args], {
        stdio: 'inherit',
        env: process.env
    });

    child.on('close', code => {
        process.exit(code);
    });

    child.on('error', err => {
        console.error(`Failed to run ${subcommand}:`, err.message);
        process.exit(1);
    });
};

module.exports = i18nCommand;
