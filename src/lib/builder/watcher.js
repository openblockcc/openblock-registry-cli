/**
 * File watcher for development mode
 * Watches for file changes and triggers rebuilds
 */

const fs = require('fs');
const path = require('path');
const {shouldIgnore} = require('./build-ignore');
const {copyChangedFile} = require('./copy-resources');

/**
 * Get list of directories to watch (non-ignored top-level directories)
 * @param {string} projectDir - Project directory
 * @param {string[]} ignorePatterns - Patterns to ignore
 * @returns {string[]} Array of directory names to watch
 */
const getWatchDirectories = (projectDir, ignorePatterns) => {
    const items = fs.readdirSync(projectDir);
    return items.filter(item => {
        const fullPath = path.join(projectDir, item);
        if (!fs.existsSync(fullPath) || !fs.statSync(fullPath).isDirectory()) {
            return false;
        }
        return !shouldIgnore(item, ignorePatterns);
    });
};

/**
 * Get list of root-level files to watch
 * @param {string} projectDir - Project directory
 * @param {string[]} ignorePatterns - Patterns to ignore
 * @returns {string[]} Array of file names to watch
 */
const getWatchFiles = (projectDir, ignorePatterns) => {
    const items = fs.readdirSync(projectDir);
    return items.filter(item => {
        const fullPath = path.join(projectDir, item);
        if (!fs.existsSync(fullPath) || !fs.statSync(fullPath).isFile()) {
            return false;
        }
        return !shouldIgnore(item, ignorePatterns);
    });
};

/**
 * Create file change handler
 * @param {string} projectDir - Project directory
 * @param {string} distDir - Destination directory
 * @param {string[]} ignorePatterns - Patterns to ignore
 * @param {function} onFileChange - Callback when file changes
 * @returns {function} File change handler
 */
const createFileChangeHandler = (projectDir, distDir, ignorePatterns, onFileChange) =>
    /**
     * Handle file change event
     * @param {string} basePath - Base path of the watcher
     * @param {string} filename - Changed filename
     */
    async (basePath, filename) => {
        if (!filename) return;

        const relativePath = path.join(basePath, filename);
        const copied = copyChangedFile(projectDir, distDir, relativePath, ignorePatterns);

        if (copied && onFileChange) {
            await onFileChange(relativePath);
        }
    };

/**
 * Start watching for file changes
 * @param {string} projectDir - Project directory
 * @param {string} distDir - Destination directory
 * @param {string[]} ignorePatterns - Patterns to ignore
 * @param {function} onFileChange - Callback when file changes
 * @returns {fs.FSWatcher[]} Array of watchers (for cleanup)
 */
const startWatching = (projectDir, distDir, ignorePatterns, onFileChange) => {
    const watchers = [];
    const handleChange = createFileChangeHandler(projectDir, distDir, ignorePatterns, onFileChange);

    // Watch directories
    const dirsToWatch = getWatchDirectories(projectDir, ignorePatterns);
    for (const dir of dirsToWatch) {
        const dirPath = path.join(projectDir, dir);
        const watcher = fs.watch(dirPath, {recursive: true}, async (_eventType, filename) => {
            await handleChange(dir, filename);
        });

        watcher.on('error', error => {
            console.error(`Watcher error for ${dir}: ${error.message}`);
        });

        watchers.push(watcher);
    }

    // Watch root-level files
    const filesToWatch = getWatchFiles(projectDir, ignorePatterns);
    for (const file of filesToWatch) {
        const filePath = path.join(projectDir, file);
        const watcher = fs.watch(filePath, async () => {
            await handleChange('.', file);
        });

        watcher.on('error', error => {
            console.error(`Watcher error for ${file}: ${error.message}`);
        });

        watchers.push(watcher);
    }

    return watchers;
};

/**
 * Stop all watchers
 * @param {fs.FSWatcher[]} watchers - Array of watchers to close
 */
const stopWatching = watchers => {
    for (const watcher of watchers) {
        watcher.close();
    }
};

module.exports = {
    getWatchDirectories,
    getWatchFiles,
    createFileChangeHandler,
    startWatching,
    stopWatching
};
