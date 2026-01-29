/**
 * @fileoverview
 * Dependency resolver for CLI dev command.
 *
 * Simplified architecture:
 * - Libraries: Only support local paths (bundled in packages)
 * - Toolchains: Only support 'latest' version or local paths
 */

const fs = require('fs');
const path = require('path');

/**
 * Check if a dependency identifier is a local path
 * @param {string} identifier - Dependency identifier (version string or path)
 * @returns {boolean} True if it's a local path
 */
const isLocalPath = identifier => {
    return identifier.startsWith('./') || identifier.startsWith('../');
};

/**
 * @typedef {Object} ParsedDependencies
 * @property {Object.<string, string>} libraries - Local library paths {name: localPath}
 * @property {Object} toolchains - Toolchain dependencies
 * @property {Object.<string, string>} toolchains.local - Local toolchain paths
 * @property {Object.<string, string>} toolchains.remote - Remote toolchains (only 'latest')
 * @property {string[]} warnings - Validation warnings
 */

/**
 * Parse dependencies from package.json
 * Libraries only support local paths, toolchains support local paths or 'latest'.
 *
 * @param {string} projectDir - Project directory path
 * @returns {ParsedDependencies} Parsed dependencies
 */
const parseDependencies = projectDir => {
    const packageJsonPath = path.join(projectDir, 'package.json');

    if (!fs.existsSync(packageJsonPath)) {
        throw new Error('package.json not found');
    }

    const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf-8'));
    const openblockConfig = packageJson.openblock || {};
    const dependencies = openblockConfig.dependencies || {};

    const result = {
        libraries: {},  // All libraries are local: {name: localPath}
        toolchains: {
            local: {},  // Local toolchains: {name: localPath}
            remote: {}  // Remote toolchains: {name: 'latest'}
        },
        warnings: []
    };

    // Parse libraries - only local paths allowed
    const libraries = dependencies.libraries || {};
    for (const [name, identifier] of Object.entries(libraries)) {
        if (isLocalPath(identifier)) {
            result.libraries[name] = identifier;
        } else {
            result.warnings.push(
                `Library "${name}" must use local path (e.g., ./libraries/${name}). ` +
                `Remote libraries are not supported. Ignoring.`
            );
        }
    }

    // Parse toolchains - local paths or 'latest' only
    const toolchains = dependencies.toolchains || {};
    for (const [name, identifier] of Object.entries(toolchains)) {
        if (isLocalPath(identifier)) {
            result.toolchains.local[name] = identifier;
        } else if (identifier === 'latest') {
            result.toolchains.remote[name] = identifier;
        } else {
            result.warnings.push(
                `Toolchain "${name}" must use 'latest' or local path. ` +
                `Version ranges are not supported. Ignoring.`
            );
        }
    }

    return result;
};

/**
 * Validate local dependencies exist
 * @param {string} projectDir - Project directory path
 * @param {ParsedDependencies} deps - Parsed dependencies
 * @returns {{valid: boolean, errors: string[]}} Validation result
 */
const validateLocalDependencies = (projectDir, deps) => {
    const errors = [];

    // Validate local libraries
    for (const [name, relativePath] of Object.entries(deps.libraries)) {
        const absolutePath = path.resolve(projectDir, relativePath);
        if (!fs.existsSync(absolutePath)) {
            errors.push(`Local library "${name}" not found at: ${relativePath}`);
        }
    }

    // Validate local toolchains
    for (const [name, relativePath] of Object.entries(deps.toolchains.local)) {
        const absolutePath = path.resolve(projectDir, relativePath);
        if (!fs.existsSync(absolutePath)) {
            errors.push(`Local toolchain "${name}" not found at: ${relativePath}`);
        }
    }

    return {
        valid: errors.length === 0,
        errors
    };
};

/**
 * Check if there are any remote toolchains that need downloading
 * @param {ParsedDependencies} deps - Parsed dependencies
 * @returns {boolean} True if there are remote toolchains
 */
const hasRemoteToolchains = deps => {
    return Object.keys(deps.toolchains.remote).length > 0;
};

/**
 * Get absolute paths for all local libraries (for arduino-cli --libraries)
 * @param {string} projectDir - Project directory path
 * @param {ParsedDependencies} deps - Parsed dependencies
 * @returns {string[]} Array of absolute library paths
 */
const getLibraryPaths = (projectDir, deps) => {
    const paths = [];

    for (const relativePath of Object.values(deps.libraries)) {
        const absolutePath = path.resolve(projectDir, relativePath);
        if (fs.existsSync(absolutePath)) {
            paths.push(absolutePath);
        }
    }

    return paths;
};

module.exports = {
    isLocalPath,
    parseDependencies,
    validateLocalDependencies,
    hasRemoteToolchains,
    getLibraryPaths
};

