/**
 * @fileoverview
 * Packages Index Fetcher for CLI dev command.
 * Fetches packages.json from Resource Service or directly from repository.
 */

const http = require('http');
const fetch = require('node-fetch');
const {RESOURCE_SERVICE_HOST, RESOURCE_SERVICE_PORT} = require('../config/resource-service');

// Cache TTL for packages.json
const PACKAGES_CACHE_TTL = 3600000; // 1 hour in ms

// Cached packages data
let cachedPackages = null;
let cacheTimestamp = 0;

/**
 * Fetch packages from Resource Service
 * @returns {Promise<object|null>} Combined packages data or null on error
 */
const fetchFromResourceService = () => new Promise(resolve => {
    const options = {
        hostname: RESOURCE_SERVICE_HOST,
        port: RESOURCE_SERVICE_PORT,
        path: '/api/repositories/packages',
        method: 'GET',
        timeout: 10000
    };

    const req = http.request(options, res => {
        let data = '';

        res.on('data', chunk => {
            data += chunk;
        });

        res.on('end', () => {
            if (res.statusCode === 200) {
                try {
                    const result = JSON.parse(data);
                    // Response is {success: true, data: {libraries: [], toolchains: []}}
                    if (result.success && result.data) {
                        resolve(result.data);
                    } else {
                        resolve(null);
                    }
                } catch (err) {
                    resolve(null);
                }
            } else {
                resolve(null);
            }
        });
    });

    req.on('error', () => {
        resolve(null);
    });

    req.on('timeout', () => {
        req.destroy();
        resolve(null);
    });

    req.end();
});

/**
 * Fetch packages.json directly from a registry URL
 * @param {string} registryUrl - URL to fetch packages.json from
 * @returns {Promise<object|null>} Packages data or null on error
 */
const fetchFromRegistry = async registryUrl => {
    try {
        const response = await fetch(registryUrl, {
            timeout: 30000,
            headers: {
                'Accept': 'application/json',
                'User-Agent': 'openblock-cli'
            }
        });

        if (!response.ok) {
            throw new Error(`HTTP ${response.status} ${response.statusText}`);
        }

        return response.json();
    } catch (err) {
        return null;
    }
};

/**
 * Get packages index, preferring Resource Service, fallback to direct fetch
 * @param {object} options - Options
 * @param {string} [options.registryUrl] - Optional direct registry URL
 * @param {boolean} [options.forceRefresh] - Force refresh from network
 * @returns {Promise<object>} Packages index with libraries and toolchains arrays
 */
const getPackagesIndex = async (options = {}) => {
    const {registryUrl, forceRefresh = false} = options;

    // Check memory cache
    if (!forceRefresh && cachedPackages && (Date.now() - cacheTimestamp < PACKAGES_CACHE_TTL)) {
        return cachedPackages;
    }

    let packages = null;

    // Try Resource Service first (if available)
    if (!registryUrl) {
        packages = await fetchFromResourceService();
    }

    // Fallback to direct registry fetch
    if (!packages && registryUrl) {
        const data = await fetchFromRegistry(registryUrl);
        if (data && data.packages) {
            packages = data.packages;
        }
    }

    // Default empty structure
    if (!packages) {
        packages = {
            devices: [],
            extensions: [],
            libraries: [],
            toolchains: []
        };
    }

    // Update cache
    cachedPackages = packages;
    cacheTimestamp = Date.now();

    return packages;
};

/**
 * Find a library in packages index
 * @param {object} packages - Packages index
 * @param {string} name - Library name/id
 * @returns {object|null} Library info or null
 */
const findLibrary = (packages, name) => {
    if (!packages.libraries || !Array.isArray(packages.libraries)) {
        return null;
    }
    return packages.libraries.find(lib => lib.id === name || lib.name === name) || null;
};

/**
 * Find a toolchain in packages index
 * @param {object} packages - Packages index
 * @param {string} name - Toolchain name/id
 * @returns {object|null} Toolchain info or null
 */
const findToolchain = (packages, name) => {
    if (!packages.toolchains || !Array.isArray(packages.toolchains)) {
        return null;
    }
    return packages.toolchains.find(tc => tc.id === name || tc.name === name) || null;
};

/**
 * Clear the packages cache
 */
const clearCache = () => {
    cachedPackages = null;
    cacheTimestamp = 0;
};

module.exports = {
    getPackagesIndex,
    fetchFromResourceService,
    fetchFromRegistry,
    findLibrary,
    findToolchain,
    clearCache,
    RESOURCE_SERVICE_HOST,
    RESOURCE_SERVICE_PORT
};
