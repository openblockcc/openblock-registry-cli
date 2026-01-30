/**
 * Package.json Processor
 * Processes package.json for build output with field inclusion
 * Uses whitelist approach for explicit control
 */

/**
 * Root-level package.json fields to include in build output (whitelist)
 * Only these fields will be copied to dist/package.json
 */
const INCLUDED_PACKAGE_FIELDS = [
    // Package identity
    'name',
    'version',

    // Metadata
    'author',
    'license',
    'repository',

    // Plugin configuration - the core of the plugin
    'openblock'
];

/**
 * Get the list of included package.json fields for build output
 * @returns {string[]} List of included field names
 */
const getIncludedPackageFields = () => [...INCLUDED_PACKAGE_FIELDS];

/**
 * Process package.json for build output
 * Only includes whitelisted fields
 * @param {object} packageJson - Original package.json
 * @returns {object} Processed package.json for dist output
 */
const processPackageJsonForBuild = packageJson => {
    const processed = {};

    for (const field of INCLUDED_PACKAGE_FIELDS) {
        if (field in packageJson && typeof packageJson[field] !== 'undefined') {
            processed[field] = packageJson[field];
        }
    }

    return processed;
};

module.exports = {
    INCLUDED_PACKAGE_FIELDS,
    getIncludedPackageFields,
    processPackageJsonForBuild
};
