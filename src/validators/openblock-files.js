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

    // Check firmwares entries if specified (for devices)
    // firmwares is an array of {id, name, file} objects; each file path must exist.
    if (openblock.firmwares) {
        if (Array.isArray(openblock.firmwares)) {
            const seenIds = new Set();
            openblock.firmwares.forEach((fw, i) => {
                if (!fw || typeof fw !== 'object') {
                    errors.push(`openblock.firmwares[${i}] must be an object`);
                    return;
                }
                if (typeof fw.id !== 'string' || !fw.id) {
                    errors.push(`openblock.firmwares[${i}].id is required and must be a non-empty string`);
                } else if (seenIds.has(fw.id)) {
                    errors.push(`openblock.firmwares[${i}].id "${fw.id}" is duplicated`);
                } else {
                    seenIds.add(fw.id);
                }
                const nameIsString = typeof fw.name === 'string' && fw.name;
                const nameIsFormatMessage = fw.name && typeof fw.name === 'object' &&
                    fw.name.formatMessage && typeof fw.name.formatMessage === 'object' &&
                    typeof fw.name.formatMessage.id === 'string' &&
                    typeof fw.name.formatMessage.default === 'string';
                if (!nameIsString && !nameIsFormatMessage) {
                    errors.push(`openblock.firmwares[${i}].name is required and must be a non-empty string` +
                        ` or a {formatMessage:{id,default}} object`);
                }
                if (typeof fw.file !== 'string' || !fw.file) {
                    errors.push(`openblock.firmwares[${i}].file is required and must be a non-empty string`);
                    return;
                }
                const resolved = path.resolve(dir, fw.file);
                if (!fs.existsSync(resolved)) {
                    errors.push(
                        `Firmware file not found: openblock.firmwares[${i}].file = "${fw.file}"\n` +
                        `   Resolved path: "${resolved}"`
                    );
                } else if (!fs.statSync(resolved).isFile()) {
                    errors.push(`openblock.firmwares[${i}].file must be a file: "${fw.file}"`);
                }
            });
        } else {
            errors.push('openblock.firmwares must be an array of {id, name, file} entries');
        }
    }

    // Check examples entries if specified (applies to both device and extension).
    // examples is an array of {id, name, file, [description], [iconURL]} objects;
    // each file path must exist; optional iconURL path must exist when provided.
    // Structural validation (id uniqueness, name shape, etc.) lives in
    // package-structure.js — here we only verify on-disk presence.
    if (openblock.examples) {
        if (Array.isArray(openblock.examples)) {
            openblock.examples.forEach((ex, i) => {
                if (!ex || typeof ex !== 'object') return; // structural error already reported
                if (typeof ex.file === 'string' && ex.file) {
                    const resolved = path.resolve(dir, ex.file);
                    if (!fs.existsSync(resolved)) {
                        errors.push(
                            `Example file not found: openblock.examples[${i}].file = "${ex.file}"\n` +
                            `   Resolved path: "${resolved}"`
                        );
                    } else if (!fs.statSync(resolved).isFile()) {
                        errors.push(`openblock.examples[${i}].file must be a file: "${ex.file}"`);
                    }
                }
                // iconURL is optional. Pass-through values that already look like
                // absolute URLs or data URIs (the runtime/service handle them as-is).
                if (typeof ex.iconURL === 'string' && ex.iconURL &&
                    !ex.iconURL.startsWith('http://') &&
                    !ex.iconURL.startsWith('https://') &&
                    !ex.iconURL.startsWith('data:')) {
                    const resolvedIcon = path.resolve(dir, ex.iconURL);
                    if (!fs.existsSync(resolvedIcon)) {
                        errors.push(
                            `Example icon not found: openblock.examples[${i}].iconURL = "${ex.iconURL}"\n` +
                            `   Resolved path: "${resolvedIcon}"`
                        );
                    } else if (!fs.statSync(resolvedIcon).isFile()) {
                        errors.push(`openblock.examples[${i}].iconURL must be a file: "${ex.iconURL}"`);
                    }
                }
            });
        }
        // Non-array case is reported by package-structure.js; skip here.
    }

    return {
        valid: errors.length === 0,
        errors,
        warnings,
        checkedFiles
    };
};

module.exports = validateOpenBlockFiles;
