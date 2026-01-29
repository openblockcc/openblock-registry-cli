#!/usr/bin/env node

/**
 * OpenBlock Registry CLI
 * Command line tool for building and publishing plugins to OpenBlock Registry
 */

const {program} = require('commander');
const pkg = require('../package.json');

// Import commands
const init = require('../src/commands/init');
const build = require('../src/commands/build');
const dev = require('../src/commands/dev');
const publish = require('../src/commands/publish');
const validate = require('../src/commands/validate');
const info = require('../src/commands/info');
const config = require('../src/commands/config');
const unpublish = require('../src/commands/unpublish');
const i18n = require('../src/commands/i18n');

program
    .name('openblock-registry-cli')
    .description('CLI tool for building and publishing plugins to OpenBlock Registry')
    .version(pkg.version);

program
    .command('init')
    .description('Generate a new plugin scaffold')
    .action(init);

program
    .command('build')
    .description('Build the plugin for production')
    .option('-o, --obfuscate', 'Enable code obfuscation (minify, mangle, remove comments)')
    .action(build);

program
    .command('dev')
    .description('Start development mode with hot reload')
    .action(dev);

program
    .command('publish')
    .description('Publish your plugin to OpenBlock Registry')
    .option('-d, --dry-run', 'Validate only, do not create PR')
    .action(publish);

program
    .command('validate')
    .description('Validate your plugin without publishing')
    .action(validate);

program
    .command('info')
    .description('Show information about your published plugin')
    .option('-a, --all', 'Show all versions')
    .action(info);

program
    .command('config <action> [key] [value]')
    .description('Manage CLI configuration (get/set/list)')
    .action(config);

program
    .command('unpublish [version]')
    .description('Remove a published version from the registry')
    .action(unpublish);

program
    .command('i18n [subcommand]')
    .description('Manage translations (extract/push/update)')
    .option('-d, --dir <path>', 'Working directory')
    .action(i18n);

program.parse();
