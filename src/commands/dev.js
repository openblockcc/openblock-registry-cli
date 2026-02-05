/**
 * Dev command
 * Development mode with hot reload and Resource Service registration
 *
 * Simplified architecture:
 * - Libraries: Only local paths supported (bundled in packages)
 * - Toolchains: Only 'latest' version, merged to unified directory
 */

const path = require('path');
const chalk = require('chalk');
const ora = require('ora');
const fs = require('fs');

const {parseBuildIgnore} = require('../lib/builder/build-ignore');
const {cleanDist, copyResources, copySingleFile, processAndCopyPackageJson} = require('../lib/builder/copy-resources');
const {
    getEntryPoints,
    getSimpleSrcFiles,
    createBuildOptions,
    createContext
} = require('../lib/builder/esbuild-wrapper');
const {
    checkResourceService,
    registerToResourceService,
    registerToolchainMerge
} = require('../lib/builder/resource-register');
const {startWatching} = require('../lib/builder/watcher');
const {removeInterfaceFromTranslations} = require('../lib/builder/translations-processor');
const validateOpenBlockFiles = require('../validators/openblock-files');

// Dependency resolution
const {parseDependencies, validateLocalDependencies} = require('../lib/deps/dependency-resolver');
const {fetchAllToolchains} = require('../lib/deps/registry-fetcher');

/**
 * Resolve and download remote toolchains.
 * Libraries are now local-only (no remote download needed).
 *
 * @param {string} projectDir - Project directory
 * @returns {Promise<{success: boolean, toolchainResults: Array}>} Dependency resolution result
 */
const resolveDependencies = async projectDir => {
    let deps;

    try {
        deps = parseDependencies(projectDir);
    } catch (error) {
        // No dependencies defined is OK
        if (error.message === 'package.json not found') {
            throw error;
        }
        return {success: true, toolchainResults: []};
    }

    // Show warnings from parsing (e.g., remote libraries not supported)
    if (deps.warnings && deps.warnings.length > 0) {
        console.log(chalk.yellow('\nDependency warnings:'));
        deps.warnings.forEach(warn => console.log(chalk.yellow(`  [WARN] ${warn}`)));
    }

    // Validate local dependencies
    const localValidation = validateLocalDependencies(projectDir, deps);
    if (!localValidation.valid) {
        console.log(chalk.red('\nLocal dependency errors:'));
        localValidation.errors.forEach(err => console.log(chalk.red(`  [ERROR] ${err}`)));
        return {success: false, toolchainResults: []};
    }

    // Check if there are remote toolchains to download
    const remoteToolchains = deps.toolchains.remote;
    if (Object.keys(remoteToolchains).length === 0) {
        return {success: true, toolchainResults: []};
    }

    console.log(chalk.bold('\nToolchain Resolution:'));
    console.log(chalk.dim('─'.repeat(50)));

    const toolchainResults = [];

    // Download remote toolchains
    let currentTcName = '';
    let lastTcPercent = -1;

    const tcResult = await fetchAllToolchains(projectDir, remoteToolchains, {
        onProgress: (name, status) => {
            if (status === 'fetching') {
                currentTcName = name;
                lastTcPercent = -1;
            } else if (status === 'done' || status === 'error') {
                // Clear the progress line
                process.stdout.write('\r\x1b[K');
            }
        },
        onDownloadProgress: (percent, speed, downloaded, total) => {
            // Only update when percent changes to reduce updates
            if (percent === lastTcPercent) return;
            lastTcPercent = percent;

            const progress = `${percent}% (${downloaded}/${total}) ${speed}`;
            const text = `  Downloading toolchain: ${currentTcName}... ${progress}`;
            process.stdout.write(`\r${text}\x1b[K`);
        },
        onStatus: status => {
            if (status === 'verifying') {
                process.stdout.write(`\r  Verifying toolchain: ${currentTcName}...\x1b[K`);
            } else if (status === 'extracting') {
                process.stdout.write(`\r  Extracting toolchain: ${currentTcName}...\x1b[K`);
            }
        }
    });

    toolchainResults.push(...tcResult.results);

    if (tcResult.success) {
        const skipped = tcResult.results.filter(r => r.skipped).length;
        const downloaded = tcResult.results.filter(r => !r.skipped && r.success).length;
        console.log(chalk.green(`Toolchains: ${downloaded} downloaded, ${skipped} already exist`));

        // Merge downloaded toolchains to unified directory
        const downloadedResults = tcResult.results.filter(r => r.extractPath);
        if (downloadedResults.length > 0) {
            console.log(chalk.dim('  Merging toolchains to unified directory...'));
            const mergeResult = await registerToolchainMerge(downloadedResults);
            if (mergeResult.success) {
                console.log(chalk.green(`  [OK] Merged ${mergeResult.merged} components`));
            } else {
                console.log(chalk.yellow(`  [WARN] Merge completed with errors`));
            }
            // Extracted toolchains are kept in .openblock/toolchains/
            // Archives are cached in .openblock/downloads/
        }
    } else {
        console.log(chalk.red(`[FAIL] Some toolchains failed to download`));
        tcResult.results.filter(r => !r.success).forEach(r => {
            console.log(chalk.red(`  [ERROR] ${r.name}: ${r.error}`));
        });
    }

    const allSuccess = toolchainResults.every(r => r.success);
    return {success: allSuccess, toolchainResults};
};

/**
 * Execute dev command
 */
const dev = async function () {
    const projectDir = process.cwd();
    const distDir = path.join(projectDir, 'dist');
    const srcDir = path.join(projectDir, 'src');
    const srcOutDir = path.join(distDir, 'src');

    const spinner = ora();

    console.log(chalk.cyan('\nOpenBlock Plugin Dev Mode\n'));

    // Check if Resource Service is running first
    const serviceCheck = await checkResourceService();
    if (!serviceCheck.running) {
        console.log(chalk.red(`[FAIL] ${serviceCheck.message}`));
        console.log(chalk.yellow('\nPlease start OpenBlock Resource Service before running dev command.'));
        process.exit(1);
    }

    try {
        // Step 1: Validate openblock file paths
        spinner.start('Validating openblock file paths...');
        const fileValidation = validateOpenBlockFiles(projectDir);

        if (!fileValidation.valid) {
            spinner.fail('OpenBlock file validation failed');
            console.log(chalk.red('\nFile validation errors:'));
            fileValidation.errors.forEach(error => {
                console.log(chalk.red(`   ✗ ${error}`));
            });
            process.exit(1);
        }

        if (fileValidation.warnings.length > 0) {
            spinner.warn('OpenBlock file validation passed with warnings');
            fileValidation.warnings.forEach(warning => {
                console.log(chalk.yellow(`   ⚠ ${warning}`));
            });
        } else {
            spinner.succeed('OpenBlock file paths validated');
        }

        // Step 2: Resolve and download dependencies
        const depResult = await resolveDependencies(projectDir);
        if (!depResult.success) {
            console.log(chalk.red('\nDependency resolution failed. Please fix the errors above.'));
            process.exit(1);
        }

        // Parse ignore patterns
        let ignorePatterns = parseBuildIgnore(projectDir);

        // Get entry points and simple files
        const entryPoints = getEntryPoints(srcDir, false);
        const simpleSrcFiles = getSimpleSrcFiles(srcDir, false);

        // Auto-ignore entry points (files that will be bundled by esbuild)
        // This prevents them from being copied twice
        if (entryPoints.length > 0) {
            const entryPointPatterns = entryPoints.map(file => {
                const relativePath = path.relative(projectDir, file);
                return relativePath.replace(/\\/g, '/');
            });
            ignorePatterns = [...ignorePatterns, ...entryPointPatterns];
        }

        // Show build info
        console.log(chalk.bold('\nBuild Information:'));
        console.log(chalk.dim('─'.repeat(50)));

        if (entryPoints.length > 0) {
            console.log(chalk.green(`${entryPoints.length} file(s) will be bundled by esbuild:`));
            entryPoints.forEach(file => {
                const relativePath = path.relative(projectDir, file);
                console.log(chalk.dim(`  - ${relativePath}`));
            });
        } else {
            console.log(chalk.yellow('No src files with imports found, skipping esbuild bundling.'));
        }

        if (simpleSrcFiles.length > 0) {
            console.log(chalk.dim(`${simpleSrcFiles.length} simple file(s) will be copied directly`));
        }

        if (entryPoints.length > 0) {
            console.log(chalk.dim(`${entryPoints.length} file(s) auto-ignored (will be bundled)`));
        }
        console.log('');

        // Clean dist directory
        spinner.start('Cleaning dist directory...');
        cleanDist(distDir);
        spinner.succeed('Cleaned dist/');

        // Create esbuild plugin for resource service registration
        const registerPlugin = {
            name: 'register-to-resource-service',
            setup (build) {
                build.onEnd(async () => {
                    const result = await registerToResourceService(projectDir, distDir);
                    if (result.success) {
                        console.log(chalk.green(`[OK] ${result.message}`));
                    } else {
                        console.log(chalk.yellow(`[WARN] ${result.message}`));
                    }
                });
            }
        };

        // Start esbuild watch mode if there are files with imports
        if (entryPoints.length > 0) {
            spinner.start('Starting esbuild watch mode...');

            const buildOptions = createBuildOptions(entryPoints, srcOutDir, {
                dev: true,
                obfuscate: false,
                plugins: [registerPlugin]
            });

            const ctx = await createContext(buildOptions);
            await ctx.watch();
            spinner.succeed('esbuild watch mode started');
        }

        // Process package.json images (convert to base64) - do this BEFORE copying resources
        spinner.start('Processing package.json images...');
        const packageJsonSrc = path.join(projectDir, 'package.json');
        const packageJsonDest = path.join(distDir, 'package.json');
        const imageResult = await processAndCopyPackageJson(projectDir, packageJsonSrc, packageJsonDest);

        if (!imageResult.success) {
            spinner.fail('Failed to process images');
            imageResult.errors.forEach(err => {
                console.error(chalk.red(`  [ERROR] ${err}`));
            });
            process.exit(1);
        }

        if (imageResult.converted.length > 0) {
            spinner.succeed(`Converted ${imageResult.converted.length} image(s) to base64`);
            imageResult.converted.forEach(field => {
                console.log(chalk.dim(`  - ${field}`));
            });

            // Auto-ignore converted image files (they're now in package.json as base64)
            if (imageResult.convertedPaths.length > 0) {
                const imagePatterns = imageResult.convertedPaths.map(imagePath =>
                    // imagePath is relative to projectDir (e.g., "./assets/icon.png")
                    imagePath.replace(/^\.\//, '').replace(/\\/g, '/')
                );
                ignorePatterns = [...ignorePatterns, ...imagePatterns];
                console.log(chalk.dim(`  Auto-ignored ${imageResult.convertedPaths.length} converted image file(s)`));
            }
        } else {
            spinner.succeed('No local images to convert');
        }

        // Copy resources
        spinner.start('Copying resources...');
        const copiedCount = copyResources(projectDir, distDir, ignorePatterns);
        spinner.succeed(`Copied ${copiedCount} files to dist/`);

        // Copy simple src files
        if (simpleSrcFiles.length > 0) {
            simpleSrcFiles.forEach(file => {
                const relativePath = path.relative(projectDir, file);
                const destPath = path.join(distDir, relativePath);
                copySingleFile(file, destPath);
            });
            console.log(chalk.dim(`  Copied ${simpleSrcFiles.length} simple src file(s)`));
        }

        // Process translations.js - remove interface section (already in package.json l10n)
        spinner.start('Processing translations.js...');
        const packageJson = JSON.parse(fs.readFileSync(packageJsonSrc, 'utf-8'));
        const translationsField = packageJson.openblock?.translations;

        if (translationsField) {
            // Resolve the translations file path in dist
            const translationsDistPath = path.join(distDir, translationsField);

            if (fs.existsSync(translationsDistPath)) {
                const removed = removeInterfaceFromTranslations(translationsDistPath);
                if (removed) {
                    spinner.succeed('Removed interface section from translations.js (already in package.json)');
                } else {
                    spinner.succeed('No interface section to remove from translations.js');
                }
            } else {
                spinner.succeed('No translations.js file found in dist');
            }
        } else {
            spinner.succeed('No translations field in package.json');
        }

        // Register to resource service (initial registration)
        const regResult = await registerToResourceService(projectDir, distDir);
        if (regResult.success) {
            console.log(chalk.green(`[OK] ${regResult.message}`));
        } else {
            console.log(chalk.yellow(`[WARN] ${regResult.message}`));
        }

        // Start watching for file changes
        console.log('');
        spinner.start('Starting file watcher...');

        const onFileChange = async relativePath => {
            const time = chalk.dim(`[${new Date().toLocaleTimeString()}]`);
            console.log(chalk.green(`${time} Updated: ${chalk.cyan(relativePath)}`));

            // Re-register to resource service after file update
            await registerToResourceService(projectDir, distDir);
        };

        startWatching(projectDir, distDir, ignorePatterns, onFileChange);
        spinner.succeed('Watching for changes...');

        console.log(chalk.dim('\nPress Ctrl+C to stop\n'));

    } catch (error) {
        spinner.fail(error.message);
        console.error(chalk.red(error.stack));
        process.exit(1);
    }
};

module.exports = dev;
