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
    const pluginType = openblock.type;
    const pluginId = openblock.id;

    // Fetch current packages.json
    const packagesJson = await fetchPackagesJson();

    // Check if plugin type category exists
    if (!packagesJson[pluginType]) {
        return {
            isNew: true,
            existingPlugin: null,
            packagesJson: packagesJson
        };
    }

    // Check if plugin ID exists
    const existingPlugin = packagesJson[pluginType][pluginId];
    if (!existingPlugin) {
        return {
            isNew: true,
            existingPlugin: null,
            packagesJson: packagesJson
        };
    }

    // Plugin exists - check if it's from the same repository
    const currentRepoId = normalizeRepoUrl(repoInfo.html_url || packageInfo.repository);
    const existingRepoId = normalizeRepoUrl(existingPlugin.repository);

    if (currentRepoId && existingRepoId && currentRepoId !== existingRepoId) {
        // ID conflict - different repository trying to use same ID
        throw new Error(
            `插件 ID "${pluginId}" 已被其他仓库占用。\n` +
            `   现有仓库: ${existingPlugin.repository}\n` +
            `   您的仓库: ${repoInfo.html_url || packageInfo.repository.url}\n` +
            `   请使用不同的 openblock.id`
        );
    }

    // Same repository - this is an update
    return {
        isNew: false,
        existingPlugin: existingPlugin,
        packagesJson: packagesJson
    };
};

module.exports = {
    validateIdUniqueness,
    fetchPackagesJson,
    normalizeRepoUrl
};
