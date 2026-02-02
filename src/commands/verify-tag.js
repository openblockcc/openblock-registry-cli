/**
 * Verify tag command
 * Validates that git tag matches package.json version
 * Used by husky pre-push hook to prevent pushing tags with mismatched versions
 */

const {execSync} = require('child_process');
const path = require('path');
const fs = require('fs');
const chalk = require('chalk');

/**
 * Read package.json from current directory
 * @returns {object} Package.json content
 */
const readPackageJson = () => {
    const pkgPath = path.join(process.cwd(), 'package.json');
    if (!fs.existsSync(pkgPath)) {
        throw new Error('package.json not found in current directory');
    }
    return JSON.parse(fs.readFileSync(pkgPath, 'utf-8'));
};

/**
 * Parse refs being pushed from stdin (git pre-push hook format)
 * Format: <local ref> <local sha> <remote ref> <remote sha>
 * @returns {Promise<string[]>} Array of tag names being pushed
 */
const parseTagsFromStdin = () => {
    return new Promise(resolve => {
        let input = '';

        // Check if stdin is a TTY (interactive mode, no piped input)
        if (process.stdin.isTTY) {
            resolve([]);
            return;
        }

        process.stdin.setEncoding('utf-8');
        process.stdin.on('data', chunk => {
            input += chunk;
        });

        process.stdin.on('end', () => {
            const tags = [];
            const lines = input.trim().split('\n').filter(line => line);

            for (const line of lines) {
                const parts = line.split(/\s+/);
                if (parts.length >= 3) {
                    const localRef = parts[0];
                    // Check if this is a tag ref
                    if (localRef.startsWith('refs/tags/')) {
                        const tagName = localRef.replace('refs/tags/', '');
                        tags.push(tagName);
                    }
                }
            }
            resolve(tags);
        });

        // Set a timeout in case stdin never ends
        setTimeout(() => {
            resolve([]);
        }, 1000);
    });
};

/**
 * Verify a single tag against package.json version
 * @param {string} tagName - Tag name to verify
 * @param {string} version - Expected version from package.json
 * @returns {boolean} True if tag matches version
 */
const verifyTag = (tagName, version) => {
    // Support both "v1.0.0" and "1.0.0" formats
    const normalizedTag = tagName.startsWith('v') ? tagName.slice(1) : tagName;
    const normalizedVersion = version.startsWith('v') ? version.slice(1) : version;

    return normalizedTag === normalizedVersion;
};

/**
 * Execute verify-tag command
 * @param {string} tagName - Optional tag name to verify directly
 */
const verifyTagCommand = async tagName => {
    try {
        const pkg = readPackageJson();
        const version = pkg.version;

        console.log(chalk.cyan('\n🏷️  OpenBlock Tag Verification\n'));
        console.log(`   Package version: ${chalk.bold(version)}`);

        let tagsToVerify = [];

        if (tagName) {
            // Direct tag name provided as argument
            tagsToVerify = [tagName];
            console.log(`   Tag to verify: ${chalk.bold(tagName)}`);
        } else {
            // Parse tags from stdin (pre-push hook mode)
            tagsToVerify = await parseTagsFromStdin();

            if (tagsToVerify.length === 0) {
                // No tags being pushed, nothing to verify
                console.log(chalk.gray('   No tags being pushed, skipping verification.\n'));
                process.exit(0);
            }

            console.log(`   Tags being pushed: ${chalk.bold(tagsToVerify.join(', '))}`);
        }

        console.log('');

        let hasError = false;

        for (const tag of tagsToVerify) {
            if (verifyTag(tag, version)) {
                console.log(chalk.green(`   ✓ Tag "${tag}" matches package.json version "${version}"`));
            } else {
                console.log(chalk.red(`   ✗ Tag "${tag}" does NOT match package.json version "${version}"`));
                hasError = true;
            }
        }

        console.log('');

        if (hasError) {
            console.log(chalk.red('❌ Tag verification failed!\n'));
            console.log(chalk.yellow('   Please ensure the tag name matches the version in package.json.'));
            console.log(chalk.yellow('   Supported formats: "1.0.0" or "v1.0.0"\n'));
            process.exit(1);
        }

        console.log(chalk.green('✅ Tag verification passed!\n'));
        process.exit(0);

    } catch (error) {
        console.error(chalk.red(`\nError: ${error.message}\n`));
        process.exit(1);
    }
};

module.exports = verifyTagCommand;

