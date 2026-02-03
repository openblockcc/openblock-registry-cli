#!/usr/bin/env node

/**
 * @fileoverview
 * Generate translation files for a single plugin resource.
 *
 * Workflow:
 * 1. Extract translation keys from plugin source files
 * 2. Merge with existing translations (preserving manual translations)
 * 3. Generate src/translations.js for the plugin (ESM format)
 *
 * Usage:
 *   node update-translations.js [--dir=path/to/plugin]
 */

const fs = require('fs-extra');
const path = require('path');
const locales = require('openblock-l10n').default;

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
            const objContent = `{${match[1]}}`;
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
            // Ignore parse errors
        }
    }
    return messages;
};

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
 * Read package.json from plugin directory
 * @param {string} pluginDir - Plugin directory path
 * @returns {object|null} Package.json content or null
 */
const readPackageJson = pluginDir => {
    const packagePath = path.join(pluginDir, 'package.json');
    if (!fs.existsSync(packagePath)) {
        return null;
    }
    return fs.readJsonSync(packagePath);
};

/**
 * Extract translation keys from plugin
 * @param {string} pluginDir - Plugin directory path
 * @returns {object} Translation keys organized by type
 */
const extractPluginKeys = pluginDir => {
    const keys = {
        interface: [],
        extensions: [],
        blocks: []
    };

    const pkg = readPackageJson(pluginDir);
    if (!pkg || !pkg.openblock) {
        return keys;
    }

    const openblock = pkg.openblock;

    // 1. Extract interface keys from name and description
    // Only extract if openblock.name/description contains formatMessage
    // Skip if it's a plain string (handled by runtime directly)

    // Extract name key - only if it has formatMessage
    if (openblock.name && typeof openblock.name === 'object' && openblock.name.formatMessage) {
        keys.interface.push(openblock.name.formatMessage.id);
    }
    // If openblock.name is a plain string, skip it (no extraction needed)

    // Extract description key - only if it has formatMessage
    if (openblock.description && typeof openblock.description === 'object' && openblock.description.formatMessage) {
        keys.interface.push(openblock.description.formatMessage.id);
    }
    // If openblock.description is a plain string, skip it (no extraction needed)

    // 2. Extract extension keys from source files (main.js for extensions)
    if (openblock.main) {
        const mainJsPath = openblock.main;
        const fullMainPath = path.join(pluginDir, mainJsPath);
        if (fs.existsSync(fullMainPath)) {
            try {
                const content = fs.readFileSync(fullMainPath, 'utf8');
                const messages = extractFormatMessages(content);
                messages.forEach(msg => {
                    keys.extensions.push(msg.id);
                });
            } catch (e) {
                // Ignore
            }
        }
    }

    // 2b. Extract extension keys from frameworks array (for devices)
    // Each framework has a main field pointing to a source file
    if (openblock.frameworks && Array.isArray(openblock.frameworks)) {
        for (const framework of openblock.frameworks) {
            if (framework.main) {
                const mainJsPath = framework.main;
                const fullMainPath = path.join(pluginDir, mainJsPath);
                if (fs.existsSync(fullMainPath)) {
                    try {
                        const content = fs.readFileSync(fullMainPath, 'utf8');
                        const messages = extractFormatMessages(content);
                        messages.forEach(msg => {
                            keys.extensions.push(msg.id);
                        });
                    } catch (e) {
                        // Ignore
                    }
                }
            }
        }
    }

    // 3. Extract block keys from msg.json
    if (openblock.msg) {
        const msgPath = path.join(pluginDir, openblock.msg);
        if (fs.existsSync(msgPath)) {
            try {
                const msgJson = fs.readJsonSync(msgPath);
                keys.blocks = Object.keys(msgJson);
            } catch (e) {
                console.warn(`Warning: Failed to parse ${msgPath}`);
            }
        }
    }

    return keys;
};

/**
 * Parse existing translation file to extract current translations
 * @param {string} filePath - Path to existing translations.js file
 * @returns {object|null} Existing translations organized by type and locale, or null if file doesn't exist
 */
const parseExistingTranslations = filePath => {
    if (!fs.existsSync(filePath)) {
        return null;
    }

    try {
        const content = fs.readFileSync(filePath, 'utf8');
        const result = {
            interface: {},
            extensions: {},
            blocks: {}
        };

        // Try to parse new format first: export default { 'en': {...}, 'zh-cn': {...} }
        const newFormatMatch = content.match(/export\s+default\s+(\{[\s\S]*\});?\s*$/);
        if (newFormatMatch) {
            // Convert single quotes to double quotes and parse
            const jsonStr = newFormatMatch[1].replace(/'/g, '"');
            const parsed = JSON.parse(jsonStr);

            // New format puts all translations (extensions + blocks) together
            // We store them in extensions for merging purposes
            result.extensions = parsed;
            return result;
        }

        // Fall back to old format parsing
        // Extract getInterfaceTranslations
        const interfaceMatch = content.match(
            /export const getInterfaceTranslations = \(\) => \(([\s\S]*?)\);/
        );
        if (interfaceMatch) {
            // Convert single quotes to double quotes and parse
            const jsonStr = interfaceMatch[1].replace(/'/g, '"');
            result.interface = JSON.parse(jsonStr);
        }

        // Extract registerExtensionTranslations
        const extensionMatch = content.match(
            /export const registerExtensionTranslations = \(\) => \(([\s\S]*?)\);/
        );
        if (extensionMatch) {
            const jsonStr = extensionMatch[1].replace(/'/g, '"');
            result.extensions = JSON.parse(jsonStr);
        }

        // Extract registerBlocksMessages
        const blocksMatch = content.match(
            /const messages = ([\s\S]*?);[\s\S]*?Object\.keys\(messages\)/
        );
        if (blocksMatch) {
            // For blocks, we need to handle unquoted keys
            let jsonStr = blocksMatch[1];
            // Add quotes to unquoted keys (like BKY_XXX)
            jsonStr = jsonStr.replace(/([A-Z_][A-Z0-9_]*)\s*:/g, '"$1":');
            // Convert single quotes to double quotes
            jsonStr = jsonStr.replace(/'/g, '"');
            result.blocks = JSON.parse(jsonStr);
        }

        return result;
    } catch (e) {
        console.warn(`Warning: Failed to parse existing file ${filePath}: ${e.message}`);
        return null;
    }
};

/**
 * Merge new translations with existing ones (incremental update)
 * @param {object} newTranslations - New translations from Transifex or local
 * @param {object} existingTranslations - Existing translations from file
 * @param {object} keys - Translation keys for this plugin
 * @returns {object} Merged translations
 */
const mergeTranslations = (newTranslations, existingTranslations, keys) => {
    const result = {
        interface: {},
        extensions: {},
        blocks: {}
    };

    const localeList = Object.keys(locales);
    const types = ['interface', 'extensions', 'blocks'];

    for (const type of types) {
        const currentKeys = keys[type];

        for (const locale of localeList) {
            result[type][locale] = {};

            for (const key of currentKeys) {
                const newEnValue = newTranslations[type].en?.[key];

                // For new format, extensions and blocks are merged together in existingTranslations.extensions
                // So we need to check both the specific type and the merged extensions
                let existingEnValue = existingTranslations?.[type]?.en?.[key];
                let existingValue = existingTranslations?.[type]?.[locale]?.[key];

                // If not found in specific type, try to find in extensions (merged format)
                // The new format stores all translations (extensions + blocks) in the extensions object
                if (typeof existingEnValue === 'undefined') {
                    existingEnValue = existingTranslations?.extensions?.en?.[key];
                    existingValue = existingTranslations?.extensions?.[locale]?.[key];
                }

                if (locale === 'en') {
                    // For English, always use new value
                    if (newEnValue) {
                        result[type][locale][key] = newEnValue;
                    }
                } else if (existingValue && existingEnValue === newEnValue) {
                    // English value unchanged - keep existing translation
                    result[type][locale][key] = existingValue;
                } else {
                    // Key doesn't exist or English value changed - use new en value as placeholder
                    result[type][locale][key] = newEnValue || '';
                }
            }
        }
    }

    return result;
};

/**
 * Extract English values directly from plugin source files
 * @param {string} pluginDir - Plugin directory path
 * @param {object} keys - Translation keys
 * @returns {object} English values for all keys
 */
const extractEnglishValues = (pluginDir, keys) => {
    const result = {
        interface: {},
        extensions: {},
        blocks: {}
    };

    const pkg = readPackageJson(pluginDir);
    if (!pkg || !pkg.openblock) {
        return result;
    }

    const openblock = pkg.openblock;

    // Extract interface values from name and description
    // Only extract if openblock.name/description contains formatMessage
    // Skip if it's a plain string (handled by runtime directly)

    // Extract name value - only if it has formatMessage
    if (openblock.name && typeof openblock.name === 'object' && openblock.name.formatMessage) {
        const fm = openblock.name.formatMessage;
        if (fm.id && fm.default && keys.interface.includes(fm.id)) {
            result.interface[fm.id] = fm.default;
        }
    }
    // If openblock.name is a plain string, skip it (no extraction needed)

    // Extract description value - only if it has formatMessage
    if (openblock.description && typeof openblock.description === 'object' && openblock.description.formatMessage) {
        const fm = openblock.description.formatMessage;
        if (fm.id && fm.default && keys.interface.includes(fm.id)) {
            result.interface[fm.id] = fm.default;
        }
    }
    // If openblock.description is a plain string, skip it (no extraction needed)

    // Extract extension values from source files (main.js for extensions)
    if (openblock.main) {
        const mainJsPath = openblock.main;
        const fullMainPath = path.join(pluginDir, mainJsPath);
        if (fs.existsSync(fullMainPath)) {
            try {
                const content = fs.readFileSync(fullMainPath, 'utf8');
                const messages = extractFormatMessages(content);
                messages.forEach(msg => {
                    if (keys.extensions.includes(msg.id)) {
                        result.extensions[msg.id] = msg.default;
                    }
                });
            } catch (e) {
                // Ignore
            }
        }
    }

    // Extract extension values from frameworks array (for devices)
    // Each framework has a main field pointing to a source file
    if (openblock.frameworks && Array.isArray(openblock.frameworks)) {
        for (const framework of openblock.frameworks) {
            if (framework.main) {
                const mainJsPath = framework.main;
                const fullMainPath = path.join(pluginDir, mainJsPath);
                if (fs.existsSync(fullMainPath)) {
                    try {
                        const content = fs.readFileSync(fullMainPath, 'utf8');
                        const messages = extractFormatMessages(content);
                        messages.forEach(msg => {
                            if (keys.extensions.includes(msg.id)) {
                                result.extensions[msg.id] = msg.default;
                            }
                        });
                    } catch (e) {
                        // Ignore
                    }
                }
            }
        }
    }

    // Extract block values from msg.json
    if (openblock.msg) {
        const msgPath = path.join(pluginDir, openblock.msg);
        if (fs.existsSync(msgPath)) {
            try {
                const msgJson = fs.readJsonSync(msgPath);
                Object.keys(msgJson).forEach(key => {
                    if (keys.blocks.includes(key)) {
                        result.blocks[key] = msgJson[key];
                    }
                });
            } catch (e) {
                // Ignore
            }
        }
    }

    return result;
};

/**
 * Build translation objects for a plugin (separated by type)
 * @param {string} pluginDir - Plugin directory path
 * @param {object} keys - Translation keys
 * @returns {object} Translation objects organized by type and locale
 */
const buildPluginTranslations = (pluginDir, keys) => {
    const result = {
        interface: {},
        extensions: {},
        blocks: {}
    };

    const localeList = Object.keys(locales);

    // Extract English values directly from source files
    const englishValues = extractEnglishValues(pluginDir, keys);

    for (const locale of localeList) {
        // Build interface translations
        result.interface[locale] = {};
        keys.interface.forEach(key => {
            const enValue = englishValues.interface[key];
            if (enValue) {
                result.interface[locale][key] = enValue;
            }
        });

        // Build extension translations
        result.extensions[locale] = {};
        keys.extensions.forEach(key => {
            const enValue = englishValues.extensions[key];
            if (enValue) {
                result.extensions[locale][key] = enValue;
            }
        });

        // Build block translations
        result.blocks[locale] = {};
        keys.blocks.forEach(key => {
            const enValue = englishValues.blocks[key];
            if (enValue) {
                result.blocks[locale][key] = enValue;
            }
        });
    }

    return result;
};
/**
 * Generate ESM translation file content
 * @param {object} translations - Translation objects separated by type
 * @returns {string} File content
 */
const generateTranslationFile = translations => {
    const header = `/* eslint-disable quote-props */
/* eslint-disable max-len */
/**
 * Translation file for this resource.
 *
 * This file is generated by combining automatic extraction and manual translations:
 * - The "en" (English) section is automatically extracted from source files
 * - Other language sections can be manually translated or pulled from Transifex
 * - When regenerating, existing manual translations are preserved when the English
 *   source text hasn't changed
 *
 * Structure:
 * - interface: translations for name/description (used by GUI formatMessage)
 * - extensions: translations for extension blocks (used by VM formatMessage)
 * - blocks: translations for Blockly blocks (used by Blockly.Msg)
 */
`;

    // Build separated structure
    const separatedTranslations = {
        interface: translations.interface,
        extensions: translations.extensions,
        blocks: translations.blocks
    };

    // Format translations (all keys and values with single quotes)
    const formattedTranslations = JSON.stringify(separatedTranslations, null, 4).replace(/"/g, "'");

    // Build the default export
    const content = `${header}
export default ${formattedTranslations};
`;

    return content;
};

/**
 * Process a single plugin
 * @param {string} pluginDir - Plugin directory path
 * @returns {boolean} Success status
 */
const processPlugin = pluginDir => {
    const pkg = readPackageJson(pluginDir);
    if (!pkg || !pkg.openblock) {
        return false;
    }

    const resourceId = pkg.openblock.extensionId || pkg.openblock.deviceId;
    console.log(`Processing ${resourceId}...`);

    // Extract keys
    const keys = extractPluginKeys(pluginDir);
    const totalKeys = keys.interface.length + keys.extensions.length + keys.blocks.length;

    if (totalKeys === 0) {
        console.log(`  ⚠ No translation keys found, skipping\n`);
        return false;
    }

    const outputPath = path.join(pluginDir, 'src/translations.js');

    // Build new translations from source files
    let translations = buildPluginTranslations(pluginDir, keys);

    // Merge with existing translations (incremental update)
    const existingTranslations = parseExistingTranslations(outputPath);
    if (existingTranslations) {
        console.log(`  → Merging with existing translations (incremental update)`);
        translations = mergeTranslations(translations, existingTranslations, keys);
    }

    // Generate translations.js file (includes interface, extensions, and blocks)
    const content = generateTranslationFile(translations);

    fs.ensureDirSync(path.dirname(outputPath));
    fs.writeFileSync(outputPath, content, 'utf8');

    console.log(`  ✓ Generated ${outputPath}`);
    const keyCounts = `${keys.interface.length} interface + ` +
        `${keys.extensions.length} extensions + ${keys.blocks.length} blocks`;
    console.log(`    ${keyCounts}\n`);

    return true;
};

/**
 * Main function
 */
const main = async () => {
    const {dir} = parseArgs();
    const workDir = path.resolve(dir || './');

    console.log(`Working directory: ${workDir}\n`);

    // Process single resource
    if (processPlugin(workDir)) {
        console.log('\n✓ Complete! Translation file generated successfully.');
    } else {
        console.log('\n⚠ No translation file generated.');
    }
};

main().catch(error => {
    console.error('Error:', error);
    process.exit(1);
});
