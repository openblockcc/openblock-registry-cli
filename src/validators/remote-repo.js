/**
 * Remote repository validator
 * Validates that the GitHub repository is accessible
 */

const fetch = require('node-fetch');

/**
 * Validate remote repository is accessible
 * @param {object|string} repository - Repository info from package.json
 * @throws {Error} If repository is not accessible
 */
const validateRemoteRepo = async function (repository) {
    const repoUrl = typeof repository === 'string' ?
        repository :
        repository.url;

    if (!repoUrl) {
        throw new Error('Repository URL is required');
    }

    // Extract owner and repo from URL
    const match = repoUrl.match(/github\.com[/:]([^/]+)\/([^/.]+)/);
    if (!match) {
        throw new Error(`Invalid GitHub URL: ${repoUrl}`);
    }

    const [, owner, repo] = match;
    const apiUrl = `https://api.github.com/repos/${owner}/${repo}`;

    // Check repository accessibility
    try {
        const response = await fetch(apiUrl, {
            headers: {
                'Accept': 'application/vnd.github.v3+json',
                'User-Agent': 'openblock-cli'
            }
        });

        if (response.status === 404) {
            throw new Error(`Repository not found or not public: ${owner}/${repo}`);
        }

        if (!response.ok) {
            throw new Error(`GitHub API error: ${response.status}`);
        }

        const repoData = await response.json();

        // Check if repository is public
        if (repoData.private) {
            throw new Error(`Repository must be public: ${owner}/${repo}`);
        }

        return {
            owner,
            repo,
            fullName: repoData.full_name,
            description: repoData.description,
            defaultBranch: repoData.default_branch,
            html_url: repoData.html_url
        };

    } catch (error) {
        if (error.message.includes('Repository')) {
            throw error;
        }
        throw new Error(`Failed to access repository: ${error.message}`);
    }
};

module.exports = validateRemoteRepo;
