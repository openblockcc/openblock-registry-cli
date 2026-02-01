# OpenBlock Registry CLI

[![npm version](https://img.shields.io/npm/v/openblock-registry-cli.svg)](https://www.npmjs.com/package/openblock-registry-cli)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](https://opensource.org/licenses/MIT)
[![Node.js Version](https://img.shields.io/badge/node-%3E%3D14.0.0-brightgreen.svg)](https://nodejs.org/)

> Command-line tool for building, validating, and publishing plugins to OpenBlock Registry

## 📖 Overview

**OpenBlock Registry CLI** is the official tool for OpenBlock plugin developers. It streamlines the entire plugin development lifecycle from scaffolding to publishing.

### Key Features

- 🚀 **Quick Start** - Generate plugin scaffolds with interactive prompts
- 🔨 **Build System** - Bundle and optimize plugins for production
- 🔍 **Validation** - Comprehensive validation before publishing
- 📦 **Publishing** - Automated PR creation to OpenBlock Registry
- 🌍 **i18n Support** - Built-in translation management
- ⚡ **Dev Mode** - Hot reload for rapid development

## 📦 Installation

### Prerequisites

- **Node.js** >= 14.0.0
- **Git** (for publishing)
- **GitHub Account** (for publishing)

### Install Globally

```bash
npm install -g openblock-registry-cli
```

Or use the short alias:

```bash
npm install -g openblock-registry-cli
# Then use 'obr' instead of 'openblock-registry-cli'
```

### Verify Installation

```bash
openblock-registry-cli --version
# or
obr --version
```

## 🚀 Quick Start

### 1. Create a New Plugin

```bash
openblock-registry-cli init
```

Follow the interactive prompts to generate your plugin scaffold.

### 2. Develop Your Plugin

```bash
cd your-plugin-name
openblock-registry-cli dev
```

This starts development mode with hot reload. Your plugin will be:

- Automatically rebuilt on file changes
- Registered to the plugin server cache

You can open OpenBlock GUI and see your plugin in the device/extension list without publishing.

### 3. Build for Production

```bash
openblock-registry-cli build
```

Optional: Enable code obfuscation (minify, mangle, remove comments):

```bash
openblock-registry-cli build --obfuscate
```

### 4. Validate Your Plugin

```bash
openblock-registry-cli validate
```

### 5. Publish to Registry

```bash
openblock-registry-cli publish
```

This will:

1. Run all validations
2. Request your GitHub token (stored securely)
3. Create a Pull Request to OpenBlock Registry
4. Provide a PR link for tracking

**Dry run** (validate only, don't create PR):

```bash
openblock-registry-cli publish --dry-run
```

**GitHub Token Setup:**

1. Go to [GitHub Settings > Developer settings > Personal access tokens](https://github.com/settings/tokens)
2. Click "Generate new token (classic)"
3. Select scopes: `repo` (Full control of private repositories)
4. Generate and copy the token
5. Set it using: `openblock-registry-cli config set github.token YOUR_TOKEN`
