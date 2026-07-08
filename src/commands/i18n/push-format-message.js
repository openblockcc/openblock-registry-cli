#!/usr/bin/env node

/**
 * @fileoverview
 * Push extracted i18n content to Transifex.
 *
 * Pushes the following translation files to Transifex:
 * - .translations/interface/en.json → openblock-resources/interface
 * - .translations/extensions/en.json → openblock-resources/extensions
 * - .translations/blocks/en.json → openblock-resources/blocks
 *
 * Usage:
 *   node push-format-message.js [--dir=path/to/resources]
 */

const {execFileSync} = require('child_process');
const path = require('path');
const fs = require('fs');

// ============================================================================
// Utilities
// ============================================================================

/**
 * Parse command line arguments
 * @returns {object} Parsed arguments
 */
const parseArgs = () => {
    const args = {};
    process.argv.slice(2).forEach(arg => {
        if (arg.startsWith('--')) {
            const [key, value] = arg.slice(2).split('=');
            args[key] = value || true;
        }
    });
    return args;
};

/**
 * Resolve openblock-l10n's `tx-push-src` bin to an absolute script path. It is
 * invoked directly with the current Node binary rather than as a bare command,
 * so it does not rely on $PATH or node_modules/.bin being set up — which they are
 * not when this CLI is launched by absolute path from a plain `node` process.
 * @returns {string} Absolute path to the tx-push-src script
 */
const resolveTxPushSrcBin = () => {
    const pkgJsonPath = require.resolve('openblock-l10n/package.json');
    const {bin} = require(pkgJsonPath);
    const binRel = typeof bin === 'string' ? bin : bin && bin['tx-push-src'];
    if (!binRel) {
        throw new Error('openblock-l10n does not expose a tx-push-src bin');
    }
    return path.resolve(path.dirname(pkgJsonPath), binRel);
};

/**
 * Run tx-push-src with the current Node binary and explicit args (no shell, no
 * $PATH lookup, and no argument splitting on spaces in file paths).
 * @param {string} binPath - Absolute path to the tx-push-src script
 * @param {string[]} args - Arguments passed to tx-push-src
 * @returns {boolean} True if successful, false otherwise
 */
const runTxPushSrc = (binPath, args) => {
    try {
        const output = execFileSync(process.execPath, [binPath, ...args], {encoding: 'utf8'});
        if (output) {
            console.log(output);
        }
        return true;
    } catch (error) {
        console.error(`Error executing: tx-push-src ${args.join(' ')}`);
        console.error(error.message);
        return false;
    }
};

// ============================================================================
// Main
// ============================================================================

/**
 * Main function to push translations to Transifex
 */
const main = () => {
    const {dir} = parseArgs();
    const workDir = dir || './';
    const workDirResolved = path.resolve(workDir);

    console.log(`Pushing translations from: ${workDirResolved}\n`);

    // Define translation resources to push
    const resources = [
        {
            name: 'interface',
            file: path.join(workDirResolved, '.translations/interface/en.json')
        },
        {
            name: 'extensions',
            file: path.join(workDirResolved, '.translations/extensions/en.json')
        },
        {
            name: 'blocks',
            file: path.join(workDirResolved, '.translations/blocks/en.json')
        }
    ];

    // Validate files exist
    const missingFiles = resources.filter(r => !fs.existsSync(r.file));
    if (missingFiles.length > 0) {
        console.error('Error: Missing translation files:');
        missingFiles.forEach(r => console.error(`  - ${r.file}`));
        process.exit(1);
    }

    // Push each resource to Transifex
    const txPushSrcBin = resolveTxPushSrcBin();
    let allSuccess = true;
    for (const resource of resources) {
        console.log(`Pushing ${resource.name}...`);
        const success = runTxPushSrc(txPushSrcBin, ['openblock-resources', resource.name, resource.file]);

        if (success) {
            console.log(`✓ ${resource.name} pushed successfully\n`);
        } else {
            console.error(`✗ Failed to push ${resource.name}\n`);
            allSuccess = false;
        }
    }

    // Final status
    if (allSuccess) {
        console.log('✓ All translations pushed to Transifex successfully!');
        process.exit(0);
    } else {
        console.error('✗ Some translations failed to push');
        process.exit(1);
    }
};

main();
