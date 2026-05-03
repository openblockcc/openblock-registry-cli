/**
 * Build ignore file parser
 * Parses .buildignore file and checks if paths should be ignored
 */

const fs = require('fs');
const path = require('path');

// Default ignore patterns (always ignored)
// Patterns starting with "**/" match the segment at any depth.
// This is required for submodules: each submodule directory has its own
// .git/.github/.gitignore/.gitattributes that should not ship in dist.
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
    '.idea',
    // Nested git/CI metadata from submodules
    '**/.git',
    '**/.github',
    '**/.gitignore',
    '**/.gitattributes',
    '**/.gitmodules',
    // Nested noise that may live inside vendored libraries
    '**/node_modules',
    '**/.vscode',
    '**/.idea'
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
    const segments = normalizedPath.split('/');

    return ignorePatterns.some(pattern => {
        // "**/X" matches segment X at any depth.
        // This catches both the file/dir itself (last segment === X)
        // and anything inside it (X is some intermediate segment).
        if (pattern.startsWith('**/')) {
            const target = pattern.slice(3);
            if (!target) return false;
            return segments.includes(target);
        }

        // Exact match
        if (normalizedPath === pattern) return true;

        // Directory match (path starts with pattern)
        if (normalizedPath.startsWith(`${pattern}/`)) return true;

        // Wildcard pattern support (basic, top-level only)
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
