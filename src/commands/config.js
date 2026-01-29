/**
 * Config command
 * Manages CLI configuration
 */

const chalk = require('chalk');
const {getConfig, setConfig, listConfig, CONFIG_KEYS} = require('../utils/config');
const logger = require('../utils/logger');

/**
 * Mask a token for display
 * @param {string} token - Token to mask
 * @returns {string} Masked token
 */
const maskToken = function (token) {
    if (!token || token.length < 8) return '****';
    return `${token.substring(0, 4)}...${token.substring(token.length - 4)}`;
};

/**
 * Execute config command
 * @param {string} action - Action to perform (get/set/list)
 * @param {string} key - Configuration key
 * @param {string} value - Configuration value (for set action)
 */
const config = async (action, key, value) => {
    try {
        switch (action) {
        case 'get': {
            if (!key) {
                console.log(chalk.red('Error: key is required for get action'));
                console.log(`Usage: openblock-cli config get <key>`);
                console.log(`Available keys: ${CONFIG_KEYS.join(', ')}`);
                process.exit(1);
            }
            const val = getConfig(key);
            if (val) {
                // Mask sensitive values
                const displayVal = key === 'github-token' ? maskToken(val) : val;
                console.log(`${key}: ${displayVal}`);
            } else {
                console.log(`${key}: (not set)`);
            }
            break;
        }

        case 'set': {
            if (!key || typeof value === 'undefined') {
                console.log(chalk.red('Error: key and value are required for set action'));
                console.log(`Usage: openblock-cli config set <key> <value>`);
                console.log(`Available keys: ${CONFIG_KEYS.join(', ')}`);
                process.exit(1);
            }
            setConfig(key, value);
            console.log(chalk.green(`✅ ${key} has been set`));
            break;
        }

        case 'list': {
            console.log(chalk.cyan('\n📋 Current Configuration\n'));
            const allConfig = listConfig();
            if (Object.keys(allConfig).length === 0) {
                console.log('   (no configuration set)');
            } else {
                Object.entries(allConfig).forEach(([k, v]) => {
                    const displayVal = k === 'github-token' ? maskToken(v) : v;
                    console.log(`   ${k}: ${displayVal}`);
                });
            }
            console.log('');
            break;
        }

        default:
            console.log(chalk.red(`Unknown action: ${action}`));
            console.log(`Available actions: get, set, list`);
            process.exit(1);
        }
    } catch (error) {
        logger.error(error);
        process.exit(1);
    }
};

module.exports = config;
