/**
 * OpenBlock Files Validator
 * Validates that all file paths specified in openblock configuration exist
 */

const fs = require('fs');
const path = require('path');

/**
 * File path fields in openblock configuration that need validation
 * These fields can contain relative file paths that should exist
 */
const FILE_PATH_FIELDS = [
    {field: 'main', description: 'Main entry file', optional: true},
    {field: 'generator', description: 'Code generator file', optional: true},
    {field: 'blocks', description: 'Blocks definition file', optional: true},
    {field: 'msg', description: 'Message/translation file', optional: true},
    {field: 'toolbox', description: 'Toolbox definition file', optional: true},
    {field: 'translations', description: 'Translations file', optional: false}
];

/**
 * Validate that all file paths in openblock configuration exist
 * @param {string} dir - Directory to validate (defaults to current directory)
 * @returns {object} Validation results {valid: boolean, errors: Array<string>, warnings: Array<string>}
 * @throws {Error} If required files are missing
 */
const validateOpenBlockFiles = function (dir = process.cwd()) {
    const errors = [];
    const warnings = [];
    const checkedFiles = [];

    // Read package.json
    const packageJsonPath = path.join(dir, 'package.json');
    if (!fs.existsSync(packageJsonPath)) {
        throw new Error('package.json not found');
    }

    const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf-8'));
    const openblock = packageJson.openblock;

    if (!openblock) {
        throw new Error('package.json: "openblock" field is required');
    }

    // Check each file path field
    for (const {field, description, optional} of FILE_PATH_FIELDS) {
        const filePath = openblock[field];

        // Skip if field is not defined
        if (!filePath) {
            if (!optional) {
                errors.push(`openblock.${field} is required but not defined`);
            }
            continue;
        }

        // Validate that it's a string
        if (typeof filePath !== 'string') {
            errors.push(`openblock.${field} must be a string, got ${typeof filePath}`);
            continue;
        }

        // Resolve the file path (relative to project directory)
        const resolvedPath = path.resolve(dir, filePath);

        // Check if file exists
        if (fs.existsSync(resolvedPath)) {
            // Check if it's a file (not a directory)
            const stats = fs.statSync(resolvedPath);
            if (stats.isFile()) {
                checkedFiles.push({
                    field,
                    path: filePath,
                    resolvedPath,
                    size: stats.size
                });
            } else {
                errors.push(`openblock.${field} must be a file, not a directory: "${filePath}"`);
            }
        } else {
            const errorMsg = `${description} not found: openblock.${field} = "${filePath}"\n` +
                `   Resolved path: "${resolvedPath}"`;
            errors.push(errorMsg);
        }
    }

    // Check libraries directory if specified
    if (openblock.libraries) {
        const librariesPath = openblock.libraries;
        if (typeof librariesPath === 'string') {
            const resolvedLibPath = path.resolve(dir, librariesPath);
            if (fs.existsSync(resolvedLibPath)) {
                const stats = fs.statSync(resolvedLibPath);
                if (stats.isDirectory()) {
                    // Directory exists and is valid
                } else {
                    warnings.push(`openblock.libraries must be a directory: "${librariesPath}"`);
                }
            } else {
                warnings.push(`Libraries directory not found: openblock.libraries = "${librariesPath}"`);
            }
        }
    }

    // Check firmwares directory if specified (for devices)
    if (openblock.firmwares) {
        const firmwaresPath = openblock.firmwares;
        if (typeof firmwaresPath === 'string') {
            const resolvedFirmPath = path.resolve(dir, firmwaresPath);
            if (fs.existsSync(resolvedFirmPath)) {
                const stats = fs.statSync(resolvedFirmPath);
                if (stats.isDirectory()) {
                    // Directory exists and is valid
                } else {
                    warnings.push(`openblock.firmwares must be a directory: "${firmwaresPath}"`);
                }
            } else {
                warnings.push(`Firmwares directory not found: openblock.firmwares = "${firmwaresPath}"`);
            }
        }
    }

    return {
        valid: errors.length === 0,
        errors,
        warnings,
        checkedFiles
    };
};

module.exports = validateOpenBlockFiles;
