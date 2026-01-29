/**
 * Resource copy utilities
 * Copies files to dist directory, respecting .buildignore
 */

const fs = require('fs');
const path = require('path');
const {shouldIgnore} = require('./build-ignore');

/**
 * Copy a single file to destination, creating directories if needed
 * @param {string} srcPath - Source file path
 * @param {string} destPath - Destination file path
 */
const copySingleFile = (srcPath, destPath) => {
    const destDir = path.dirname(destPath);
    if (!fs.existsSync(destDir)) {
        fs.mkdirSync(destDir, {recursive: true});
    }
    fs.copyFileSync(srcPath, destPath);
};

/**
 * Recursively get all files in a directory
 * @param {string} dir - Directory to scan
 * @param {string[]} fileList - Accumulated file list
 * @returns {string[]} Array of file paths
 */
const getAllFiles = (dir, fileList = []) => {
    if (!fs.existsSync(dir)) return fileList;

    const files = fs.readdirSync(dir);

    for (const file of files) {
        const filePath = path.join(dir, file);
        const stat = fs.statSync(filePath);

        if (stat.isDirectory()) {
            getAllFiles(filePath, fileList);
        } else {
            fileList.push(filePath);
        }
    }

    return fileList;
};

/**
 * Copy all resources to dist directory
 * @param {string} projectDir - Project directory
 * @param {string} distDir - Destination directory
 * @param {string[]} ignorePatterns - Patterns to ignore
 * @param {object} options - Options
 * @param {boolean} options.verbose - Show verbose output
 * @returns {number} Number of files copied
 */
const copyResources = (projectDir, distDir, ignorePatterns, options = {}) => {
    const allFiles = getAllFiles(projectDir);
    let copiedCount = 0;

    for (const srcPath of allFiles) {
        // Get path relative to project directory
        const relativePath = path.relative(projectDir, srcPath);
        const normalizedPath = relativePath.replace(/\\/g, '/');

        // Skip if file should be ignored
        if (shouldIgnore(normalizedPath, ignorePatterns)) {
            continue;
        }

        const destPath = path.join(distDir, relativePath);

        // Copy file
        copySingleFile(srcPath, destPath);
        copiedCount++;

        if (options.verbose) {
            console.log(`  Copied: ${normalizedPath}`);
        }
    }

    return copiedCount;
};

/**
 * Copy a single changed file to dist
 * @param {string} projectDir - Project directory
 * @param {string} distDir - Destination directory
 * @param {string} relativePath - Relative path of changed file
 * @param {string[]} ignorePatterns - Patterns to ignore
 * @returns {boolean} True if file was copied
 */
const copyChangedFile = (projectDir, distDir, relativePath, ignorePatterns) => {
    const normalizedPath = relativePath.replace(/\\/g, '/');

    // Skip if file should be ignored
    if (shouldIgnore(normalizedPath, ignorePatterns)) {
        return false;
    }

    const srcPath = path.join(projectDir, relativePath);
    const destPath = path.join(distDir, relativePath);

    if (fs.existsSync(srcPath) && fs.statSync(srcPath).isFile()) {
        copySingleFile(srcPath, destPath);
        return true;
    }

    return false;
};

/**
 * Clean dist directory
 * @param {string} distDir - Directory to clean
 */
const cleanDist = distDir => {
    if (fs.existsSync(distDir)) {
        fs.rmSync(distDir, {recursive: true, force: true});
    }
};

module.exports = {
    copySingleFile,
    getAllFiles,
    copyResources,
    copyChangedFile,
    cleanDist
};
