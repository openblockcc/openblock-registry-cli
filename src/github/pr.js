/**
 * GitHub Pull Request operations
 * Creates PRs to the OpenBlock Registry
 *
 * Registry structure (registry.json):
 * {
 *   "devices": ["https://github.com/owner/repo", ...],
 *   "extensions": ["https://github.com/owner/repo", ...]
 * }
 */

const fetch = require('node-fetch');

const {getAuthenticatedUser} = require('./auth');
const {generatePublishPRBody, generateUnpublishPRBody, generatePRTitle} = require('../templates/pr-body');

const REGISTRY_OWNER = 'openblockcc';
const REGISTRY_REPO = 'openblock-registry';
const REGISTRY_BRANCH = 'main';
const REGISTRY_FILE = 'registry.json';

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
 * Check if branch exists
 * @param {string} token - GitHub token
 * @param {string} owner - Repository owner
 * @param {string} repo - Repository name
 * @param {string} branch - Branch name
 * @returns {boolean} True if branch exists
 */
const branchExists = async function (token, owner, repo, branch) {
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
    return response.status === 200;
};

/**
 * Delete branch
 * @param {string} token - GitHub token
 * @param {string} owner - Repository owner
 * @param {string} repo - Repository name
 * @param {string} branch - Branch name
 */
const deleteBranch = async function (token, owner, repo, branch) {
    await fetch(
        `https://api.github.com/repos/${owner}/${repo}/git/refs/heads/${branch}`,
        {
            method: 'DELETE',
            headers: {
                'Authorization': `token ${token}`,
                'Accept': 'application/vnd.github.v3+json',
                'User-Agent': 'openblock-cli'
            }
        }
    );
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
 * Find existing open PR for a branch
 * @param {string} token - GitHub token
 * @param {string} username - GitHub username (fork owner)
 * @param {string} branch - Branch name
 * @returns {object|null} PR object if found, null otherwise
 */
const findExistingPR = async function (token, username, branch) {
    const response = await fetch(
        `https://api.github.com/repos/${REGISTRY_OWNER}/${REGISTRY_REPO}/pulls?state=open&head=${username}:${branch}`,
        {
            headers: {
                'Authorization': `token ${token}`,
                'Accept': 'application/vnd.github.v3+json',
                'User-Agent': 'openblock-cli'
            }
        }
    );
    const prs = await response.json();
    return Array.isArray(prs) && prs.length > 0 ? prs[0] : null;
};

/**
 * Update existing PR body
 * @param {string} token - GitHub token
 * @param {number} prNumber - PR number
 * @param {string} body - New PR body
 * @returns {string} PR URL
 */
const updatePRBody = async function (token, prNumber, body) {
    const response = await fetch(
        `https://api.github.com/repos/${REGISTRY_OWNER}/${REGISTRY_REPO}/pulls/${prNumber}`,
        {
            method: 'PATCH',
            headers: {
                'Authorization': `token ${token}`,
                'Accept': 'application/vnd.github.v3+json',
                'User-Agent': 'openblock-cli',
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({body})
        }
    );

    if (!response.ok) {
        const error = await response.json();
        let errorDetails = error.message || response.status;
        if (error.errors && error.errors.length > 0) {
            errorDetails += `\n${error.errors.map(e => `  - ${e.message || JSON.stringify(e)}`).join('\n')}`;
        }
        throw new Error(`Failed to update PR: ${errorDetails}`);
    }

    const data = await response.json();
    return data.html_url;
};

/**
 * Get registry.json
 * @param {string} _token - GitHub token (unused)
 * @param {string} owner - Repository owner
 * @param {string} repo - Repository name
 * @param {string} branch - Branch name
 * @returns {object} Registry JSON
 */
const getRegistryJson = async function (_token, owner, repo, branch) {
    const response = await fetch(
        `https://raw.githubusercontent.com/${owner}/${repo}/${branch}/${REGISTRY_FILE}`
    );
    return response.json();
};

/**
 * Update registry.json with new repository URL
 * @param {object} registryJson - Current registry.json
 * @param {string} repoUrl - GitHub repository URL
 * @param {string} pluginType - Plugin type ('device' or 'extension')
 * @returns {{registry: object, isNew: boolean}} Updated registry.json and whether it's a new entry
 */
const updateRegistryJson = function (registryJson, repoUrl, pluginType) {
    const collectionName = pluginType === 'device' ? 'devices' : 'extensions';

    // Ensure structure exists
    if (!registryJson[collectionName]) {
        registryJson[collectionName] = [];
    }

    const collection = registryJson[collectionName];

    // Check if URL already exists
    const exists = collection.includes(repoUrl);

    if (!exists) {
        // Add new URL
        collection.push(repoUrl);
        // Sort alphabetically
        collection.sort();
    }

    return {
        registry: registryJson,
        isNew: !exists
    };
};

/**
 * Remove repository URL from registry.json
 * @param {object} registryJson - Current registry.json
 * @param {string} repoUrl - GitHub repository URL to remove
 * @returns {object} Updated registry.json
 */
const removeFromRegistryJson = function (registryJson, repoUrl) {
    // Search in both devices and extensions
    for (const collectionName of ['devices', 'extensions']) {
        const collection = registryJson[collectionName];
        if (!collection) continue;

        registryJson[collectionName] = collection.filter(url => url !== repoUrl);
    }

    return registryJson;
};

/**
 * Get file SHA from repository
 * @param {string} token - GitHub token
 * @param {string} owner - Repository owner
 * @param {string} repo - Repository name
 * @param {string} branch - Branch name
 * @param {string} filePath - File path
 * @returns {Promise<string|null>} File SHA or null if not found
 */
const getFileSha = async function (token, owner, repo, branch, filePath) {
    const response = await fetch(
        `https://api.github.com/repos/${owner}/${repo}/contents/${filePath}?ref=${branch}`,
        {
            headers: {
                'Authorization': `token ${token}`,
                'Accept': 'application/vnd.github.v3+json',
                'User-Agent': 'openblock-cli'
            }
        }
    );

    if (response.ok) {
        const data = await response.json();
        return data.sha;
    }
    return null;
};

/**
 * Commit a file to repository
 * @param {string} token - GitHub token
 * @param {string} owner - Repository owner
 * @param {string} repo - Repository name
 * @param {string} branch - Branch name
 * @param {string} filePath - File path
 * @param {string} content - File content (will be base64 encoded)
 * @param {string} message - Commit message
 * @param {string|null} sha - Existing file SHA (for updates)
 */
const commitFile = async function (token, owner, repo, branch, filePath, content, message, sha = null) {
    const body = {
        message,
        content: Buffer.from(content).toString('base64'),
        branch
    };

    if (sha) {
        body.sha = sha;
    }

    const response = await fetch(
        `https://api.github.com/repos/${owner}/${repo}/contents/${filePath}`,
        {
            method: 'PUT',
            headers: {
                'Authorization': `token ${token}`,
                'Accept': 'application/vnd.github.v3+json',
                'User-Agent': 'openblock-cli',
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(body)
        }
    );

    if (!response.ok) {
        const error = await response.json();
        throw new Error(`Failed to commit file: ${error.message || response.status}`);
    }

    return response.json();
};

/**
 * Commit changes to registry.json
 * @param {string} token - GitHub token
 * @param {string} owner - Repository owner (fork owner)
 * @param {string} repo - Repository name
 * @param {string} branch - Branch name
 * @param {object} content - Updated registry.json content
 * @param {string} repoUrl - Repository URL being added
 */
const commitRegistryChanges = async function (token, owner, repo, branch, content, repoUrl) {
    const message = `feat: add ${repoUrl}`;

    // Get existing file SHA
    const sha = await getFileSha(token, owner, repo, branch, REGISTRY_FILE);

    // Format JSON with 4-space indentation for readability
    const jsonContent = JSON.stringify(content, null, 4);

    // Commit the file
    await commitFile(token, owner, repo, branch, REGISTRY_FILE, jsonContent, message, sha);
};

/**
 * Commit unpublish changes to registry.json
 * @param {string} token - GitHub token
 * @param {string} owner - Repository owner (fork owner)
 * @param {string} repo - Repository name
 * @param {string} branch - Branch name
 * @param {object} content - Updated registry.json content
 * @param {string} repoUrl - Repository URL being removed
 */
const commitUnpublishChanges = async function (token, owner, repo, branch, content, repoUrl) {
    const message = `feat: remove ${repoUrl}`;

    // Get existing file SHA
    const sha = await getFileSha(token, owner, repo, branch, REGISTRY_FILE);

    // Format JSON with 4-space indentation for readability
    const jsonContent = JSON.stringify(content, null, 4);

    // Commit the file
    await commitFile(token, owner, repo, branch, REGISTRY_FILE, jsonContent, message, sha);
};

/**
 * Helper to normalize i18n field (string or formatMessage object)
 * @param {string|object} value - Field value
 * @returns {string} Normalized string value
 */
const normalizeI18n = value => {
    if (typeof value === 'string') return value;
    if (value && typeof value === 'object' && value.formatMessage) {
        return value.formatMessage.default || value.formatMessage.id || '';
    }
    return '';
};

/**
 * Build PR body content
 * @param {object} packageInfo - Package information
 * @param {string} repoUrl - GitHub repository URL
 * @param {boolean} isNewPlugin - Whether this is a new plugin
 * @returns {string} PR body markdown
 */
const buildPRBody = (packageInfo, repoUrl, isNewPlugin) => {
    const openblock = packageInfo.openblock;
    const pluginName = normalizeI18n(openblock.name) || openblock.id;
    const description = normalizeI18n(openblock.description) || packageInfo.description || '';
    const isDevice = !!openblock.deviceId;

    return generatePublishPRBody({
        pluginId: openblock.id,
        pluginName,
        pluginType: isDevice ? 'device' : 'extension',
        version: packageInfo.version,
        repository: repoUrl,
        description,
        author: packageInfo.author || '',
        isNewPlugin: isNewPlugin
    });
};

/**
 * Create PR
 * @param {string} token - GitHub token
 * @param {string} username - GitHub username
 * @param {string} branch - Branch name
 * @param {object} packageInfo - Package information
 * @param {string} repoUrl - GitHub repository URL
 * @param {boolean} isNewPlugin - Whether this is a new plugin
 * @returns {string} PR URL
 */
const createPR = async function (token, username, branch, packageInfo, repoUrl, isNewPlugin) {
    const title = generatePRTitle('publish', packageInfo.openblock.id, packageInfo.version);
    const body = buildPRBody(packageInfo, repoUrl, isNewPlugin);

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
        // Show detailed error information from GitHub API
        let errorDetails = error.message || response.status;
        if (error.errors && error.errors.length > 0) {
            errorDetails += `\n${error.errors.map(e => `  - ${e.message || JSON.stringify(e)}`).join('\n')}`;
        }
        throw new Error(`Failed to create PR: ${errorDetails}`);
    }

    const data = await response.json();
    return data.html_url;
};

/**
 * Create unpublish PR request
 * @param {string} token - GitHub token
 * @param {string} username - GitHub username
 * @param {string} branch - Branch name
 * @param {string} repoUrl - GitHub repository URL to remove
 * @returns {string} PR URL
 */
const createUnpublishPRRequest = async function (token, username, branch, repoUrl) {
    // Extract repo name from URL for title
    const repoName = repoUrl.split('/').pop();
    const title = `Remove: ${repoName}`;
    const body = generateUnpublishPRBody({
        pluginId: repoName,
        pluginName: repoName,
        version: 'all',
        reason: `Remove repository: ${repoUrl}`
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
        // Show detailed error information from GitHub API
        let errorDetails = error.message || response.status;
        if (error.errors && error.errors.length > 0) {
            errorDetails += `\n${error.errors.map(e => `  - ${e.message || JSON.stringify(e)}`).join('\n')}`;
        }
        throw new Error(`Failed to create PR: ${errorDetails}`);
    }

    const data = await response.json();
    return data.html_url;
};

/**
 * Create a Pull Request to add a plugin repository to registry
 * @param {string} token - GitHub token
 * @param {object} packageInfo - Package information from package.json
 * @param {string} repoUrl - GitHub repository URL (validated)
 * @returns {{url: string, isUpdate: boolean, isNew: boolean}} PR result
 */
const createPullRequest = async function (token, packageInfo, repoUrl) {
    const openblock = packageInfo.openblock;
    const pluginId = openblock.id || openblock.deviceId || openblock.extensionId;
    const pluginType = openblock.deviceId ? 'device' : 'extension';

    // Get authenticated user
    const user = await getAuthenticatedUser(token);
    const branchName = `publish/${pluginId}`;

    // 1. Fork the registry (if not already forked)
    await ensureFork(token, user.login);

    // 2. Check if there's an existing open PR for this branch
    const existingPR = await findExistingPR(token, user.login, branchName);

    // 3. Check if branch exists
    const branchAlreadyExists = await branchExists(token, user.login, REGISTRY_REPO, branchName);

    // 4. Get the latest commit SHA from main branch
    const baseSha = await getLatestCommitSha(token, REGISTRY_OWNER, REGISTRY_REPO, REGISTRY_BRANCH);

    // 5. Handle branch creation/recreation
    if (branchAlreadyExists) {
        if (existingPR) {
            // If there's an existing open PR, DON'T delete the branch (it would close the PR)
            // Just update the branch content by committing new changes
        } else {
            // No open PR, safe to delete and recreate branch
            await deleteBranch(token, user.login, REGISTRY_REPO, branchName);
            await new Promise(resolve => setTimeout(resolve, 1000));
            await createBranch(token, user.login, REGISTRY_REPO, branchName, baseSha);
        }
    } else {
        // Branch doesn't exist, create it
        await createBranch(token, user.login, REGISTRY_REPO, branchName, baseSha);
    }

    // 6. Get current registry.json
    const registryJson = await getRegistryJson(token, REGISTRY_OWNER, REGISTRY_REPO, REGISTRY_BRANCH);

    // 7. Update registry.json with repository URL
    const {registry: updatedRegistry, isNew} = updateRegistryJson(registryJson, repoUrl, pluginType);

    // 8. Commit the changes
    await commitRegistryChanges(token, user.login, REGISTRY_REPO, branchName, updatedRegistry, repoUrl);

    // 9. Create or update Pull Request
    let prUrl;
    if (existingPR) {
        // Update existing PR body with new information
        const body = buildPRBody(packageInfo, repoUrl, isNew);
        prUrl = await updatePRBody(token, existingPR.number, body);
    } else {
        // Create new Pull Request
        prUrl = await createPR(
            token, user.login, branchName, packageInfo, repoUrl, isNew
        );
    }

    return {url: prUrl, isUpdate: !!existingPR, isNew};
};

/**
 * Create a Pull Request to remove a plugin repository from registry
 * @param {string} token - GitHub token
 * @param {string} repoUrl - GitHub repository URL to remove
 * @returns {string} PR URL
 */
const createUnpublishPR = async function (token, repoUrl) {
    const user = await getAuthenticatedUser(token);

    // Extract repo name from URL for branch name
    const repoName = repoUrl.split('/').pop();
    const branchName = `unpublish/${repoName}`;

    // Fork, create branch
    await ensureFork(token, user.login);
    const baseSha = await getLatestCommitSha(token, REGISTRY_OWNER, REGISTRY_REPO, REGISTRY_BRANCH);
    await createBranch(token, user.login, REGISTRY_REPO, branchName, baseSha);

    // Get and update registry.json
    const registryJson = await getRegistryJson(token, REGISTRY_OWNER, REGISTRY_REPO, REGISTRY_BRANCH);
    const updatedRegistry = removeFromRegistryJson(registryJson, repoUrl);

    // Commit changes
    await commitUnpublishChanges(token, user.login, REGISTRY_REPO, branchName, updatedRegistry, repoUrl);

    // Create PR
    const prUrl = await createUnpublishPRRequest(token, user.login, branchName, repoUrl);

    return prUrl;
};

module.exports = {
    createPullRequest,
    createUnpublishPR
};
