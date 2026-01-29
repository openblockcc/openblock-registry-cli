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

const ICON_FILES = ['icon.png', 'icon.svg', 'icon.jpg'];

/**
 * Validate required files exist
 * @returns {object} Validation results
 * @throws {Error} If required files are missing
 */
const validateRequiredFiles = async function () {
    const cwd = process.cwd();
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

    // Check for icon file
    let iconFound = false;
    for (const iconName of ICON_FILES) {
        const iconPath = path.join(cwd, iconName);
        if (fs.existsSync(iconPath)) {
            iconFound = true;
            const stats = fs.statSync(iconPath);
            results.icon = {
                name: iconName,
                size: stats.size
            };

            // Validate icon size (should be reasonable)
            if (stats.size > 1024 * 1024) {
                console.warn(`Warning: Icon file ${iconName} is larger than 1MB`);
            }

            break;
        }
    }

    if (!iconFound) {
        throw new Error(`Icon file missing. Please add one of: ${ICON_FILES.join(', ')}`);
    }

    // Check package.json openblock.iconURL matches
    const packageJsonPath = path.join(cwd, 'package.json');
    if (fs.existsSync(packageJsonPath)) {
        const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf-8'));
        if (packageJson.openblock && packageJson.openblock.iconURL) {
            const declaredIcon = packageJson.openblock.iconURL.replace('./', '');
            if (!fs.existsSync(path.join(cwd, declaredIcon))) {
                throw new Error(`Icon file declared in openblock.iconURL not found: ${declaredIcon}`);
            }
        }
    }

    return results;
};

module.exports = validateRequiredFiles;
