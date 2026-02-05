/**
 * @fileoverview
 * Toolchain resolver for CLI dev command.
 *
 * Simplified architecture:
 * - Toolchains: Only support remote toolchain name (downloads latest version)
 * - Libraries: No longer handled here (automatically discovered by build tools)
 */

const fs = require('fs');
const path = require('path');

/**
 * @typedef {Object} ParsedToolchain
 * @property {string|null} toolchain - Toolchain name or null if not defined
 */

/**
 * Parse toolchain from package.json
 * Reads openblock.toolchains field which should be a string (toolchain name).
 *
 * @param {string} projectDir - Project directory path
 * @returns {ParsedToolchain} Parsed toolchain
 */
const parseToolchain = projectDir => {
    const packageJsonPath = path.join(projectDir, 'package.json');

    if (!fs.existsSync(packageJsonPath)) {
        throw new Error('package.json not found');
    }

    const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf-8'));
    const openblockConfig = packageJson.openblock || {};

    // Read toolchains field (string or undefined)
    const toolchainSpec = openblockConfig.toolchains;

    if (!toolchainSpec) {
        return {toolchain: null};
    }

    if (typeof toolchainSpec !== 'string') {
        throw new Error('openblock.toolchains must be a string (toolchain name)');
    }

    return {toolchain: toolchainSpec};
};

module.exports = {
    parseToolchain
};
