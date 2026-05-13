#!/usr/bin/env node

/**
 * @fileoverview
 * Extract i18n content from a single plugin resource.
 *
 * Extraction sources:
 * 1. package.json - any {formatMessage:{id,default}} occurrence under `openblock`
 *    (e.g. name, description, firmwares[].name, ...)
 * 2. main - formatMessage() calls in extension/device source files
 * 3. msg - Block message definitions
 *
 * Output files:
 * - .translations/interface/en.json
 * - .translations/extensions/en.json
 * - .translations/blocks/en.json
 *
 * Usage:
 *   node extract-format-message.js [--dir=path/to/plugin]
 */

const fs = require('fs-extra');
const path = require('path');

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

// ============================================================================
// Utilities
// ============================================================================

/**
 * Parse formatMessage({id, default}) calls from JS content
 * @param {string} content - JavaScript source code content
 * @returns {Array<{id: string, default: string}>} Array of extracted messages
 */
const extractFormatMessages = content => {
    const messages = [];
    const regex = /formatMessage\s*\(\s*\{([^}]+)\}\s*\)/g;
    let match;

    while ((match = regex.exec(content)) !== null) {
        try {
            // Extract the object content and parse it
            const objContent = `{${match[1]}}`;
            // Convert single quotes to double quotes and handle keys
            const normalized = objContent
                .replace(/'/g, '"')
                .replace(/(\w+):/g, '"$1":');
            const parsed = JSON.parse(normalized);

            if (parsed.id && parsed.default) {
                messages.push({
                    id: parsed.id,
                    default: parsed.default
                });
            }
        } catch (e) {
            console.warn(`Failed to parse formatMessage: ${match[0]}`);
        }
    }
    return messages;
};


/**
 * Recursively walk a value and collect every {formatMessage:{id,default}}.
 * Mirrors the runtime-side recursive resolver in distro-vm so that any
 * {formatMessage} placed anywhere under `openblock` gets picked up here.
 * @param {*} value - Value to walk (object/array/primitive)
 * @param {Array<{id: string, default: string}>} out - Sink to push extracted entries
 */
const collectFormatMessages = (value, out) => {
    if (!value || typeof value !== 'object') return;
    if (value.formatMessage && typeof value.formatMessage === 'object') {
        const fm = value.formatMessage;
        if (typeof fm.id === 'string' && typeof fm.default === 'string') {
            out.push({id: fm.id, default: fm.default});
        }
        return;
    }
    if (Array.isArray(value)) {
        value.forEach(item => collectFormatMessages(item, out));
        return;
    }
    Object.values(value).forEach(v => collectFormatMessages(v, out));
};


// ============================================================================
// Resource Scanners
// ============================================================================

/**
 * Scan a single plugin directory
 * @param {string} pluginDir - Path to the plugin directory
 * @returns {{interface: Array, extensions: Array, blocks: object}} Extracted translation data
 */
const scanPlugin = pluginDir => {
    const result = {
        interface: [],
        extensions: [],
        blocks: {}
    };

    // 1. Extract from package.json
    const packageJsonPath = path.join(pluginDir, 'package.json');
    if (fs.existsSync(packageJsonPath)) {
        try {
            const pkg = fs.readJsonSync(packageJsonPath);
            const openblock = pkg.openblock;

            if (openblock) {
                collectFormatMessages(openblock, result.interface);
            }
        } catch (e) {
            console.error(`Failed to parse ${packageJsonPath}:`, e.message);
        }
    }

    // 2. Extract from main and msg (using paths from package.json)
    if (packageJsonPath && fs.existsSync(packageJsonPath)) {
        try {
            const pkg = fs.readJsonSync(packageJsonPath);
            const openblock = pkg.openblock;

            // Extract from main (for extensions)
            if (openblock?.main) {
                const mainJsPath = openblock.main;
                const fullMainPath = path.join(pluginDir, mainJsPath);
                if (fs.existsSync(fullMainPath)) {
                    const content = fs.readFileSync(fullMainPath, 'utf8');
                    result.extensions.push(...extractFormatMessages(content));
                }
            }

            // Extract from frameworks array (for devices)
            // Each framework has a main field pointing to a source file
            if (openblock?.frameworks && Array.isArray(openblock.frameworks)) {
                for (const framework of openblock.frameworks) {
                    if (framework.main) {
                        const mainJsPath = framework.main;
                        const fullMainPath = path.join(pluginDir, mainJsPath);
                        if (fs.existsSync(fullMainPath)) {
                            const content = fs.readFileSync(fullMainPath, 'utf8');
                            result.extensions.push(...extractFormatMessages(content));
                        }
                    }
                }
            }

            // Extract from msg
            if (openblock?.msg) {
                const msgJsonPath = path.join(pluginDir, openblock.msg);
                if (fs.existsSync(msgJsonPath)) {
                    try {
                        const msgJson = fs.readJsonSync(msgJsonPath);
                        Object.assign(result.blocks, msgJson);
                    } catch (e) {
                        console.error(`Failed to parse ${msgJsonPath}:`, e.message);
                    }
                }
            }
        } catch (e) {
            // Already logged in step 1
        }
    }

    return result;
};

// ============================================================================
// Main
// ============================================================================

/**
 * Main function to extract translations and write to files
 */
const main = () => {
    const {dir} = parseArgs();
    const workDir = path.resolve(dir || './');

    console.log(`Working directory: ${workDir}\n`);
    console.log(`Extracting translations from: ${workDir}\n`);

    const result = scanPlugin(workDir);
    const totalKeys = result.interface.length + result.extensions.length + Object.keys(result.blocks).length;

    if (totalKeys === 0) {
        console.log('⚠ No translation keys found\n');
        return;
    }

    // Convert arrays to objects
    const results = {
        interface: {},
        extensions: {},
        blocks: result.blocks
    };

    // Convert interface array to object
    result.interface.forEach(msg => {
        results.interface[msg.id] = {
            message: msg.default,
            description: msg.default
        };
    });

    // Convert extensions array to object
    result.extensions.forEach(msg => {
        results.extensions[msg.id] = {
            message: msg.default,
            description: msg.default
        };
    });

    // Write interface translations
    const interfacePath = path.join(workDir, '.translations/interface/en.json');
    fs.ensureDirSync(path.dirname(interfacePath));
    fs.writeJsonSync(interfacePath, results.interface, {spaces: 4});
    console.log(`\n✓ Interface translations: ${interfacePath}`);
    console.log(`  ${Object.keys(results.interface).length} messages`);

    // Write extension translations
    const extensionsPath = path.join(workDir, '.translations/extensions/en.json');
    fs.ensureDirSync(path.dirname(extensionsPath));
    fs.writeJsonSync(extensionsPath, results.extensions, {spaces: 4});
    console.log(`\n✓ Extension translations: ${extensionsPath}`);
    console.log(`  ${Object.keys(results.extensions).length} messages`);

    // Write block translations
    const blocksPath = path.join(workDir, '.translations/blocks/en.json');
    fs.ensureDirSync(path.dirname(blocksPath));
    fs.writeJsonSync(blocksPath, results.blocks, {spaces: 4});
    console.log(`\n✓ Block translations: ${blocksPath}`);
    console.log(`  ${Object.keys(results.blocks).length} messages`);

    console.log('\n✓ Extraction complete!');
};

main();
