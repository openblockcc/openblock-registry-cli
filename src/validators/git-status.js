/**
 * Git status validator
 * Validates Git status and tag existence
 */

const {execSync} = require('child_process');

/**
 * Validate Git status for publishing
 * @param {string} version - Expected version from package.json
 * @returns {object} Git information
 * @throws {Error} If validation fails
 */
const validateGitStatus = async function (version) {
    // Check if in a git repository
    try {
        execSync('git rev-parse --git-dir', {stdio: 'pipe'});
    } catch (e) {
        throw new Error('Not a git repository');
    }

    // Check for uncommitted changes
    try {
        const status = execSync('git status --porcelain', {encoding: 'utf-8'});
        if (status.trim()) {
            throw new Error('Working directory has uncommitted changes. Please commit or stash them first.');
        }
    } catch (e) {
        if (e.message.includes('uncommitted')) {
            throw e;
        }
        throw new Error(`Failed to check git status: ${e.message}`);
    }

    // Check if tag exists locally
    const tagName = version;
    try {
        execSync(`git rev-parse ${tagName}`, {stdio: 'pipe'});
    } catch (e) {
        throw new Error(`Git tag "${tagName}" not found. Create it with: git tag ${tagName}`);
    }

    // Get tag commit hash
    let tagCommit;
    try {
        tagCommit = execSync(`git rev-parse ${tagName}`, {encoding: 'utf-8'}).trim();
    } catch (e) {
        throw new Error(`Failed to get tag commit: ${e.message}`);
    }

    // Check if tag is pushed to remote
    try {
        const remoteRefs = execSync('git ls-remote --tags origin', {encoding: 'utf-8'});
        if (!remoteRefs.includes(tagName)) {
            throw new Error(`Tag "${tagName}" not pushed to remote. Push it with: git push origin ${tagName}`);
        }
    } catch (e) {
        if (e.message.includes('not pushed')) {
            throw e;
        }
        // If we can't check remote, warn but continue
        console.warn('Warning: Could not verify tag on remote');
    }

    // Get remote URL
    let remoteUrl;
    try {
        remoteUrl = execSync('git remote get-url origin', {encoding: 'utf-8'}).trim();
    } catch (e) {
        throw new Error('No git remote "origin" configured');
    }

    return {
        tagName,
        tagCommit,
        remoteUrl,
        clean: true
    };
};

module.exports = validateGitStatus;
