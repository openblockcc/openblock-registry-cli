/**
 * Logger utility
 * Provides formatted logging output
 */

const chalk = require('chalk');

/**
 * Log levels
 */
const LEVELS = {
    DEBUG: 0,
    INFO: 1,
    WARN: 2,
    ERROR: 3
};

// Current log level (can be set via environment variable)
let currentLevel = process.env.OPENBLOCK_LOG_LEVEL ?
    LEVELS[process.env.OPENBLOCK_LOG_LEVEL.toUpperCase()] || LEVELS.INFO :
    LEVELS.INFO;

/**
 * Set log level
 * @param {string} level - Log level name
 */
const setLevel = function (level) {
    const upperLevel = level.toUpperCase();
    if (typeof LEVELS[upperLevel] !== 'undefined') {
        currentLevel = LEVELS[upperLevel];
    }
};

/**
 * Log debug message
 * @param {...any} args - Arguments to log
 */
const debug = function (...args) {
    if (currentLevel <= LEVELS.DEBUG) {
        console.log(chalk.gray('[DEBUG]'), ...args);
    }
};

/**
 * Log info message
 * @param {...any} args - Arguments to log
 */
const info = function (...args) {
    if (currentLevel <= LEVELS.INFO) {
        console.log(chalk.blue('[INFO]'), ...args);
    }
};

/**
 * Log warning message
 * @param {...any} args - Arguments to log
 */
const warn = function (...args) {
    if (currentLevel <= LEVELS.WARN) {
        console.log(chalk.yellow('[WARN]'), ...args);
    }
};

/**
 * Log error message
 * @param {Error|string} err - Error or message to log
 */
const error = function (err) {
    if (currentLevel <= LEVELS.ERROR) {
        if (err instanceof Error) {
            console.error(chalk.red('[ERROR]'), err.message);
            if (currentLevel === LEVELS.DEBUG && err.stack) {
                console.error(chalk.gray(err.stack));
            }
        } else {
            console.error(chalk.red('[ERROR]'), err);
        }
    }
};

/**
 * Log success message
 * @param {...any} args - Arguments to log
 */
const success = function (...args) {
    console.log(chalk.green('[OK]'), ...args);
};

/**
 * Log failure message
 * @param {...any} args - Arguments to log
 */
const fail = function (...args) {
    console.log(chalk.red('[FAIL]'), ...args);
};

module.exports = {
    setLevel,
    debug,
    info,
    warn,
    error,
    success,
    fail
};
