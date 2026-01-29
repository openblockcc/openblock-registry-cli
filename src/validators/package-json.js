/**
 * Package.json validator
 * Validates package.json format and openblock fields
 */

const fs = require('fs');
const path = require('path');
const semver = require('semver');

const REQUIRED_OPENBLOCK_FIELDS = ['id', 'type', 'name'];
const VALID_TYPES = ['device', 'extension'];

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
 * Validate package.json in current directory
 * @returns {object} Parsed and validated package.json
 * @throws {Error} If validation fails
 */
const validatePackageJson = async function () {
    const packageJsonPath = path.join(process.cwd(), 'package.json');

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

    // Validate type
    if (!VALID_TYPES.includes(openblock.type)) {
        throw new Error(`package.json: openblock.type must be one of: ${VALID_TYPES.join(', ')}`);
    }

    // Validate id format (camelCase, no special characters)
    if (!/^[a-zA-Z][a-zA-Z0-9]*$/.test(openblock.id)) {
        throw new Error('package.json: openblock.id must start with a letter and contain only alphanumeric characters');
    }

    // Normalize repository URL
    packageJson.repository = {
        type: 'git',
        url: normalizeGitHubUrl(repoUrl)
    };

    return packageJson;
};

module.exports = validatePackageJson;
