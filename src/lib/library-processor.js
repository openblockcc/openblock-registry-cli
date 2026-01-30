/**
 * @fileoverview
 * Process libraries in plugin directory.
 *
 * Workflow:
 * 1. Scan libraries/ directory
 * 2. Check each library for library.properties
 * 3. Query Arduino Library Index for official libraries
 * 4. Extract official libraries as dependencies
 * 5. Keep private/third-party libraries in plugin
 */

const fs = require('fs');
const path = require('path');
const {isArduinoLibrary, getLibraryInfo} = require('./library-properties-parser');
const {findLibrary, isOfficialLibrary} = require('./arduino-index');

/**
 * Library classification result
 * @typedef {object} LibraryClassification
 * @property {string} name - Library name
 * @property {string} version - Library version
 * @property {string} type - 'official' | 'third-party' | 'private'
 * @property {string} path - Library directory path
 * @property {object|null} officialInfo - Arduino index info if official
 */

/**
 * Classify a single library
 * @param {string} libPath - Library directory path
 * @param {string} dirName - Directory name
 * @returns {Promise<LibraryClassification>} Classification result
 */
const classifyLibrary = async (libPath, dirName) => {
    // Check if it has library.properties
    if (!isArduinoLibrary(libPath)) {
        // No library.properties = private library
        return {
            name: dirName,
            version: null,
            type: 'private',
            path: libPath,
            officialInfo: null
        };
    }

    const libInfo = getLibraryInfo(libPath);

    // Query Arduino Library Index
    const officialLib = await findLibrary(libInfo.name, libInfo.version);

    if (officialLib) {
        // Exact version match in Arduino index
        return {
            name: libInfo.name,
            version: libInfo.version,
            type: 'official',
            path: libPath,
            officialInfo: officialLib
        };
    }

    // Check if library exists at all (any version)
    const isOfficial = await isOfficialLibrary(libInfo.name);

    if (isOfficial) {
        // Library exists but version doesn't match
        return {
            name: libInfo.name,
            version: libInfo.version,
            type: 'official-version-mismatch',
            path: libPath,
            officialInfo: null
        };
    }

    // Has library.properties but not in Arduino index = third-party
    return {
        name: libInfo.name,
        version: libInfo.version,
        type: 'third-party',
        path: libPath,
        officialInfo: null
    };
};

/**
 * Scan and classify libraries in a plugin directory
 * @param {string} pluginDir - Plugin directory path
 * @returns {Promise<LibraryClassification[]>} Classified libraries
 */
const scanLibraries = async pluginDir => {
    const librariesDir = path.join(pluginDir, 'libraries');
    const results = [];

    if (!fs.existsSync(librariesDir)) {
        return results;
    }

    const entries = fs.readdirSync(librariesDir, {withFileTypes: true});

    for (const entry of entries) {
        if (!entry.isDirectory()) {
            continue;
        }

        const libPath = path.join(librariesDir, entry.name);
        const classification = await classifyLibrary(libPath, entry.name);
        results.push(classification);
    }

    return results;
};

/**
 * Process libraries for publishing
 * Extract official libraries as dependencies, keep others in plugin
 * @param {string} pluginDir - Plugin directory path
 * @returns {Promise<object>} Processing result with dependencies and kept libraries
 */
const processLibrariesForPublish = async pluginDir => {
    const libraries = await scanLibraries(pluginDir);

    const result = {
        dependencies: {
            libraries: {}
        },
        kept: [],
        extracted: [],
        warnings: []
    };

    for (const lib of libraries) {
        if (lib.type === 'official') {
            // Extract as dependency
            result.dependencies.libraries[lib.name] = lib.version;
            result.extracted.push(lib);
            console.log(`[OK] ${lib.name}@${lib.version} -> shared dependency (Arduino official)`);
        } else if (lib.type === 'official-version-mismatch') {
            // Keep in plugin but warn
            result.kept.push(lib);
            result.warnings.push(
                `[WARN] ${lib.name}@${lib.version} version not found in Arduino official library, kept in plugin`
            );
            console.log(`[WARN] ${lib.name}@${lib.version} -> kept in plugin (version mismatch)`);
        } else if (lib.type === 'third-party') {
            // Keep in plugin
            result.kept.push(lib);
            console.log(`[INFO] ${lib.name}@${lib.version} -> kept in plugin (third-party library)`);
        } else {
            // Private library
            result.kept.push(lib);
            console.log(`[INFO] ${lib.name} -> kept in plugin (private library)`);
        }
    }

    return result;
};

module.exports = {
    scanLibraries,
    classifyLibrary,
    processLibrariesForPublish
};
