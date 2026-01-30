/**
 * Plugin ID uniqueness validator
 * Checks if the plugin ID conflicts with existing plugins from other repositories
 */

const fetch = require('node-fetch');

const REGISTRY_OWNER = 'openblockcc';
const REGISTRY_REPO = 'openblock-registry';
const REGISTRY_BRANCH = 'main';

/**
 * Fetch packages.json from the registry
 * @returns {Promise<object>} Packages JSON content
 */
const fetchPackagesJson = async function () {
    const url = `https://raw.githubusercontent.com/${REGISTRY_OWNER}/${REGISTRY_REPO}/${REGISTRY_BRANCH}/packages.json`;

    const response = await fetch(url, {
        headers: {
            'User-Agent': 'openblock-cli'
        }
    });

    if (!response.ok) {
        if (response.status === 404) {
            // Registry is empty or packages.json doesn't exist yet
            return {devices: {}, extensions: {}, libraries: {}, toolchains: {}};
        }
        throw new Error(`Failed to fetch packages.json: ${response.status}`);
    }

    return response.json();
};

/**
 * Normalize repository URL for comparison
 * Handles different URL formats: https, git+https, .git suffix
 * @param {string|object} repository - Repository URL or object
 * @returns {string} Normalized repository identifier (owner/repo)
 */
const normalizeRepoUrl = function (repository) {
    const url = typeof repository === 'string' ? repository : repository.url;
    if (!url) {
        return null;
    }

    // Extract owner/repo from various GitHub URL formats
    const match = url.match(/github\.com[/:]([^/]+)\/([^/.]+)/);
    if (match) {
        return `${match[1]}/${match[2]}`.toLowerCase();
    }
    return null;
};

/**
 * Validate plugin ID uniqueness
 * @param {object} packageInfo - Package information from package.json
 * @param {object} repoInfo - Repository information
 * @returns {Promise<object>} Validation result with isNew and existingInfo
 * @throws {Error} If ID conflicts with another repository's plugin
 */
const validateIdUniqueness = async function (packageInfo, repoInfo) {
    const openblock = packageInfo.openblock;
    const pluginType = openblock.pluginType; // 'device' or 'extension'
    const pluginId = openblock.id;
    const idField = pluginType === 'device' ? 'deviceId' : 'extensionId';

    // Fetch current packages.json
    const packagesJson = await fetchPackagesJson();

    // Check ID uniqueness across ALL plugin types (devices and extensions)
    // Device IDs and Extension IDs must be globally unique
    const typesToCheck = ['device', 'extension'];

    for (const typeToCheck of typesToCheck) {
        const pluralType = typeToCheck === 'device' ? 'devices' : 'extensions';

        if (!packagesJson[pluralType]) {
            continue;
        }

        const existingPlugin = packagesJson[pluralType][pluginId];
        if (!existingPlugin) {
            continue;
        }

        // Found a plugin with the same ID
        const currentRepoId = normalizeRepoUrl(repoInfo.html_url || packageInfo.repository);
        const existingRepoId = normalizeRepoUrl(existingPlugin.repository);

        if (currentRepoId && existingRepoId && currentRepoId !== existingRepoId) {
            // ID conflict - different repository trying to use same ID
            const existingTypeLabel = typeToCheck === 'device' ? 'device' : 'extension';
            throw new Error(
                `Plugin ID "${pluginId}" is already used by another repository's ${existingTypeLabel}.\n` +
                `   Existing repository: ${existingPlugin.repository}\n` +
                `   Your repository: ${repoInfo.html_url || packageInfo.repository.url}\n` +
                `   Please use a different openblock.${idField}\n` +
                `   Note: Device IDs and Extension IDs must be globally unique`
            );
        }

        // Same repository - this is an update
        if (typeToCheck === pluginType) {
            return {
                isNew: false,
                existingPlugin: existingPlugin,
                packagesJson: packagesJson
            };
        }
        // Same repo but different type - this is not allowed
        const existingTypeLabel = typeToCheck === 'device' ? 'device' : 'extension';
        const currentTypeLabel = pluginType === 'device' ? 'device' : 'extension';
        throw new Error(
            `Plugin ID "${pluginId}" is already used as a ${existingTypeLabel} in your repository.\n` +
                `   Cannot use the same ID for different plugin types.\n` +
                `   Existing type: ${existingTypeLabel}\n` +
                `   Current type: ${currentTypeLabel}\n` +
                `   Please use a different openblock.${idField}`
        );

    }

    // ID is new - no conflicts found
    return {
        isNew: true,
        existingPlugin: null,
        packagesJson: packagesJson
    };
};

module.exports = {
    validateIdUniqueness,
    fetchPackagesJson,
    normalizeRepoUrl
};
