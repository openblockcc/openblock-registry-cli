/**
 * Package Entry Builder
 * Builds package entries for packages.json from plugin package.json
 * Uses whitelist approach - only essential fields for registry index
 * Other fields will be fetched from repository during CI/CD build
 */

/**
 * Normalize i18n field value
 * If value is a formatMessage object, extract the default value
 * @param {string|object} value - Field value (string or formatMessage object)
 * @returns {string} Normalized string value
 */
const normalizeI18nField = value => {
    if (typeof value === 'string') {
        return value;
    }
    if (value && typeof value === 'object' && value.formatMessage) {
        return value.formatMessage.default || value.formatMessage.id || '';
    }
    return '';
};

/**
 * Normalize repository URL
 * @param {string|object} repository - Repository field from package.json
 * @returns {string} Normalized repository URL
 */
const normalizeRepository = repository => {
    if (!repository) return '';
    const url = typeof repository === 'string' ? repository : repository.url;
    return url ? url.replace(/\.git$/, '') : '';
};

/**
 * Build a package entry for packages.json
 * Only includes essential fields: name, deviceId/extensionId, version, repository
 * Order: name, deviceId/extensionId, version, repository
 * @param {object} packageInfo - Package information from package.json
 * @returns {object} Package entry for packages.json
 */
const buildPackageEntry = packageInfo => {
    const openblock = packageInfo.openblock;
    const isDevice = !!openblock.deviceId;

    // Build entry with specific field order
    const entry = {
        // 1. name (normalized from i18n if needed)
        name: normalizeI18nField(openblock.name) || openblock.deviceId || openblock.extensionId,

        // 2. deviceId or extensionId
        ...(isDevice ? {deviceId: openblock.deviceId} : {extensionId: openblock.extensionId}),

        // 3. version
        version: packageInfo.version,

        // 4. repository
        repository: normalizeRepository(packageInfo.repository)
    };

    return entry;
};

module.exports = {
    buildPackageEntry,
    normalizeI18nField,
    normalizeRepository
};
