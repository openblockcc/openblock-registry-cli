/**
 * Package.json validator
 * Validates package.json format and openblock fields
 */

const fs = require('fs');
const path = require('path');
const semver = require('semver');

const REQUIRED_OPENBLOCK_FIELDS = ['name'];
const VALID_DEVICE_TYPES = ['arduino', 'micropython', 'microbit'];

/**
 * Normalize GitHub URL to https format
 * @param {string} url - GitHub URL
 * @returns {string} Normalized URL
 */
const normalizeGitHubUrl = function (url) {
    // Remove .git suffix
    url = url.replace(/\.git$/, '');

    // Convert git@ to https://
    if (url.startsWith('git@github.com:')) {
        url = url.replace('git@github.com:', 'https://github.com/');
    }

    // Ensure https://
    if (!url.startsWith('https://')) {
        url = url.replace(/^(http:\/\/|git:\/\/)/, 'https://');
    }

    return url;
};

/**
 * Validate package.json in specified directory
 * @param {string} dir - Directory to validate (defaults to current directory)
 * @returns {object} Parsed and validated package.json
 * @throws {Error} If validation fails
 */
const validatePackageJson = async function (dir = process.cwd()) {
    const packageJsonPath = path.join(dir, 'package.json');

    // Check file exists
    if (!fs.existsSync(packageJsonPath)) {
        throw new Error('package.json not found in current directory');
    }

    // Parse JSON
    let packageJson;
    try {
        packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf-8'));
    } catch (e) {
        throw new Error(`Failed to parse package.json: ${e.message}`);
    }

    // Validate required fields
    if (!packageJson.name) {
        throw new Error('package.json: "name" field is required');
    }

    if (!packageJson.version) {
        throw new Error('package.json: "version" field is required');
    }

    if (!semver.valid(packageJson.version)) {
        throw new Error(`package.json: invalid version "${packageJson.version}". Must be valid semver.`);
    }

    // Validate repository field
    if (!packageJson.repository) {
        throw new Error('package.json: "repository" field is required');
    }

    // Validate repository URL
    const repoUrl = typeof packageJson.repository === 'string' ?
        packageJson.repository :
        packageJson.repository.url;

    if (!repoUrl) {
        throw new Error('package.json: repository URL is required');
    }

    // Must be GitHub repository
    if (!repoUrl.includes('github.com')) {
        throw new Error('package.json: repository must be a GitHub URL');
    }

    // Normalize repository URL
    packageJson.repository = {
        type: 'git',
        url: normalizeGitHubUrl(repoUrl)
    };

    // Validate openblock field
    if (!packageJson.openblock) {
        throw new Error('package.json: "openblock" field is required');
    }

    const openblock = packageJson.openblock;

    // Check required openblock fields
    for (const field of REQUIRED_OPENBLOCK_FIELDS) {
        if (!openblock[field]) {
            throw new Error(`package.json: openblock.${field} is required`);
        }
    }

    // Determine plugin type by checking which ID field exists
    // A plugin can only be either a device OR an extension, not both
    let pluginType = null;
    let idField = null;

    const hasDeviceId = !!openblock.deviceId;
    const hasExtensionId = !!openblock.extensionId;

    // Check for conflicting IDs
    if (hasDeviceId && hasExtensionId) {
        throw new Error(
            'package.json: cannot have both openblock.deviceId and openblock.extensionId.\n' +
            '   A plugin must be either a device OR an extension, not both.'
        );
    }

    // Determine plugin type
    if (hasDeviceId) {
        pluginType = 'device';
        idField = 'deviceId';
    } else if (hasExtensionId) {
        pluginType = 'extension';
        idField = 'extensionId';
    } else {
        throw new Error(
            'package.json: either openblock.deviceId (for device) or ' +
            'openblock.extensionId (for extension) is required'
        );
    }

    // Validate id format (camelCase, no special characters)
    if (!/^[a-zA-Z][a-zA-Z0-9]*$/.test(openblock[idField])) {
        throw new Error(
            `package.json: openblock.${idField} must start with a letter and ` +
            `contain only alphanumeric characters`
        );
    }

    // For devices, validate the type field
    if (pluginType === 'device') {
        if (!openblock.type) {
            throw new Error('package.json: openblock.type is required for device plugins');
        }
        if (!VALID_DEVICE_TYPES.includes(openblock.type)) {
            throw new Error(
                `package.json: openblock.type must be one of: ${VALID_DEVICE_TYPES.join(', ')} ` +
                `for device plugins`
            );
        }
    }

    // For extensions, type field should not exist (or warn if it does)
    if (pluginType === 'extension' && openblock.type) {
        console.warn(
            'Warning: openblock.type field is not used for extension plugins and will be ignored'
        );
    }

    // Normalize: add 'id' and 'pluginType' fields for backward compatibility
    openblock.id = openblock[idField];
    openblock.pluginType = pluginType;

    return packageJson;
};

module.exports = validatePackageJson;
