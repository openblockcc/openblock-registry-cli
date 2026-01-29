/**
 * Init command - Generate new plugin scaffold
 */

const path = require('path');
const fs = require('fs-extra');
const inquirer = require('inquirer');
const chalk = require('chalk');
const ora = require('ora');

const TEMPLATES_DIR = path.join(__dirname, '..', 'templates', 'plugin');

const PLUGIN_TYPES = [
    {name: 'extension (scratch) - Scratch style, realtime mode only', value: 'extension-scratch-realtime'},
    {name: 'extension (scratch) - Scratch style, realtime + upload mode', value: 'extension-scratch-both'},
    {name: 'extension (blockly) - Blockly style, upload mode only', value: 'extension-blockly'},
    {name: 'device (arduino) - Arduino framework only', value: 'device-arduino'},
    {name: 'device (micropython) - MicroPython framework only', value: 'device-micropython'},
    {name: 'device (multi) - Multi-framework (Arduino + MicroPython)', value: 'device-multi'}
];

/**
 * Convert plugin ID to class name (PascalCase)
 * @param {string} id - Plugin ID
 * @returns {string} Class name
 */
const toClassName = id => {
    return id
        .replace(/[-_](.)/g, (_, c) => c.toUpperCase())
        .replace(/^(.)/, c => c.toUpperCase());
};

/**
 * Replace template placeholders
 * @param {string} content - Template content
 * @param {object} vars - Variables to replace
 * @returns {string} Processed content
 */
const processTemplate = (content, vars) => {
    let result = content;
    for (const [key, value] of Object.entries(vars)) {
        const regex = new RegExp(`\\{\\{${key}\\}\\}`, 'g');
        result = result.replace(regex, value);
    }
    return result;
};

/**
 * Copy and process template files
 * @param {string} srcDir - Source template directory
 * @param {string} destDir - Destination directory
 * @param {object} vars - Template variables
 */
const copyTemplateDir = async (srcDir, destDir, vars) => {
    if (!fs.existsSync(srcDir)) {
        return;
    }

    const items = fs.readdirSync(srcDir);

    for (const item of items) {
        const srcPath = path.join(srcDir, item);
        let destName = item.replace(/\.tpl$/, '');
        const destPath = path.join(destDir, destName);

        const stat = fs.statSync(srcPath);

        if (stat.isDirectory()) {
            fs.ensureDirSync(destPath);
            await copyTemplateDir(srcPath, destPath, vars);
        } else {
            const content = fs.readFileSync(srcPath, 'utf-8');
            const processed = processTemplate(content, vars);
            fs.writeFileSync(destPath, processed, 'utf-8');
        }
    }
};

/**
 * Get openblock type for package.json
 * @param {string} pluginType - Plugin type selection
 * @returns {string} OpenBlock type
 */
const getOpenBlockType = pluginType => {
    if (pluginType.startsWith('extension')) {
        return 'extension';
    }
    return 'device';
};

/**
 * Get ID field name based on plugin type
 * @param {string} pluginType - Plugin type selection
 * @returns {string} ID field name (extensionId or deviceId)
 */
const getIdFieldName = pluginType => {
    if (pluginType.startsWith('extension')) {
        return 'extensionId';
    }
    return 'deviceId';
};

/**
 * Init command handler
 */
const init = async function () {
    console.log(chalk.cyan('\nOpenBlock Plugin Scaffold Generator\n'));

    // Prompt for plugin info
    const answers = await inquirer.prompt([
        {
            type: 'input',
            name: 'pluginId',
            message: 'Plugin ID (camelCase, e.g. myExtension):',
            validate: input => {
                if (!/^[a-z][a-zA-Z0-9]*$/.test(input)) {
                    return 'Plugin ID must start with lowercase letter and contain only letters and numbers (camelCase)';
                }
                return true;
            }
        },
        {
            type: 'list',
            name: 'pluginType',
            message: 'Plugin type:',
            choices: PLUGIN_TYPES
        },
        {
            type: 'input',
            name: 'pluginName',
            message: 'Plugin name (display name):',
            default: answers => toClassName(answers.pluginId)
        },
        {
            type: 'input',
            name: 'description',
            message: 'Description:',
            default: 'An OpenBlock plugin'
        },
        {
            type: 'input',
            name: 'author',
            message: 'Author:',
            default: ''
        },
        {
            type: 'input',
            name: 'repository',
            message: 'Repository URL (optional):',
            default: ''
        }
    ]);

    const projectDir = path.join(process.cwd(), answers.pluginId);

    // Check if directory exists
    if (fs.existsSync(projectDir)) {
        console.log(chalk.red(`\nError: Directory ${answers.pluginId} already exists`));
        return;
    }

    const spinner = ora('Generating plugin scaffold...').start();

    // Get template directory name (handle scratch subtypes)
    const getTemplateDir = pluginType => {
        if (pluginType.startsWith('extension-scratch')) {
            return 'extension-scratch';
        }
        return pluginType;
    };

    try {
        // Create project directory
        fs.ensureDirSync(projectDir);
        fs.ensureDirSync(path.join(projectDir, 'src'));
        fs.ensureDirSync(path.join(projectDir, 'assets'));

        // Template variables
        const vars = {
            pluginId: answers.pluginId,
            pluginName: answers.pluginName,
            pluginType: getOpenBlockType(answers.pluginType),
            openblockType: getOpenBlockType(answers.pluginType),
            idFieldName: getIdFieldName(answers.pluginType),
            description: answers.description,
            author: answers.author,
            repository: answers.repository,
            className: toClassName(answers.pluginId),
            year: new Date().getFullYear().toString(),
            // For scratch extension: realtime only or both modes
            supportUpload: answers.pluginType === 'extension-scratch-both' ? 'true' : 'false'
        };

        // Copy common templates
        await copyTemplateDir(path.join(TEMPLATES_DIR, 'common'), projectDir, vars);

        // Copy type-specific templates
        const templateDir = getTemplateDir(answers.pluginType);
        await copyTemplateDir(path.join(TEMPLATES_DIR, templateDir), projectDir, vars);

        spinner.succeed('Plugin scaffold generated successfully!');

        // Print summary
        console.log(chalk.green(`\nCreated ${answers.pluginId}/`));
        console.log(chalk.gray('   |- package.json'));
        console.log(chalk.gray('   |- .buildignore'));
        console.log(chalk.gray('   |- .gitignore'));
        console.log(chalk.gray('   |- README.md'));
        console.log(chalk.gray('   |- LICENSE'));
        console.log(chalk.gray('   |- assets/'));
        console.log(chalk.gray('   |- src/'));

        console.log(chalk.cyan('\nNext steps:'));
        console.log(chalk.white(`   cd ${answers.pluginId}`));
        console.log(chalk.white('   npm install'));
        console.log(chalk.white('   openblock-registry-cli dev'));

    } catch (error) {
        spinner.fail('Generation failed');
        console.error(chalk.red(error.message));
        // Cleanup on failure
        if (fs.existsSync(projectDir)) {
            fs.removeSync(projectDir);
        }
    }
};

module.exports = init;

