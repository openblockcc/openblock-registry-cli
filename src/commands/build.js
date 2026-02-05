/**
 * Build command
 * Builds the plugin for production
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
    runBuild
} = require('../lib/builder/esbuild-wrapper');
const {removeInterfaceFromTranslations} = require('../lib/builder/translations-processor');
const validateOpenBlockFiles = require('../validators/openblock-files');

/**
 * Execute build command
 * @param {object} options - Command options
 * @param {boolean} options.obfuscate - Enable code obfuscation
 */
const build = async function (options = {}) {
    const projectDir = process.cwd();
    const distDir = path.join(projectDir, 'dist');
    const srcDir = path.join(projectDir, 'src');
    const srcOutDir = path.join(distDir, 'src');

    const spinner = ora();

    console.log(chalk.cyan('\nOpenBlock Plugin Builder\n'));

    try {
        // Validate openblock file paths
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

        // Parse ignore patterns
        let ignorePatterns = parseBuildIgnore(projectDir);

        // Get entry points and simple files
        const entryPoints = getEntryPoints(srcDir, options.obfuscate);
        const simpleSrcFiles = getSimpleSrcFiles(srcDir, options.obfuscate);

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
        console.log(chalk.bold('Build Information:'));
        console.log(chalk.dim('─'.repeat(50)));

        if (options.obfuscate) {
            console.log(chalk.green('Code obfuscation: ENABLED'));
            console.log(chalk.dim('  - Minify identifiers: ON'));
            console.log(chalk.dim('  - Remove whitespace: ON'));
            console.log(chalk.dim('  - Remove comments: ON'));
        } else {
            console.log(chalk.yellow('Code obfuscation: DISABLED'));
            if (simpleSrcFiles.length > 0) {
                console.log(chalk.dim(`  - ${simpleSrcFiles.length} simple file(s) will be copied directly`));
            }
        }

        if (entryPoints.length > 0) {
            console.log(chalk.dim(`  - ${entryPoints.length} file(s) auto-ignored (will be bundled)`));
        }
        console.log('');

        // Clean dist directory
        spinner.start('Cleaning dist directory...');
        cleanDist(distDir);
        spinner.succeed('Cleaned dist/');

        // Run esbuild if there are files with imports
        if (entryPoints.length > 0) {
            const bundleMsg = options.obfuscate ?
                `Bundling and obfuscating ${entryPoints.length} file(s)...` :
                `Bundling ${entryPoints.length} file(s)...`;

            spinner.start(bundleMsg);

            console.log('');
            entryPoints.forEach(file => {
                const relativePath = path.relative(projectDir, file);
                console.log(chalk.dim(`  - ${relativePath}`));
            });

            const buildOptions = createBuildOptions(entryPoints, srcOutDir, {
                dev: false,
                obfuscate: options.obfuscate
            });

            const result = await runBuild(buildOptions);
            spinner.succeed(`Bundled ${entryPoints.length} file(s)`);

            // Show build analysis
            if (result.metafile) {
                const esbuild = await import('esbuild');
                const analysis = await esbuild.analyzeMetafile(result.metafile);
                console.log('');
                console.log(chalk.bold('Build Analysis:'));
                console.log(chalk.dim('─'.repeat(50)));
                console.log(analysis);
            }
        } else {
            console.log(chalk.yellow('No src files with imports found, skipping esbuild bundling.'));
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

        // Copy simple src files (without imports) directly
        if (simpleSrcFiles.length > 0) {
            spinner.start(`Copying ${simpleSrcFiles.length} simple src file(s)...`);
            simpleSrcFiles.forEach(file => {
                const relativePath = path.relative(projectDir, file);
                const destPath = path.join(distDir, relativePath);
                copySingleFile(file, destPath);
            });
            spinner.succeed(`Copied ${simpleSrcFiles.length} simple src file(s)`);
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

        console.log(chalk.green('\nBuild complete!\n'));

    } catch (error) {
        spinner.fail(error.message);
        console.error(chalk.red(error.stack));
        process.exit(1);
    }
};

module.exports = build;
