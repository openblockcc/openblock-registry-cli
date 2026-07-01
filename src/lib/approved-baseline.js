/**
 * Build the local display-freeze baseline and compare it to the one currently
 * committed in the registry, so `publish` knows whether it must open a
 * baseline-update PR (§5.9).
 *
 * Pure display changes (rename, new icon, edited description) need a human-
 * reviewed PR that updates approved/{id}.json; pure functional updates (display
 * unchanged) need no PR at all and keep flowing automatically from git tags.
 */

const path = require('path');
const fs = require('fs');
const fetch = require('node-fetch');

const {extractDisplay, listIconFields, hashIconBytes, buildApprovedRecord} = require('./display-manifest');

const REGISTRY_RAW_BASE = 'https://raw.githubusercontent.com/openblockcc/openblock-registry/main';

/**
 * Build the approved record for the plugin in `pluginDir` from its package.json,
 * hashing local icon bytes. Also returns the icon files to commit for reviewer
 * image diffs.
 * @param {object} packageInfo - Parsed package.json (root + openblock)
 * @param {string} repoUrl - Canonical repository URL
 * @param {string} pluginDir - Plugin root directory (icons resolve against it)
 * @returns {{record: object, iconFiles: Array<{repoPath: string, content: Buffer}>}} Baseline + icon files
 */
const buildLocalApproved = (packageInfo, repoUrl, pluginDir) => {
    const openblock = packageInfo.openblock || {};
    const id = openblock.deviceId || openblock.extensionId;
    const type = openblock.deviceId ? 'devices' : 'extensions';

    const icons = {};
    const iconFiles = [];
    for (const {field, value} of listIconFields(packageInfo)) {
        if (value.startsWith('http://') || value.startsWith('https://') || value.startsWith('data:')) {
            continue;
        }
        const iconPath = path.resolve(pluginDir, value.replace(/^\.\//, ''));
        if (!fs.existsSync(iconPath)) {
            continue;
        }
        const content = fs.readFileSync(iconPath);
        icons[field] = hashIconBytes(content);
        iconFiles.push({repoPath: `approved/${id}.${field}${path.extname(iconPath)}`, content});
    }

    const display = extractDisplay(packageInfo);
    const record = buildApprovedRecord({id, type, repository: repoUrl, display, icons});
    return {record, iconFiles};
};

/**
 * Fetch the registry's currently-committed approved baseline for an id.
 * @param {string} id - Plugin id
 * @returns {Promise<object|null>} Approved record, or null if none exists yet
 */
const fetchRegistryApproved = async id => {
    try {
        const response = await fetch(`${REGISTRY_RAW_BASE}/approved/${id}.json`);
        if (response.status === 404 || !response.ok) {
            return null;
        }
        return await response.json();
    } catch (err) {
        return null;
    }
};

/**
 * Decide whether the committed baseline needs updating.
 * @param {object} local - Locally built approved record
 * @param {object|null} remote - Registry's committed approved record (or null)
 * @returns {boolean} True if a baseline-update PR is required
 */
const approvedNeedsUpdate = (local, remote) => !remote || remote.displayHash !== local.displayHash;

/**
 * Resolve the full baseline plan for a publish: local record, icon files, and
 * whether the registry baseline must be updated via PR.
 * @param {object} packageInfo - Parsed package.json
 * @param {string} repoUrl - Canonical repository URL
 * @param {string} pluginDir - Plugin root directory
 * @returns {Promise<{id: string, record: object, iconFiles: Array, needsUpdate: boolean}>} Plan
 */
const resolveApprovedPlan = async (packageInfo, repoUrl, pluginDir) => {
    const {record, iconFiles} = buildLocalApproved(packageInfo, repoUrl, pluginDir);
    const remote = await fetchRegistryApproved(record.id);
    return {
        id: record.id,
        record,
        iconFiles,
        needsUpdate: approvedNeedsUpdate(record, remote)
    };
};

module.exports = {
    REGISTRY_RAW_BASE,
    buildLocalApproved,
    fetchRegistryApproved,
    approvedNeedsUpdate,
    resolveApprovedPlan
};
