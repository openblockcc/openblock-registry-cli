/**
 * GitHub Pull Request operations
 * Creates PRs to the OpenBlock Registry
 */

const fetch = require('node-fetch');

const {getAuthenticatedUser} = require('./auth');
const {generatePublishPRBody, generateUnpublishPRBody, generatePRTitle} = require('../templates/pr-body');

const REGISTRY_OWNER = 'openblockcc';
const REGISTRY_REPO = 'openblock-registry';
const REGISTRY_BRANCH = 'main';

/**
 * Ensure fork exists
 * @param {string} token - GitHub token
 * @param {string} username - GitHub username
 */
const ensureFork = async function (token, username) {
    // Check if fork exists, create if not
    const response = await fetch(`https://api.github.com/repos/${username}/${REGISTRY_REPO}`, {
        headers: {
            'Authorization': `token ${token}`,
            'Accept': 'application/vnd.github.v3+json',
            'User-Agent': 'openblock-cli'
        }
    });

    if (response.status === 404) {
        // Create fork
        await fetch(`https://api.github.com/repos/${REGISTRY_OWNER}/${REGISTRY_REPO}/forks`, {
            method: 'POST',
            headers: {
                'Authorization': `token ${token}`,
                'Accept': 'application/vnd.github.v3+json',
                'User-Agent': 'openblock-cli'
            }
        });
        // Wait for fork to be ready
        await new Promise(resolve => setTimeout(resolve, 3000));
    }
};

/**
 * Get latest commit SHA
 * @param {string} token - GitHub token
 * @param {string} owner - Repository owner
 * @param {string} repo - Repository name
 * @param {string} branch - Branch name
 * @returns {string} Commit SHA
 */
const getLatestCommitSha = async function (token, owner, repo, branch) {
    const response = await fetch(
        `https://api.github.com/repos/${owner}/${repo}/git/ref/heads/${branch}`,
        {
            headers: {
                'Authorization': `token ${token}`,
                'Accept': 'application/vnd.github.v3+json',
                'User-Agent': 'openblock-cli'
            }
        }
    );
    const data = await response.json();
    return data.object.sha;
};

/**
 * Create branch
 * @param {string} token - GitHub token
 * @param {string} owner - Repository owner
 * @param {string} repo - Repository name
 * @param {string} branch - Branch name
 * @param {string} sha - Commit SHA
 */
const createBranch = async function (token, owner, repo, branch, sha) {
    await fetch(`https://api.github.com/repos/${owner}/${repo}/git/refs`, {
        method: 'POST',
        headers: {
            'Authorization': `token ${token}`,
            'Accept': 'application/vnd.github.v3+json',
            'User-Agent': 'openblock-cli',
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            ref: `refs/heads/${branch}`,
            sha: sha
        })
    });
};

/**
 * Get packages.json
 * @param {string} _token - GitHub token (unused)
 * @param {string} owner - Repository owner
 * @param {string} repo - Repository name
 * @param {string} branch - Branch name
 * @returns {object} Packages JSON
 */
const getPackagesJson = async function (_token, owner, repo, branch) {
    const response = await fetch(
        `https://raw.githubusercontent.com/${owner}/${repo}/${branch}/packages.json`
    );
    return response.json();
};

/**
 * Update packages.json
 * @param {object} packagesJson - Current packages.json
 * @param {object} _packageInfo - Package information (unused)
 * @param {object} _gitInfo - Git information (unused)
 * @returns {object} Updated packages.json
 */
const updatePackagesJson = function (packagesJson, _packageInfo, _gitInfo) {
    // Implementation to add/update package entry
    // This is a simplified version
    return packagesJson;
};

/**
 * Remove from packages.json
 * @param {object} packagesJson - Current packages.json
 * @param {string} _packageId - Package ID (unused)
 * @param {string} _version - Version (unused)
 * @returns {object} Updated packages.json
 */
const removeFromPackagesJson = function (packagesJson, _packageId, _version) {
    // Implementation to remove package version
    return packagesJson;
};

/**
 * Commit changes
 * @param {string} _token - GitHub token (unused)
 * @param {string} _owner - Repository owner (unused)
 * @param {string} _repo - Repository name (unused)
 * @param {string} _branch - Branch name (unused)
 * @param {object} _content - Content (unused)
 * @param {object} _packageInfo - Package information (unused)
 */
const commitChanges = async function (_token, _owner, _repo, _branch, _content, _packageInfo) {
    // Implementation to commit changes
};

/**
 * Commit unpublish changes
 * @param {string} _token - GitHub token (unused)
 * @param {string} _owner - Repository owner (unused)
 * @param {string} _repo - Repository name (unused)
 * @param {string} _branch - Branch name (unused)
 * @param {object} _content - Content (unused)
 * @param {string} _packageId - Package ID (unused)
 * @param {string} _version - Version (unused)
 */
const commitUnpublishChanges = async function (_token, _owner, _repo, _branch, _content, _packageId, _version) {
    // Implementation to commit unpublish changes
};

/**
 * Create PR
 * @param {string} token - GitHub token
 * @param {string} username - GitHub username
 * @param {string} branch - Branch name
 * @param {object} packageInfo - Package information
 * @param {object} repoInfo - Repository information
 * @param {boolean} isNewPlugin - Whether this is a new plugin
 * @returns {string} PR URL
 */
const createPR = async function (token, username, branch, packageInfo, repoInfo, isNewPlugin) {
    const openblock = packageInfo.openblock;

    const title = generatePRTitle('publish', openblock.id, packageInfo.version);
    const body = generatePublishPRBody({
        pluginId: openblock.id,
        pluginName: openblock.name || openblock.id,
        pluginType: openblock.type,
        version: packageInfo.version,
        repository: repoInfo ? repoInfo.html_url : packageInfo.repository.url,
        description: openblock.description || packageInfo.description || '',
        author: packageInfo.author || '',
        dependencies: packageInfo.dependencies,
        isNewPlugin: isNewPlugin
    });

    const response = await fetch(
        `https://api.github.com/repos/${REGISTRY_OWNER}/${REGISTRY_REPO}/pulls`,
        {
            method: 'POST',
            headers: {
                'Authorization': `token ${token}`,
                'Accept': 'application/vnd.github.v3+json',
                'User-Agent': 'openblock-cli',
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                title: title,
                body: body,
                head: `${username}:${branch}`,
                base: REGISTRY_BRANCH
            })
        }
    );

    if (!response.ok) {
        const error = await response.json();
        throw new Error(`Failed to create PR: ${error.message || response.status}`);
    }

    const data = await response.json();
    return data.html_url;
};

/**
 * Create unpublish PR request
 * @param {string} token - GitHub token
 * @param {string} username - GitHub username
 * @param {string} branch - Branch name
 * @param {string} packageId - Package ID
 * @param {string} version - Version
 * @param {string} reason - Reason for unpublishing
 * @returns {string} PR URL
 */
const createUnpublishPRRequest = async function (token, username, branch, packageId, version, reason) {
    const title = generatePRTitle('unpublish', packageId, version);
    const body = generateUnpublishPRBody({
        pluginId: packageId,
        pluginName: packageId,
        version: version,
        reason: reason || 'No reason provided'
    });

    const response = await fetch(
        `https://api.github.com/repos/${REGISTRY_OWNER}/${REGISTRY_REPO}/pulls`,
        {
            method: 'POST',
            headers: {
                'Authorization': `token ${token}`,
                'Accept': 'application/vnd.github.v3+json',
                'User-Agent': 'openblock-cli',
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                title: title,
                body: body,
                head: `${username}:${branch}`,
                base: REGISTRY_BRANCH
            })
        }
    );

    if (!response.ok) {
        const error = await response.json();
        throw new Error(`Failed to create PR: ${error.message || response.status}`);
    }

    const data = await response.json();
    return data.html_url;
};

/**
 * Create a Pull Request to add/update a package
 * @param {string} token - GitHub token
 * @param {object} packageInfo - Package information from package.json
 * @param {object} gitInfo - Git information
 * @param {object} repoInfo - Repository information from GitHub API
 * @param {object} idCheckResult - ID uniqueness check result (contains packagesJson and isNew)
 * @returns {string} PR URL
 */
const createPullRequest = async function (token, packageInfo, gitInfo, repoInfo, idCheckResult) {

    // Get authenticated user
    const user = await getAuthenticatedUser(token);
    const branchName = `publish/${packageInfo.openblock.id}-${packageInfo.version}`;

    // 1. Fork the registry (if not already forked)
    await ensureFork(token, user.login);

    // 2. Get the latest commit SHA from main branch
    const baseSha = await getLatestCommitSha(token, REGISTRY_OWNER, REGISTRY_REPO, REGISTRY_BRANCH);

    // 3. Create a new branch in the fork
    await createBranch(token, user.login, REGISTRY_REPO, branchName, baseSha);

    // 4. Use packagesJson from idCheckResult (already fetched during validation)
    const packagesJson = idCheckResult.packagesJson;

    // 5. Update packages.json with new entry
    const updatedPackages = updatePackagesJson(packagesJson, packageInfo, gitInfo);

    // 6. Commit the changes
    await commitChanges(token, user.login, REGISTRY_REPO, branchName, updatedPackages, packageInfo);

    // 7. Create Pull Request (pass isNew from idCheckResult)
    const prUrl = await createPR(
        token, user.login, branchName, packageInfo, repoInfo, idCheckResult.isNew
    );

    return prUrl;
};

/**
 * Create a Pull Request to remove a package version
 * @param {string} token - GitHub token
 * @param {string} packageId - Package ID
 * @param {string} version - Version to remove
 * @returns {string} PR URL
 */
const createUnpublishPR = async function (token, packageId, version) {
    const user = await getAuthenticatedUser(token);
    const branchName = `unpublish/${packageId}-${version}`;

    // Similar flow as createPullRequest but removes the version
    await ensureFork(token, user.login);
    const baseSha = await getLatestCommitSha(token, REGISTRY_OWNER, REGISTRY_REPO, REGISTRY_BRANCH);
    await createBranch(token, user.login, REGISTRY_REPO, branchName, baseSha);

    const packagesJson = await getPackagesJson(null, REGISTRY_OWNER, REGISTRY_REPO, REGISTRY_BRANCH);
    const updatedPackages = removeFromPackagesJson(packagesJson, packageId, version);

    await commitUnpublishChanges(null, user.login, REGISTRY_REPO, branchName, updatedPackages, packageId, version);

    const prUrl = await createUnpublishPRRequest(null, user.login, branchName, packageId, version);

    return prUrl;
};

module.exports = {
    createPullRequest,
    createUnpublishPR
};
