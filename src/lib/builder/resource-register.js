/**
 * Resource Service registration
 * Registers extension/device to local OpenBlock Resource Service for development
 */

const http = require('http');
const fs = require('fs');
const path = require('path');

const RESOURCE_SERVICE_HOST = 'localhost';
const RESOURCE_SERVICE_PORT = 20112;

/**
 * Check if Resource Service is running
 * @returns {Promise<{running: boolean, message: string}>} Service status
 */
const checkResourceService = () => new Promise(resolve => {
    const options = {
        hostname: RESOURCE_SERVICE_HOST,
        port: RESOURCE_SERVICE_PORT,
        path: '/',
        method: 'GET',
        timeout: 3000
    };

    const req = http.request(options, res => {
        let data = '';
        res.on('data', chunk => {
            data += chunk;
        });
        res.on('end', () => {
            try {
                const json = JSON.parse(data);
                // Check for openblock-resource-server (the actual server name)
                if (json.name === 'openblock-resource-server') {
                    resolve({running: true, message: 'Resource Service is running'});
                } else {
                    resolve({
                        running: false,
                        message: `Port ${RESOURCE_SERVICE_PORT} is in use by another service ` +
                            `(${json.name || 'unknown'})`
                    });
                }
            } catch {
                resolve({
                    running: false,
                    message: `Invalid response from port ${RESOURCE_SERVICE_PORT}`
                });
            }
        });
    });

    req.on('error', error => {
        if (error.code === 'ECONNREFUSED') {
            resolve({
                running: false,
                message: `Resource Service not running at ${RESOURCE_SERVICE_HOST}:${RESOURCE_SERVICE_PORT}`
            });
        } else {
            resolve({
                running: false,
                message: `Cannot connect to Resource Service: ${error.message}`
            });
        }
    });

    req.on('timeout', () => {
        req.destroy();
        resolve({
            running: false,
            message: `Connection to Resource Service timed out`
        });
    });

    req.end();
});

/**
 * Register extension/device to Resource Service
 * @param {string} projectDir - Project directory
 * @param {string} distDir - Built dist directory path
 * @returns {Promise<{success: boolean, message: string}>} Promise resolving to registration result
 */
const registerToResourceService = (projectDir, distDir) => new Promise(resolve => {
    try {
        // Read package.json to get extension/device info
        const packageJsonPath = path.join(projectDir, 'package.json');
        if (!fs.existsSync(packageJsonPath)) {
            resolve({success: false, message: 'package.json not found'});
            return;
        }

        const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf-8'));
        const openblockConfig = packageJson.openblock || {};

        // Determine type and name based on extensionId or deviceId
        let type;
        let name;
        if (openblockConfig.extensionId) {
            type = 'extensions';
            name = openblockConfig.extensionId;
        } else if (openblockConfig.deviceId) {
            type = 'devices';
            name = openblockConfig.deviceId;
        } else {
            resolve({success: false, message: 'No extensionId or deviceId found in package.json'});
            return;
        }

        // Get absolute path to dist directory
        const absoluteDistPath = path.resolve(distDir);

        const requestBody = {
            type,
            name,
            target: absoluteDistPath
        };

        const postData = JSON.stringify(requestBody);

        const options = {
            hostname: RESOURCE_SERVICE_HOST,
            port: RESOURCE_SERVICE_PORT,
            path: '/api/dev/link',
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Content-Length': Buffer.byteLength(postData)
            }
        };

        const req = http.request(options, res => {
            let data = '';

            res.on('data', chunk => {
                data += chunk;
            });

            res.on('end', () => {
                if (res.statusCode === 200) {
                    resolve({
                        success: true,
                        message: `Registered ${type.slice(0, -1)} "${name}" at ${absoluteDistPath}`
                    });
                } else {
                    resolve({
                        success: false,
                        message: `Failed to register: ${res.statusCode} ${data}`
                    });
                }
            });
        });

        req.on('error', error => {
            if (error.code === 'ECONNREFUSED') {
                resolve({
                    success: false,
                    message: `Resource Service not running at ${RESOURCE_SERVICE_HOST}:${RESOURCE_SERVICE_PORT}`
                });
            } else {
                resolve({
                    success: false,
                    message: `Registration error: ${error.message}`
                });
            }
        });

        req.write(postData);
        req.end();
    } catch (error) {
        resolve({
            success: false,
            message: `Registration error: ${error.message}`
        });
    }
});

/**
 * Merge a toolchain to unified directory via Resource Service.
 * @param {string} platform - Platform type ('arduino' or 'micropython')
 * @param {string} sourcePath - Path to the extracted toolchain
 * @returns {Promise<{success: boolean, merged: number, skipped: number, message: string}>} Merge result
 */
const mergeToolchain = (platform, sourcePath) => new Promise(resolve => {
    try {
        const requestBody = {
            platform,
            sourcePath
        };

        const postData = JSON.stringify(requestBody);

        const options = {
            hostname: RESOURCE_SERVICE_HOST,
            port: RESOURCE_SERVICE_PORT,
            path: '/api/dev/merge-toolchain',
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Content-Length': Buffer.byteLength(postData)
            }
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
                        resolve({
                            success: true,
                            merged: result.merged || 0,
                            skipped: result.skipped || 0,
                            message: `Merged toolchain from ${sourcePath}`
                        });
                    } catch {
                        resolve({
                            success: true,
                            merged: 0,
                            skipped: 0,
                            message: `Merged toolchain from ${sourcePath}`
                        });
                    }
                } else {
                    resolve({
                        success: false,
                        merged: 0,
                        skipped: 0,
                        message: `Failed to merge toolchain: ${res.statusCode} ${data}`
                    });
                }
            });
        });

        req.on('error', error => {
            if (error.code === 'ECONNREFUSED') {
                resolve({
                    success: false,
                    merged: 0,
                    skipped: 0,
                    message: `Resource Service not running at ${RESOURCE_SERVICE_HOST}:${RESOURCE_SERVICE_PORT}`
                });
            } else {
                resolve({
                    success: false,
                    merged: 0,
                    skipped: 0,
                    message: `Toolchain merge error: ${error.message}`
                });
            }
        });

        req.write(postData);
        req.end();
    } catch (error) {
        resolve({
            success: false,
            merged: 0,
            skipped: 0,
            message: `Toolchain merge error: ${error.message}`
        });
    }
});

/**
 * Merge multiple toolchains to unified directory via Resource Service.
 * @param {Array<{name: string, extractPath: string}>} toolchainResults - Toolchain fetch results with extractPath
 * @returns {Promise<{success: boolean, merged: number, errors: string[]}>} Merge results
 */
const registerToolchainMerge = async toolchainResults => {
    let totalMerged = 0;
    const errors = [];

    for (const tc of toolchainResults) {
        if (!tc.extractPath) continue;

        // Determine platform from toolchain name (e.g., 'arduino-arduino-avr' -> 'arduino')
        const platform = tc.name.startsWith('micropython') ? 'micropython' : 'arduino';

        const result = await mergeToolchain(platform, tc.extractPath);
        if (result.success) {
            totalMerged += result.merged;
        } else {
            errors.push(`${tc.name}: ${result.message}`);
        }
    }

    return {
        success: errors.length === 0,
        merged: totalMerged,
        errors
    };
};

module.exports = {
    checkResourceService,
    registerToResourceService,
    mergeToolchain,
    registerToolchainMerge,
    RESOURCE_SERVICE_HOST,
    RESOURCE_SERVICE_PORT
};
