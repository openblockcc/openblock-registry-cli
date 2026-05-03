/**
 * Submodules validator
 *
 * The registry side clones plugin repos with `git clone --recurse-submodules`,
 * so anything broken about submodules locally (uninitialized, dirty, or
 * pointing at unpushed commits) will surface as a sync failure on the server.
 * This validator catches those cases before publish, with actionable messages.
 */

const fs = require('fs');
const path = require('path');
const {execSync} = require('child_process');

/**
 * Run a git command synchronously and return trimmed stdout.
 * @param {string} command - Command to run
 * @param {object} [options] - execSync options
 * @returns {string} Trimmed stdout
 */
const git = (command, options = {}) => execSync(command, {
    encoding: 'utf-8',
    stdio: ['ignore', 'pipe', 'pipe'],
    ...options
}).trim();

/**
 * Parse `.gitmodules` via `git config --get-regexp` so we get git's own parsing.
 * Returns an array of {name, path, url}. Entries missing path or url are skipped.
 * @returns {Array<{name: string, path: string, url: string}>} Submodule entries
 */
const parseSubmodules = () => {
    let configOutput;
    try {
        configOutput = git('git config -f .gitmodules --get-regexp .');
    } catch (e) {
        // No matches (empty .gitmodules) returns exit code 1 — treat as empty
        return [];
    }

    const byName = {};
    for (const line of configOutput.split('\n').filter(Boolean)) {
        // Format: submodule.<name>.<key> <value>
        // Use non-greedy capture for <name> so URLs with dots don't confuse the split.
        const m = line.match(/^submodule\.(.+?)\.(path|url)\s+(.+)$/);
        if (!m) continue;
        const [, name, key, value] = m;
        if (!byName[name]) byName[name] = {name};
        byName[name][key] = value;
    }

    return Object.values(byName).filter(s => s.path && s.url);
};

/**
 * Read the gitlink commit SHA recorded in HEAD for a submodule path.
 * @param {string} submodulePath - Path of submodule relative to repo root
 * @returns {string} Commit SHA the parent repo points to
 */
const getRecordedSha = (submodulePath) => {
    let treeOutput;
    try {
        // Quote the path for paths containing spaces
        treeOutput = git(`git ls-tree HEAD "${submodulePath}"`);
    } catch (e) {
        throw new Error(`Failed to read gitlink for "${submodulePath}": ${e.message}`);
    }
    // Format: <mode> <type> <sha>\t<path>
    // Submodules use mode 160000 and type "commit".
    const m = treeOutput.match(/^160000\s+commit\s+([0-9a-f]+)\s+/);
    if (!m) {
        throw new Error(
            `"${submodulePath}" is not registered as a submodule in HEAD ` +
            `(git ls-tree returned: ${treeOutput || '<empty>'}).`
        );
    }
    return m[1];
};

/**
 * Verify the recorded gitlink SHA is reachable from at least one remote ref
 * inside the submodule. Tries a fetch first if the local clone hasn't seen it.
 * @param {string} submodulePath - Submodule path
 * @param {string} sha - Recorded gitlink SHA
 * @returns {boolean} True if the SHA is on a remote branch
 */
const isShaOnRemote = (submodulePath, sha) => {
    const tryContains = () => {
        try {
            const out = git(`git -C "${submodulePath}" branch -r --contains ${sha}`);
            return out.length > 0;
        } catch (e) {
            return false;
        }
    };

    if (tryContains()) return true;

    // Maybe the local submodule clone is behind. Fetch and try again.
    try {
        execSync(`git -C "${submodulePath}" fetch --quiet origin`, {
            stdio: ['ignore', 'pipe', 'pipe']
        });
    } catch (e) {
        // Fetch failure (network/auth). Fall through; tryContains() will return whatever it can.
    }

    return tryContains();
};

/**
 * Validate submodule state for publishing.
 *
 * @returns {Promise<{hasSubmodules: boolean, submodules: Array}>} Validation result
 * @throws {Error} If any submodule is uninitialized, dirty, or unpushed
 */
const validateSubmodules = async function () {
    const cwd = process.cwd();
    const gitmodulesPath = path.join(cwd, '.gitmodules');

    if (!fs.existsSync(gitmodulesPath)) {
        return {hasSubmodules: false, submodules: []};
    }

    const entries = parseSubmodules();
    if (entries.length === 0) {
        return {hasSubmodules: false, submodules: []};
    }

    // Each submodule directory must exist and be populated.
    for (const sm of entries) {
        const fullPath = path.join(cwd, sm.path);
        if (!fs.existsSync(fullPath)) {
            throw new Error(
                `Submodule "${sm.name}" not initialized: ${sm.path}\n` +
                `   Run: git submodule update --init --recursive`
            );
        }
        const contents = fs.readdirSync(fullPath).filter(f => f !== '.git');
        if (contents.length === 0) {
            throw new Error(
                `Submodule "${sm.name}" appears empty: ${sm.path}\n` +
                `   Run: git submodule update --init --recursive`
            );
        }
    }

    // `git submodule status --recursive` flags every level of submodule tree.
    let statusOutput;
    try {
        statusOutput = git('git submodule status --recursive');
    } catch (e) {
        throw new Error(`Failed to check submodule status: ${e.message}`);
    }

    for (const line of statusOutput.split('\n').filter(Boolean)) {
        const prefix = line[0];
        if (prefix === ' ') continue;
        const smPath = line.slice(1).split(/\s+/)[1] || 'unknown';
        if (prefix === '+') {
            throw new Error(
                `Submodule "${smPath}" HEAD differs from the SHA recorded in the parent repo.\n` +
                `   Either commit the new pointer (git add "${smPath}" && git commit) ` +
                `or reset the submodule (git submodule update --init "${smPath}").`
            );
        }
        if (prefix === '-') {
            throw new Error(
                `Submodule "${smPath}" not initialized.\n` +
                `   Run: git submodule update --init --recursive`
            );
        }
        if (prefix === 'U') {
            throw new Error(`Submodule "${smPath}" has merge conflicts.`);
        }
    }

    // For each top-level submodule, confirm the recorded SHA is on its remote.
    const results = [];
    for (const sm of entries) {
        const sha = getRecordedSha(sm.path);
        if (!isShaOnRemote(sm.path, sha)) {
            throw new Error(
                `Submodule "${sm.path}" pointer ${sha.substring(0, 7)} is not pushed to its remote.\n` +
                `   The registry will fail to fetch this submodule when building.\n` +
                `   Push it first: cd "${sm.path}" && git push <remote> <branch>\n` +
                `   Submodule URL: ${sm.url}`
            );
        }
        results.push({name: sm.name, path: sm.path, url: sm.url, sha});
    }

    return {
        hasSubmodules: true,
        submodules: results
    };
};

module.exports = validateSubmodules;
