/**
 * Configuration management
 * Reads and writes ~/.openblockrc
 */

const fs = require('fs');
const path = require('path');
const os = require('os');

const CONFIG_FILE = path.join(os.homedir(), '.openblockrc');

const CONFIG_KEYS = [
    'github-token',
    'registry'
];

/**
 * Read configuration file
 * @returns {object} Configuration object
 */
const readConfigFile = function () {
    try {
        if (fs.existsSync(CONFIG_FILE)) {
            const content = fs.readFileSync(CONFIG_FILE, 'utf-8');
            return JSON.parse(content);
        }
    } catch (e) {
        // Ignore errors, return empty config
    }
    return {};
};

/**
 * Write configuration file
 * @param {object} config - Configuration object
 */
const writeConfigFile = function (config) {
    try {
        fs.writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2), 'utf-8');
        // Set file permissions to user-only on Unix systems
        if (process.platform !== 'win32') {
            fs.chmodSync(CONFIG_FILE, 0o600);
        }
    } catch (e) {
        throw new Error(`Failed to write config file: ${e.message}`);
    }
};

/**
 * Get a configuration value
 * @param {string} key - Configuration key
 * @returns {string|undefined} Configuration value
 */
const getConfig = function (key) {
    const config = readConfigFile();
    return config[key];
};

/**
 * Set a configuration value
 * @param {string} key - Configuration key
 * @param {string} value - Configuration value
 */
const setConfig = function (key, value) {
    if (!CONFIG_KEYS.includes(key)) {
        throw new Error(`Unknown configuration key: ${key}. Valid keys: ${CONFIG_KEYS.join(', ')}`);
    }

    const config = readConfigFile();
    config[key] = value;
    writeConfigFile(config);
};

/**
 * Delete a configuration value
 * @param {string} key - Configuration key
 */
const deleteConfig = function (key) {
    const config = readConfigFile();
    delete config[key];
    writeConfigFile(config);
};

/**
 * List all configuration values
 * @returns {object} All configuration values
 */
const listConfig = function () {
    return readConfigFile();
};

module.exports = {
    CONFIG_KEYS,
    getConfig,
    setConfig,
    deleteConfig,
    listConfig
};
