/**
 * Translations processor
 * Extracts interface translations from translations.js and injects into package.json
 */

const fs = require('fs');
const path = require('path');
const vm = require('vm');

/**
 * Extract interface translations from translations.js file
 * @param {string} translationsPath - Path to translations.js file
 * @returns {object|null} Interface translations object or null if not found
 */
const extractInterfaceTranslations = translationsPath => {
    if (!fs.existsSync(translationsPath)) {
        return null;
    }

    try {
        // Read the translations.js file
        let content = fs.readFileSync(translationsPath, 'utf-8');

        // Transform ES6 export default to CommonJS for easier parsing
        // This handles: export default { ... }
        content = content.replace(/export\s+default\s+/g, 'module.exports = ');

        // Create a sandbox environment to execute the module
        const sandbox = {
            exports: {},
            module: {exports: {}},
            require: () => ({})
        };

        // Execute the file in the sandbox
        vm.createContext(sandbox);
        vm.runInContext(content, sandbox);

        // Get the module exports
        const translations = sandbox.module.exports;

        // Extract interface section
        if (translations && translations.interface) {
            return translations.interface;
        }

        return null;
    } catch (error) {
        console.warn(`Warning: Failed to extract translations from ${translationsPath}: ${error.message}`);
        return null;
    }
};

/**
 * Resolve translations file path from package.json
 * @param {string} projectDir - Project directory
 * @param {object} packageJson - Package.json object
 * @returns {string|null} Resolved translations file path or null
 */
const resolveTranslationsPath = (projectDir, packageJson) => {
    const openblock = packageJson.openblock || {};
    const translationsField = openblock.translations;

    if (!translationsField) {
        return null;
    }

    // Resolve relative path
    const translationsPath = path.resolve(projectDir, translationsField);

    return translationsPath;
};

/**
 * Inject interface translations into package.json l10n field
 * @param {string} projectDir - Project directory
 * @param {object} packageJson - Package.json object
 * @returns {object} Modified package.json object
 */
const injectInterfaceTranslations = (projectDir, packageJson) => {
    // Clone package.json to avoid mutation
    const modifiedPackageJson = JSON.parse(JSON.stringify(packageJson));

    // Ensure openblock field exists
    if (!modifiedPackageJson.openblock) {
        return modifiedPackageJson;
    }

    // Resolve translations file path
    const translationsPath = resolveTranslationsPath(projectDir, packageJson);

    if (!translationsPath) {
        return modifiedPackageJson;
    }

    // Extract interface translations
    const interfaceTranslations = extractInterfaceTranslations(translationsPath);

    if (!interfaceTranslations) {
        return modifiedPackageJson;
    }

    // Inject into l10n field
    modifiedPackageJson.openblock.l10n = interfaceTranslations;

    return modifiedPackageJson;
};

module.exports = {
    extractInterfaceTranslations,
    resolveTranslationsPath,
    injectInterfaceTranslations
};
