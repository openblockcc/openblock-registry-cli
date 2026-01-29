/**
 * @fileoverview
 * Query Arduino Library Index to check if a library is official.
 *
 * Arduino Library Index URL:
 * https://downloads.arduino.cc/libraries/library_index.json
 */

const fetch = require('node-fetch');

const ARDUINO_LIBRARY_INDEX_URL = 'https://downloads.arduino.cc/libraries/library_index.json';

// Cache for the library index
let libraryIndexCache = null;
let cacheTimestamp = 0;
const CACHE_TTL = 3600000; // 1 hour in milliseconds

/**
 * Fetch Arduino Library Index
 * @param {boolean} forceRefresh - Force refresh the cache
 * @returns {Promise<object>} Library index data
 */
const fetchLibraryIndex = async (forceRefresh = false) => {
    const now = Date.now();

    // Return cached data if still valid
    if (!forceRefresh && libraryIndexCache && (now - cacheTimestamp) < CACHE_TTL) {
        return libraryIndexCache;
    }

    console.log('Fetching Arduino Library Index...');

    const response = await fetch(ARDUINO_LIBRARY_INDEX_URL, {
        timeout: 30000
    });

    if (!response.ok) {
        throw new Error(`Failed to fetch Arduino Library Index: ${response.status}`);
    }

    const data = await response.json();
    libraryIndexCache = data;
    cacheTimestamp = now;

    console.log(`Loaded ${data.libraries ? data.libraries.length : 0} libraries from Arduino Index`);

    return data;
};

/**
 * Find a library in the Arduino Library Index
 * @param {string} name - Library name
 * @param {string} version - Optional specific version
 * @returns {Promise<object|null>} Library info or null if not found
 */
const findLibrary = async (name, version = null) => {
    const index = await fetchLibraryIndex();

    if (!index.libraries || !Array.isArray(index.libraries)) {
        return null;
    }

    // Find all versions of the library
    const matches = index.libraries.filter(lib => lib.name === name);

    if (matches.length === 0) {
        return null;
    }

    if (version) {
        // Find specific version
        const exactMatch = matches.find(lib => lib.version === version);
        return exactMatch || null;
    }

    // Return the latest version (last in the array)
    return matches[matches.length - 1];
};

/**
 * Check if a library exists in Arduino official index
 * @param {string} name - Library name
 * @returns {Promise<boolean>} True if library exists
 */
const isOfficialLibrary = async name => {
    const lib = await findLibrary(name);
    return lib !== null;
};

/**
 * Get all versions of a library
 * @param {string} name - Library name
 * @returns {Promise<string[]>} Array of version strings
 */
const getLibraryVersions = async name => {
    const index = await fetchLibraryIndex();

    if (!index.libraries || !Array.isArray(index.libraries)) {
        return [];
    }

    return index.libraries
        .filter(lib => lib.name === name)
        .map(lib => lib.version);
};

/**
 * Get download URL for a library version
 * @param {string} name - Library name
 * @param {string} version - Library version
 * @returns {Promise<string|null>} Download URL or null
 */
const getDownloadUrl = async (name, version) => {
    const lib = await findLibrary(name, version);
    return lib ? lib.url : null;
};

module.exports = {
    fetchLibraryIndex,
    findLibrary,
    isOfficialLibrary,
    getLibraryVersions,
    getDownloadUrl,
    ARDUINO_LIBRARY_INDEX_URL
};
