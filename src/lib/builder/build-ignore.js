/**
 * Build ignore file parser
 * Parses .buildignore file and checks if paths should be ignored
 */

const fs = require('fs');
const path = require('path');

// Default ignore patterns (always ignored)
const DEFAULT_IGNORE_PATTERNS = [
    'node_modules',
    '.git',
    '.buildignore',
    'esbuild.config.js',
    'dist',
    '.eslintrc.js',
    '.eslintignore',
    'package-lock.json',
    '.vscode',
    '.idea'
];

/**
 * Parse .buildignore file
 * @param {string} projectDir - Project directory
 * @returns {string[]} Array of ignore patterns
 */
const parseBuildIgnore = (projectDir = process.cwd()) => {
    const ignoreFile = path.join(projectDir, '.buildignore');

    let customPatterns = [];
    if (fs.existsSync(ignoreFile)) {
        const content = fs.readFileSync(ignoreFile, 'utf-8');
        // Remove trailing slash for directories
        const removeTrailingSlash = pattern => {
            if (pattern.endsWith('/')) {
                return pattern.slice(0, -1);
            }
            return pattern;
        };
        customPatterns = content
            .split('\n')
            .map(line => line.trim())
            .filter(line => line && !line.startsWith('#'))
            .map(removeTrailingSlash);
    }

    return [...DEFAULT_IGNORE_PATTERNS, ...customPatterns];
};

/**
 * Check if a path should be ignored based on ignore patterns
 * @param {string} filePath - Path to check (relative to project root)
 * @param {string[]} ignorePatterns - Array of ignore patterns
 * @returns {boolean} True if path should be ignored
 */
const shouldIgnore = (filePath, ignorePatterns) => {
    const normalizedPath = filePath.replace(/\\/g, '/').replace(/^\.\//, '');

    return ignorePatterns.some(pattern => {
        // Exact match
        if (normalizedPath === pattern) return true;

        // Directory match (path starts with pattern)
        if (normalizedPath.startsWith(`${pattern}/`)) return true;

        // Wildcard pattern support (basic)
        const regexPattern = pattern
            .replace(/\./g, '\\.')
            .replace(/\*/g, '.*');
        const regex = new RegExp(`^${regexPattern}$`);

        return regex.test(normalizedPath);
    });
};

module.exports = {
    parseBuildIgnore,
    shouldIgnore,
    DEFAULT_IGNORE_PATTERNS
};
