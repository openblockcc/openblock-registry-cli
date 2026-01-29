/**
 * esbuild wrapper
 * Handles ES module bundling with esbuild
 */

const fs = require('fs');
const path = require('path');

/**
 * Check if a file contains import statements
 * @param {string} filePath - Path to file
 * @returns {boolean} True if file has imports
 */
const hasImportStatement = filePath => {
    try {
        const content = fs.readFileSync(filePath, 'utf-8');
        // Check for ES6 import or require statements
        return /^\s*import\s+/m.test(content) || /require\s*\(/m.test(content);
    } catch (error) {
        return false;
    }
};

/**
 * Get entry points that need bundling (files with imports)
 * @param {string} srcDir - Source directory
 * @param {boolean} obfuscate - If true, bundle all JS files
 * @returns {string[]} Array of entry point paths
 */
const getEntryPoints = (srcDir, obfuscate = false) => {
    if (!fs.existsSync(srcDir)) return [];

    const entries = [];
    const files = fs.readdirSync(srcDir);

    for (const file of files) {
        const fullPath = path.join(srcDir, file);
        const stat = fs.statSync(fullPath);

        if (stat.isFile() && path.extname(file) === '.js') {
            // In obfuscate mode, bundle all JS files
            // In normal mode, only bundle files with imports
            if (obfuscate || hasImportStatement(fullPath)) {
                entries.push(fullPath);
            }
        }
    }

    return entries;
};

/**
 * Get src files that don't need bundling (no imports)
 * @param {string} srcDir - Source directory
 * @param {boolean} obfuscate - If true, returns empty (all files bundled)
 * @returns {string[]} Array of simple file paths
 */
const getSimpleSrcFiles = (srcDir, obfuscate = false) => {
    if (!fs.existsSync(srcDir)) return [];
    if (obfuscate) return []; // In obfuscate mode, all JS files are bundled

    const simpleFiles = [];
    const files = fs.readdirSync(srcDir);

    for (const file of files) {
        const fullPath = path.join(srcDir, file);
        const stat = fs.statSync(fullPath);

        if (stat.isFile() && path.extname(file) === '.js') {
            // Only add if file has NO import statements
            if (!hasImportStatement(fullPath)) {
                simpleFiles.push(fullPath);
            }
        }
    }

    return simpleFiles;
};

/**
 * Create esbuild configuration options
 * @param {string[]} entries - Entry point files
 * @param {string} outDir - Output directory
 * @param {object} options - Build options
 * @param {boolean} options.dev - Development mode
 * @param {boolean} options.obfuscate - Enable code obfuscation
 * @param {object[]} options.plugins - esbuild plugins
 * @returns {object} esbuild build options
 */
const createBuildOptions = (entries, outDir, options = {}) => {
    const {dev = false, obfuscate = false, plugins = []} = options;

    const baseOptions = {
        entryPoints: entries,
        outdir: outDir,
        bundle: true,
        format: 'esm',
        platform: 'browser',
        target: ['es2020'],
        sourcemap: dev,
        legalComments: 'none',
        outExtension: {'.js': '.js'},
        logLevel: 'info',
        treeShaking: true,
        metafile: !dev,
        plugins
    };

    // Add obfuscation options for production builds
    if (obfuscate && !dev) {
        return {
            ...baseOptions,
            minify: true,
            minifyWhitespace: true,
            minifyIdentifiers: true,
            minifySyntax: true,
            legalComments: 'none',
            keepNames: false
        };
    }

    return baseOptions;
};

/**
 * Run esbuild
 * @param {object} buildOptions - esbuild options
 * @returns {Promise<object>} Build result
 */
const runBuild = async buildOptions => {
    // Dynamic import for esbuild (ESM module)
    const esbuild = await import('esbuild');
    return esbuild.build(buildOptions);
};

/**
 * Create esbuild context for watch mode
 * @param {object} buildOptions - esbuild options
 * @returns {Promise<object>} esbuild context
 */
const createContext = async buildOptions => {
    const esbuild = await import('esbuild');
    return esbuild.context(buildOptions);
};

module.exports = {
    hasImportStatement,
    getEntryPoints,
    getSimpleSrcFiles,
    createBuildOptions,
    runBuild,
    createContext
};
