/**
 * @fileoverview
 * OB Registry Fetcher for CLI dev command.
 * Downloads toolchains from repository's packages.json and merges to unified toolchains directory.
 *
 * Simplified architecture:
 * - Only supports 'latest' version
 * - Downloads to temp directory, then merges to toolchains/arduino/packages/
 * - Uses ToolchainMerger for merging logic
 */

const fs = require('fs-extra');
const path = require('path');
const crypto = require('crypto');
const fetch = require('node-fetch');
const AdmZip = require('adm-zip');

const {getPackagesIndex, findToolchain} = require('./packages-index');

// Toolchains directory (relative to project) - for extracted toolchains
const TOOLCHAINS_DIR = '.openblock/toolchains';
// Download cache directory (relative to project) - for archive files
const DOWNLOAD_CACHE_DIR = '.openblock/downloads';

/**
 * Get host string for matching systems array
 * Uses simple platform-arch format: win32-x64, darwin-arm64, linux-x64, etc.
 * @returns {string} Host identifier
 */
const getHostString = () => `${process.platform}-${process.arch}`;

/**
 * Find matching system entry from systems array
 * @param {object[]} systems - Array of system entries with host field
 * @returns {object|null} Matching system entry or null
 */
const findMatchingSystem = systems => {
    if (!systems || !Array.isArray(systems)) {
        return null;
    }

    const hostString = getHostString();

    // Exact match only
    return systems.find(s => s.host === hostString) || null;
};

/**
 * Get the latest version from toolchain info.
 * Only 'latest' is supported in the simplified architecture.
 * @param {object} toolchainInfo - Toolchain info from packages.json
 * @returns {object|null} Version entry or null
 */
const getLatestVersion = toolchainInfo => {
    if (!toolchainInfo) {
        return null;
    }

    // Support single version format: { id, version, systems, ... }
    if (toolchainInfo.version && !toolchainInfo.versions) {
        return {
            version: toolchainInfo.version,
            systems: toolchainInfo.systems,
            url: toolchainInfo.url,
            checksum: toolchainInfo.checksum,
            archiveFileName: toolchainInfo.archiveFileName,
            size: toolchainInfo.size
        };
    }

    // Support versions array format: { id, versions: [...] }
    if (toolchainInfo.versions && Array.isArray(toolchainInfo.versions) && toolchainInfo.versions.length > 0) {
        // Return the first (latest) version
        return toolchainInfo.versions[0];
    }

    return null;
};

/**
 * Verify SHA256 checksum of a buffer
 * @param {Buffer} buffer - Buffer to verify
 * @param {string} expectedHash - Expected SHA256 hash
 * @returns {boolean} True if checksum matches
 */
const verifyChecksum = (buffer, expectedHash) => {
    if (!expectedHash) return true; // Skip if no checksum provided

    const actualHash = crypto.createHash('sha256').update(buffer)
        .digest('hex');
    return actualHash.toLowerCase() === expectedHash.toLowerCase();
};

/**
 * Format bytes to human readable string
 * @param {number} bytes - Bytes to format
 * @returns {string} Formatted string like "1.5 MB"
 */
const formatBytes = bytes => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
};

/**
 * Download and extract a toolchain with progress display
 * @param {string} url - Download URL
 * @param {string} destDir - Destination directory for extracted files
 * @param {string} cacheDir - Directory to store downloaded archive
 * @param {object} options - Options
 * @param {string} [options.sha256] - Expected SHA256 checksum
 * @param {string} [options.archiveFileName] - Archive file name
 * @param {number} [options.size] - Expected file size for progress display
 * @param {Function} [options.onProgress] - Progress callback (percent, speed, downloaded, total)
 * @param {Function} [options.onStatus] - Status callback (status: 'downloading'|'verifying'|'extracting')
 * @returns {Promise<void>} Download and extraction result
 */
const downloadAndExtract = async (url, destDir, cacheDir, options = {}) => {
    // Use archiveFileName or fallback to temp name
    const fileName = options.archiveFileName || '_temp_download.zip';
    const archivePath = path.join(cacheDir, fileName);
    await fs.ensureDir(cacheDir);

    let needDownload = true;

    // Check if archive already exists and verify checksum
    if (options.sha256 && await fs.pathExists(archivePath)) {
        if (options.onStatus) {
            options.onStatus('verifying');
        }
        const existingBuffer = await fs.readFile(archivePath);
        if (verifyChecksum(existingBuffer, options.sha256)) {
            // Archive exists and checksum matches, skip download
            needDownload = false;
        }
    }

    if (needDownload) {
        const response = await fetch(url);

        if (!response.ok) {
            throw new Error(`Failed to download from ${url}: ${response.status} ${response.statusText}`);
        }

        // Get total size from options or response header
        const totalSize = options.size ?
            parseInt(options.size, 10) :
            parseInt(response.headers.get('content-length') || '0', 10);

        // Download with progress
        const chunks = [];
        let downloadedSize = 0;
        const startTime = Date.now();

        if (options.onStatus) {
            options.onStatus('downloading');
        }

        for await (const chunk of response.body) {
            chunks.push(chunk);
            downloadedSize += chunk.length;

            if (options.onProgress && totalSize > 0) {
                const elapsed = (Date.now() - startTime) / 1000;
                const speed = elapsed > 0 ? downloadedSize / elapsed : 0;
                const percent = Math.round((downloadedSize / totalSize) * 100);
                options.onProgress(
                    percent, `${formatBytes(speed)}/s`, formatBytes(downloadedSize), formatBytes(totalSize)
                );
            }
        }

        const buffer = Buffer.concat(chunks);

        // Verify checksum
        if (options.sha256) {
            if (options.onStatus) {
                options.onStatus('verifying');
            }
            if (!verifyChecksum(buffer, options.sha256)) {
                throw new Error(`Checksum verification failed for ${url}`);
            }
        }

        // Write archive to cache directory
        await fs.writeFile(archivePath, buffer);
    }

    // Extract
    if (options.onStatus) {
        options.onStatus('extracting');
    }

    const zip = new AdmZip(archivePath);

    // Use atomic extraction: extract to temp dir first, then rename
    // This ensures incomplete extraction won't leave corrupted directory
    const tempExtractDir = `${destDir}.extracting`;

    try {
        // Clean up any previous failed extraction
        await fs.remove(tempExtractDir);
        await fs.ensureDir(tempExtractDir);

        // Extract to temp directory
        zip.extractAllTo(tempExtractDir, true);

        // Extraction successful, atomically replace destination
        await fs.remove(destDir);
        await fs.move(tempExtractDir, destDir);
    } catch (err) {
        // Cleanup temp dir on failure
        await fs.remove(tempExtractDir);
        throw err;
    }
};

/**
 * @typedef {Object} FetchResult
 * @property {boolean} success - Whether the fetch was successful
 * @property {string} name - Toolchain name
 * @property {string} version - Resolved version
 * @property {string} [extractPath] - Path to the extracted toolchain (for merging)
 * @property {string} [error] - Error message if failed
 * @property {boolean} [skipped] - True if toolchain already exists
 */

/**
 * Fetch and extract a single toolchain to temp directory.
 * The extracted toolchain can then be merged using ToolchainMerger.
 *
 * @param {string} projectDir - Project directory
 * @param {string} name - Toolchain name
 * @param {object} options - Options
 * @param {Function} [options.onDownloadProgress] - Download progress callback
 * @param {Function} [options.onStatus] - Status callback
 * @param {Function} [options.hasToolchain] - Function to check if toolchain exists
 * @returns {Promise<FetchResult>} Fetch result
 */
const fetchToolchain = async (projectDir, name, options = {}) => {
    const extractDir = path.join(projectDir, TOOLCHAINS_DIR, name);

    try {
        // Check if toolchain already exists in local extract directory
        if (await fs.pathExists(extractDir)) {
            const files = await fs.readdir(extractDir);
            if (files.length > 0) {
                // Toolchain already extracted, skip download
                return {
                    success: true,
                    name,
                    version: 'latest',
                    skipped: true,
                    extractPath: extractDir
                };
            }
        }

        // Also check using provided checker (for Resource Service cache)
        if (options.hasToolchain && options.hasToolchain(name)) {
            return {
                success: true,
                name,
                version: 'latest',
                skipped: true
            };
        }

        // Fetch packages index from Resource Service or repository
        const packages = await getPackagesIndex();
        const toolchainInfo = findToolchain(packages, name);

        if (!toolchainInfo) {
            return {
                success: false,
                name,
                version: 'latest',
                error: `Toolchain "${name}" not found in packages.json. ` +
                       `Make sure Resource Service is running and the toolchain is available in an enabled repository.`
            };
        }

        // Get latest version only
        const versionEntry = getLatestVersion(toolchainInfo);
        if (!versionEntry) {
            return {
                success: false,
                name,
                version: 'latest',
                error: `No version available for toolchain "${name}"`
            };
        }

        const version = versionEntry.version;

        // Get platform-specific download info
        // Priority: systems array > platforms object > direct url field
        let downloadUrl;
        let sha256;
        let archiveFileName;
        let size;

        // Try systems array format (Arduino-style with host field)
        if (versionEntry.systems && Array.isArray(versionEntry.systems)) {
            const systemEntry = findMatchingSystem(versionEntry.systems);
            if (systemEntry) {
                downloadUrl = systemEntry.url;
                sha256 = systemEntry.checksum;
                archiveFileName = systemEntry.archiveFileName;
                size = systemEntry.size;
            }
        }

        // Try platforms object format (using process.platform as key)
        if (!downloadUrl && versionEntry.platforms) {
            const platformEntry = versionEntry.platforms[process.platform];
            if (platformEntry) {
                downloadUrl = platformEntry.downloadUrl || platformEntry.url;
                sha256 = platformEntry.checksum || platformEntry.sha256;
                archiveFileName = platformEntry.archiveFileName;
                size = platformEntry.size;
            }
        }

        // Try direct url field
        if (!downloadUrl && versionEntry.url) {
            downloadUrl = versionEntry.url;
            sha256 = versionEntry.checksum;
            archiveFileName = versionEntry.archiveFileName;
            size = versionEntry.size;
        }

        if (!downloadUrl) {
            const hostString = getHostString();
            return {
                success: false,
                name,
                version,
                error: `No download URL for ${name}@${version} on ${hostString}`
            };
        }

        // Parse checksum - handle "SHA-256:hash" format
        if (sha256 && sha256.includes(':')) {
            sha256 = sha256.split(':')[1];
        }

        // Download cache directory for archives
        const cacheDir = path.join(projectDir, DOWNLOAD_CACHE_DIR);

        // Download and extract to toolchains directory
        await downloadAndExtract(downloadUrl, extractDir, cacheDir, {
            sha256,
            archiveFileName,
            size,
            onProgress: options.onDownloadProgress,
            onStatus: options.onStatus
        });

        return {
            success: true,
            name,
            version,
            extractPath: extractDir
        };
    } catch (error) {
        return {
            success: false,
            name,
            version: 'latest',
            error: error.message
        };
    }
};

/**
 * Fetch a single toolchain or multiple toolchains.
 * Downloads and extracts to temp directory for later merging.
 *
 * @param {string} projectDir - Project directory
 * @param {string|string[]} toolchains - Toolchain name or array of names
 * @param {object} options - Options
 * @param {Function} [options.onProgress] - Progress callback (name, status, result)
 * @param {Function} [options.hasToolchain] - Function to check if toolchain exists
 * @returns {Promise<{success: boolean, results: FetchResult[]}>} Fetch results
 */
const fetchAllToolchains = async (projectDir, toolchains, options = {}) => {
    const results = [];

    // Normalize input to array of names
    let names = [];
    if (typeof toolchains === 'string') {
        // Single toolchain name
        names = [toolchains];
    } else if (Array.isArray(toolchains)) {
        // Array of names
        names = toolchains;
    } else {
        throw new Error('toolchains must be a string or array of strings');
    }

    for (const name of names) {
        if (options.onProgress) {
            options.onProgress(name, 'fetching', null);
        }

        const result = await fetchToolchain(projectDir, name, options);
        results.push(result);

        if (options.onProgress) {
            options.onProgress(name, result.success ? 'done' : 'error', result);
        }
    }

    const allSuccess = results.every(r => r.success);
    return {success: allSuccess, results};
};

module.exports = {
    getLatestVersion,
    verifyChecksum,
    fetchToolchain,
    fetchAllToolchains,
    getHostString,
    findMatchingSystem,
    formatBytes,
    TOOLCHAINS_DIR,
    DOWNLOAD_CACHE_DIR
};
