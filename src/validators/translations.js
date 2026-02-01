/**
 * Translations validator
 * Validates translation file consistency and namespace
 */

const fs = require('fs');
const path = require('path');

/**
 * Parse ES module export from translations file
 * @param {string} content - File content
 * @returns {object|null} Parsed translations or null
 */
const parseTranslationsFile = function (content) {
    try {
        // Remove comments
        const cleanContent = content
            .replace(/\/\*[\s\S]*?\*\//g, '') // Remove block comments
            .replace(/\/\/.*/g, ''); // Remove line comments

        // Extract the object from export default {...}
        const match = cleanContent.match(/export\s+default\s+({[\s\S]*});?\s*$/);
        if (!match) return null;

        // Use eval to parse the object (safe in this context as we're validating user's local files)
        // eslint-disable-next-line no-eval
        const translations = eval(`(${match[1]})`);
        return translations;
    } catch (err) {
        return null;
    }
};

/**
 * Validate translation file consistency and namespace
 * @param {object} packageJson - Parsed package.json
 * @param {string} dir - Directory containing the plugin (defaults to current directory)
 * @returns {object} Validation result {valid: boolean, errors: Array<string>}
 */
const validateTranslations = function (packageJson, dir = process.cwd()) {
    const errors = [];
    const openblock = packageJson.openblock;

    if (!openblock) {
        return {valid: false, errors: ['Missing openblock field']};
    }

    // Get translations file path
    const translationsPath = openblock.translations?.replace(/^\.\//, '');
    if (!translationsPath) {
        return {valid: false, errors: ['Missing openblock.translations field']};
    }

    // Check if translations file exists
    const fullPath = path.join(dir, translationsPath);
    if (!fs.existsSync(fullPath)) {
        return {valid: false, errors: [`Translations file not found: ${translationsPath}`]};
    }

    // Read and parse translations file
    let content;
    try {
        content = fs.readFileSync(fullPath, 'utf-8');
    } catch (err) {
        return {valid: false, errors: [`Failed to read translations file: ${err.message}`]};
    }

    const translations = parseTranslationsFile(content);
    if (!translations) {
        return {
            valid: false,
            errors: ['Failed to parse translations file.' +
                ' Must be ES module with export default {...}']
        };
    }

    // Check interface section exists
    if (!translations.interface) {
        errors.push('Missing "interface" section in translations file');
        return {valid: false, errors};
    }

    // Get the plugin ID (deviceId or extensionId)
    const pluginType = openblock.pluginType;
    const pluginId = pluginType === 'device' ? openblock.deviceId : openblock.extensionId;
    if (!pluginId) {
        return {valid: false, errors: [`Missing ${pluginType}Id in package.json`]};
    }

    // Expected namespace prefix (only pluginId, no type prefix)
    const namespacePrefix = `${pluginId}.`;

    // Check name consistency (only if using formatMessage structure)
    if (typeof openblock.name === 'object' && openblock.name.formatMessage) {
        const nameId = openblock.name.formatMessage.id;
        const expectedNameId = `${pluginId}.name`;

        // Check if name ID matches expected format
        if (nameId !== expectedNameId) {
            errors.push(`name formatMessage id should be '${expectedNameId}', got '${nameId}'`);
        }

        // Check if name exists in translations interface
        const hasNameInTranslations = Object.values(translations.interface).some(lang =>
            lang && typeof lang === 'object' && nameId in lang
        );

        if (!hasNameInTranslations) {
            errors.push(`name formatMessage id '${nameId}' not found in translations interface`);
        }
    }
    // If name is a string, no validation needed (direct string is allowed)

    // Check description consistency (only if using formatMessage structure)
    if (typeof openblock.description === 'object' && openblock.description.formatMessage) {
        const descId = openblock.description.formatMessage.id;
        const expectedDescId = `${pluginId}.description`;

        // Check if description ID matches expected format
        if (descId !== expectedDescId) {
            errors.push(`description formatMessage id should be '${expectedDescId}', got '${descId}'`);
        }

        // Check if description exists in translations interface
        const hasDescInTranslations = Object.values(translations.interface).some(lang =>
            lang && typeof lang === 'object' && descId in lang
        );

        if (!hasDescInTranslations) {
            errors.push(`description formatMessage id '${descId}' not found in translations interface`);
        }
    }
    // If description is a string, no validation needed (direct string is allowed)

    // Check namespace for all translation keys
    // interface and extensions: {pluginId}.* (e.g., arduinoUnoR4Minima.description)
    // blocks: UPPERCASE_UNDERSCORE format (no pluginId prefix required)
    for (const section of ['interface', 'extensions']) {
        if (!translations[section]) continue;

        for (const [lang, keys] of Object.entries(translations[section])) {
            if (!keys || typeof keys !== 'object') continue;

            for (const key of Object.keys(keys)) {
                if (!key.startsWith(namespacePrefix)) {
                    errors.push(`Invalid namespace in ${section}.${lang}: '${key}' ` +
                        `should start with '${namespacePrefix}'`);
                }
            }
        }
    }

    // Validate blocks section: should use UPPERCASE_UNDERSCORE format
    if (translations.blocks) {
        for (const [lang, keys] of Object.entries(translations.blocks)) {
            if (!keys || typeof keys !== 'object') continue;

            for (const key of Object.keys(keys)) {
                // Blocks should be UPPERCASE with underscores
                if (!/^[A-Z][A-Z0-9_]*$/.test(key)) {
                    errors.push(`Invalid block key format in blocks.${lang}: '${key}' ` +
                        `should use UPPERCASE_UNDERSCORE format`);
                }
            }
        }
    }

    return {
        valid: errors.length === 0,
        errors
    };
};

module.exports = validateTranslations;
