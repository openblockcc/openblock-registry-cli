/**
 * Image processor for compressing and copying local image files to dist
 * Handles image size validation and compression
 */

const fs = require('fs');
const path = require('path');

// Maximum image size in bytes (50KB)
const MAX_IMAGE_SIZE = 50 * 1024;

// Supported image extensions
const IMAGE_EXTENSIONS = ['.png', '.jpg', '.jpeg', '.svg', '.webp', '.gif'];

// Fields in openblock config that contain image paths
const IMAGE_URL_FIELDS = [
    'iconURL',
    'connectionIconURL',
    'connectionSmallIconURL'
];

/**
 * Get MIME type from file extension
 * @param {string} filePath - File path
 * @returns {string} MIME type
 */
const getMimeType = filePath => {
    const ext = path.extname(filePath).toLowerCase();
    const mimeTypes = {
        '.png': 'image/png',
        '.jpg': 'image/jpeg',
        '.jpeg': 'image/jpeg',
        '.svg': 'image/svg+xml',
        '.webp': 'image/webp',
        '.gif': 'image/gif'
    };
    return mimeTypes[ext] || 'application/octet-stream';
};

/**
 * Resolve image path with extension
 * Tries to find the image file with common extensions if not specified
 * @param {string} basePath - Base path (may or may not have extension)
 * @returns {string|null} Resolved file path or null if not found
 */
const resolveImagePath = basePath => {
    // If path already has a valid extension and exists, use it
    const ext = path.extname(basePath).toLowerCase();
    if (IMAGE_EXTENSIONS.includes(ext) && fs.existsSync(basePath)) {
        return basePath;
    }

    // Try adding common extensions
    for (const extension of IMAGE_EXTENSIONS) {
        const fullPath = basePath + extension;
        if (fs.existsSync(fullPath)) {
            return fullPath;
        }
    }

    // Check if the original path exists (might be extensionless but valid)
    if (fs.existsSync(basePath)) {
        return basePath;
    }

    return null;
};

/**
 * Compress image to target size using sharp
 * @param {string} imagePath - Path to image file
 * @param {number} targetSize - Target size in bytes
 * @returns {Promise<Buffer>} Compressed image buffer
 */
const compressImage = async (imagePath, targetSize) => {
    // Dynamic import for sharp (ESM module)
    const sharp = (await import('sharp')).default;

    const ext = path.extname(imagePath).toLowerCase();

    // SVG files cannot be compressed the same way
    if (ext === '.svg') {
        throw new Error(
            `SVG file "${imagePath}" exceeds ${targetSize / 1024}KB and cannot be compressed. ` +
            'Please optimize it manually.'
        );
    }

    let quality = 80;
    let buffer;
    const minQuality = 10;

    // Read original image
    let image = sharp(imagePath);
    const metadata = await image.metadata();

    // Try reducing quality first
    while (quality >= minQuality) {
        if (ext === '.png') {
            buffer = await image.png({quality, compressionLevel: 9}).toBuffer();
        } else if (ext === '.jpg' || ext === '.jpeg') {
            buffer = await image.jpeg({quality}).toBuffer();
        } else if (ext === '.webp') {
            buffer = await image.webp({quality}).toBuffer();
        } else {
            // For other formats, convert to PNG
            buffer = await image.png({quality, compressionLevel: 9}).toBuffer();
        }

        if (buffer.length <= targetSize) {
            return buffer;
        }

        quality -= 10;
    }

    // If quality reduction is not enough, try resizing
    let scale = 0.9;
    while (scale >= 0.3) {
        const newWidth = Math.round(metadata.width * scale);
        const newHeight = Math.round(metadata.height * scale);

        image = sharp(imagePath).resize(newWidth, newHeight);

        if (ext === '.png') {
            buffer = await image.png({quality: minQuality, compressionLevel: 9}).toBuffer();
        } else if (ext === '.jpg' || ext === '.jpeg') {
            buffer = await image.jpeg({quality: minQuality}).toBuffer();
        } else if (ext === '.webp') {
            buffer = await image.webp({quality: minQuality}).toBuffer();
        } else {
            buffer = await image.png({quality: minQuality, compressionLevel: 9}).toBuffer();
        }

        if (buffer.length <= targetSize) {
            return buffer;
        }

        scale -= 0.1;
    }

    throw new Error(
        `Cannot compress "${imagePath}" to under ${targetSize / 1024}KB. ` +
        `Current size after max compression: ${(buffer.length / 1024).toFixed(1)}KB. ` +
        `Please provide a smaller image.`
    );
};

/**
 * Compress and copy an image file to the dist directory.
 * Skips files that are already remote URLs or base64 data URIs.
 * @param {string} projectDir - Project directory
 * @param {string} distDir - Dist output directory
 * @param {string} imagePath - Relative image path from package.json
 * @returns {Promise<boolean>} True if the file was processed, false if skipped
 */
const processImageFile = async (projectDir, distDir, imagePath) => {
    // Skip if already base64 or remote URL
    if (!imagePath || imagePath.startsWith('data:') || imagePath.startsWith('http://') || imagePath.startsWith('https://')) {
        return false;
    }

    // Resolve relative path from project root
    const fullPath = path.resolve(projectDir, imagePath);
    const resolvedPath = resolveImagePath(fullPath);

    if (!resolvedPath) {
        throw new Error(`Image file not found: "${imagePath}" (tried extensions: ${IMAGE_EXTENSIONS.join(', ')})`);
    }

    // Determine destination path (same relative location under distDir)
    const relativeToProject = path.relative(projectDir, resolvedPath);
    const destPath = path.join(distDir, relativeToProject);
    const destDirPath = path.dirname(destPath);

    if (!fs.existsSync(destDirPath)) {
        fs.mkdirSync(destDirPath, {recursive: true});
    }

    const stats = fs.statSync(resolvedPath);
    if (stats.size <= MAX_IMAGE_SIZE) {
        fs.copyFileSync(resolvedPath, destPath);
    } else {
        // Compress to fit within size limit
        const buffer = await compressImage(resolvedPath, MAX_IMAGE_SIZE);
        fs.writeFileSync(destPath, buffer);
    }

    return true;
};

/**
 * Process package.json image fields: compress and copy each local image to dist.
 * The package.json itself is not modified — relative paths remain as-is.
 * @param {string} projectDir - Project directory
 * @param {string} distDir - Dist output directory
 * @param {object} packageJson - Parsed package.json object
 * @returns {Promise<{processedPaths: string[]}>} Relative paths of images that were processed
 */
const processPackageJsonImages = async (projectDir, distDir, packageJson) => {
    if (!packageJson.openblock) {
        return {processedPaths: []};
    }

    const openblock = packageJson.openblock;
    const processedPaths = [];

    for (const field of IMAGE_URL_FIELDS) {
        if (openblock[field]) {
            const processed = await processImageFile(projectDir, distDir, openblock[field]);
            if (processed) {
                processedPaths.push(openblock[field]);
            }
        }
    }

    return {processedPaths};
};

module.exports = {
    MAX_IMAGE_SIZE,
    IMAGE_EXTENSIONS,
    IMAGE_URL_FIELDS,
    getMimeType,
    resolveImagePath,
    compressImage,
    processImageFile,
    processPackageJsonImages
};
