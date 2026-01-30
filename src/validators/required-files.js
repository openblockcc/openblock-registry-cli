/**
 * Required files validator
 * Validates that all required files exist
 */

const fs = require('fs');
const path = require('path');

const REQUIRED_FILES = [
    {name: 'LICENSE', description: 'License file'},
    {name: 'README.md', description: 'README documentation'}
];

/**
 * Validate required files exist
 * @param {string} dir - Directory to validate (defaults to current directory)
 * @returns {object} Validation results
 * @throws {Error} If required files are missing
 */
const validateRequiredFiles = async function (dir = process.cwd()) {
    const cwd = dir;
    const results = {
        files: [],
        icon: null
    };

    // Check required files
    for (const file of REQUIRED_FILES) {
        const filePath = path.join(cwd, file.name);
        if (!fs.existsSync(filePath)) {
            throw new Error(`Required file missing: ${file.name} (${file.description})`);
        }

        const stats = fs.statSync(filePath);
        results.files.push({
            name: file.name,
            size: stats.size
        });
    }

    // Check for icon - must be base64 data URI in package.json
    const packageJsonPath = path.join(cwd, 'package.json');
    let iconFound = false;

    if (fs.existsSync(packageJsonPath)) {
        const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf-8'));

        // Check if iconURL is a base64 data URI
        if (packageJson.openblock && packageJson.openblock.iconURL) {
            const iconURL = packageJson.openblock.iconURL;

            // Icon must be a base64 data URI
            if (iconURL.startsWith('data:image/')) {
                iconFound = true;
                results.icon = {
                    name: 'base64 data URI',
                    size: iconURL.length
                };

                // Validate base64 size (should be reasonable, ~100KB for base64)
                if (iconURL.length > 150 * 1024) {
                    console.warn(`Warning: Icon base64 data URI is larger than 150KB`);
                }
            } else {
                throw new Error(
                    `${'package.json: openblock.iconURL must be a base64 data URI.\n' +
                    '   Expected format: "data:image/png;base64,iVBORw0KG..."\n' +
                    '   Found: "'}${iconURL.substring(0, 50)}..."`
                );
            }
        }
    }

    if (!iconFound) {
        throw new Error(
            'package.json: openblock.iconURL is required and must be a base64 data URI.\n' +
            '   Expected format: "data:image/png;base64,iVBORw0KG..."'
        );
    }

    return results;
};

module.exports = validateRequiredFiles;
