/**
 * GitHub authentication
 * Handles GitHub token management
 */

const inquirer = require('inquirer');
const {getConfig, setConfig} = require('../utils/config');
const fetch = require('node-fetch');

/**
 * Validate a GitHub token
 * @param {string} token - GitHub token to validate
 * @returns {boolean} True if valid
 */
const validateToken = async function (token) {
    try {
        const response = await fetch('https://api.github.com/user', {
            headers: {
                'Authorization': `token ${token}`,
                'Accept': 'application/vnd.github.v3+json',
                'User-Agent': 'openblock-cli'
            }
        });

        return response.ok;
    } catch (error) {
        return false;
    }
};

/**
 * Get GitHub token from config or prompt user
 * @returns {string} GitHub token
 */
const getGitHubToken = async function () {
    // Try to get from config
    const token = getConfig('github-token');

    if (token) {
        // Validate token
        const isValid = await validateToken(token);
        if (isValid) {
            return token;
        }
        console.log('Stored GitHub token is invalid or expired.');
    }

    // Prompt for token
    const answers = await inquirer.prompt([
        {
            type: 'password',
            name: 'token',
            message: 'Enter your GitHub Personal Access Token:',
            mask: '*',
            validate: input => {
                if (!input || input.length < 10) {
                    return 'Please enter a valid GitHub token';
                }
                return true;
            }
        },
        {
            type: 'confirm',
            name: 'save',
            message: 'Save token for future use?',
            default: true
        }
    ]);

    // Validate the new token
    const isValid = await validateToken(answers.token);
    if (!isValid) {
        throw new Error('Invalid GitHub token. Please check your token and try again.');
    }

    // Save if requested
    if (answers.save) {
        setConfig('github-token', answers.token);
        console.log('Token saved to ~/.openblockrc');
    }

    return answers.token;
};

/**
 * Get authenticated user info
 * @param {string} token - GitHub token
 * @returns {object} User info
 */
const getAuthenticatedUser = async function (token) {
    const response = await fetch('https://api.github.com/user', {
        headers: {
            'Authorization': `token ${token}`,
            'Accept': 'application/vnd.github.v3+json',
            'User-Agent': 'openblock-cli'
        }
    });

    if (!response.ok) {
        throw new Error('Failed to get user info');
    }

    return response.json();
};

module.exports = {
    getGitHubToken,
    validateToken,
    getAuthenticatedUser
};
