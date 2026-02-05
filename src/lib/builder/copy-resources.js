/**
 * Resource copy utilities
 * Copies files to dist directory, respecting .buildignore
 */

const fs = require('fs');
const path = require('path');
const {shouldIgnore} = require('./build-ignore');
const {processPackageJsonImages, IMAGE_URL_FIELDS} = require('./image-processor');
const {injectInterfaceTranslations} = require('./translations-processor');
const {processPackageJsonForBuild} = require('../package-json-processor');

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
 * Process and copy package.json with base64 images and field filtering
 * @param {string} projectDir - Project directory
 * @param {string} srcPath - Source package.json path
 * @param {string} destPath - Destination package.json path
 * @returns {Promise<{success: boolean, converted: string[], convertedPaths: string[], errors: string[]}>}
 * Processing result
 */
const processAndCopyPackageJson = async (projectDir, srcPath, destPath) => {
    const result = {
        success: true,
        converted: [],
        convertedPaths: [], // Paths of converted image files (to be ignored during copy)
        errors: []
    };

    try {
        let packageJson = JSON.parse(fs.readFileSync(srcPath, 'utf-8'));

        // Step 1: Inject interface translations from translations.js into l10n field
        packageJson = injectInterfaceTranslations(projectDir, packageJson);

        // Step 2: Check if there are image fields to process
        const openblock = packageJson.openblock || {};
        const hasImageFields = IMAGE_URL_FIELDS.some(field => {
            const value = openblock[field];
            return value &&
                !value.startsWith('data:') &&
                !value.startsWith('http://') &&
                !value.startsWith('https://');
        });

        let processedJson = packageJson;

        // Step 3: Process images and convert to base64 if needed
        if (hasImageFields) {
            processedJson = await processPackageJsonImages(projectDir, packageJson);

            // Track which fields were converted and their file paths
            for (const field of IMAGE_URL_FIELDS) {
                const originalPath = openblock[field];
                const processedPath = processedJson.openblock[field];

                if (originalPath && processedPath !== originalPath) {
                    result.converted.push(field);

                    // Add the original image file path to convertedPaths
                    // This will be used to auto-ignore these files during copy
                    if (!originalPath.startsWith('data:') &&
                        !originalPath.startsWith('http://') &&
                        !originalPath.startsWith('https://')) {
                        result.convertedPaths.push(originalPath);
                    }
                }
            }
        }

        // Step 4: Filter package.json fields using whitelist
        processedJson = processPackageJsonForBuild(processedJson);

        // Step 5: Write processed package.json
        const destDir = path.dirname(destPath);
        if (!fs.existsSync(destDir)) {
            fs.mkdirSync(destDir, {recursive: true});
        }
        fs.writeFileSync(destPath, JSON.stringify(processedJson, null, 2));

    } catch (error) {
        result.success = false;
        result.errors.push(error.message);
    }

    return result;
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
    cleanDist,
    processAndCopyPackageJson
};
