/**
 * check-display command
 * Compares the plugin's local display channel (name/description/icons/...) against
 * the frozen baseline committed in the registry (approved/{id}.json), without any
 * GitHub token or network writes. Designed for the husky pre-push hook: it only
 * reminds — it never blocks the push.
 *
 * Exit codes (consumed by the hook):
 *   0  display unchanged, nothing to do — or could not check (offline / no id)
 *   1  display changed vs the approved baseline → developer should run `publish`
 */

const path = require('path');
const fs = require('fs');
const chalk = require('chalk');
const fetch = require('node-fetch');

const {REGISTRY_RAW_BASE, buildLocalApproved} = require('../lib/approved-baseline');

/**
 * Read package.json from the current directory.
 * @returns {object|null} Parsed package.json, or null if absent/unreadable
 */
const readPackageJson = () => {
    const pkgPath = path.join(process.cwd(), 'package.json');
    if (!fs.existsSync(pkgPath)) {
        return null;
    }
    try {
        return JSON.parse(fs.readFileSync(pkgPath, 'utf-8'));
    } catch {
        return null;
    }
};

/**
 * Best-effort canonical GitHub URL from a package.json repository field. The URL
 * does not affect change detection (displayHash excludes it); it only labels the
 * record, so a loose value is fine.
 * @param {object|string} repository - package.json repository field
 * @returns {string} Repository URL (may be empty)
 */
const deriveRepoUrl = repository => {
    if (!repository) {
        return '';
    }
    const raw = typeof repository === 'string' ? repository : repository.url;
    if (!raw) {
        return '';
    }
    return raw.replace(/^git\+/, '').replace(/\.git$/, '');
};

/**
 * Execute check-display.
 */
const checkDisplay = async () => {
    const pkg = readPackageJson();
    const openblock = pkg && pkg.openblock;
    const id = openblock && (openblock.deviceId || openblock.extensionId);

    // Nothing to check (not a plugin dir / no id): stay silent and don't nag.
    if (!id) {
        process.exit(0);
    }

    let local;
    try {
        ({record: local} = buildLocalApproved(pkg, deriveRepoUrl(pkg.repository), process.cwd()));
    } catch (err) {
        // Can't build the local baseline (e.g. missing icon): not our job to block.
        process.exit(0);
    }

    // Fetch the committed baseline. Distinguish "no baseline yet" (a real change —
    // a baseline PR is needed) from "couldn't reach the registry" (stay quiet).
    let remote;
    try {
        const response = await fetch(`${REGISTRY_RAW_BASE}/approved/${id}.json`);
        if (response.status === 404) {
            remote = null;
        } else if (response.ok) {
            remote = await response.json();
        } else {
            process.exit(0);
        }
    } catch {
        process.exit(0);
    }

    if (remote && remote.displayHash === local.displayHash) {
        console.log(chalk.gray(`Display baseline unchanged for ${id}.`));
        process.exit(0);
    }

    // Changed (or brand-new): tell the developer, but let the push proceed.
    console.log('');
    console.log(chalk.yellow(`⚠ Display channel changed for ${chalk.bold(id)} (name / description / icon / links).`));
    console.log(chalk.yellow('  Users keep seeing the previously-approved display until a review PR is merged.'));
    console.log(`  After this push, run:  ${chalk.cyan('npm run publish')}`);
    console.log('  to open the display-baseline review PR.');
    console.log('');
    process.exit(1);
};

module.exports = checkDisplay;
