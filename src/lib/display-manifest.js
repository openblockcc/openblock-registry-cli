/**
 * Display-manifest normalization — CLI mirror of the registry's
 * scripts/common/display-manifest.js (§5.10).
 *
 * MUST stay byte-for-byte identical to the registry module: the CLI uses this to
 * generate approved/{id}.json, and the registry's PR-validation bot recomputes
 * the displayHash from the published tag with its own copy. If the two ever
 * disagree, the bot rejects every CLI-generated baseline. The shared test vector
 * in display-manifest.test.js (identical in both repos) guards against drift.
 */

const crypto = require('crypto');

const FROZEN_OPENBLOCK_FIELDS = [
    'name',
    'description',
    'helpLink',
    'learnMore',
    'manufactor',
    'tags'
];

const ICON_FIELDS = [
    'iconURL',
    'connectionIconURL',
    'connectionSmallIconURL'
];

const normalizeMessage = value => {
    if (typeof value === 'string') {
        return value;
    }
    if (value && typeof value === 'object' && value.formatMessage) {
        const fm = value.formatMessage;
        return {
            id: typeof fm.id === 'string' ? fm.id : null,
            default: typeof fm.default === 'string' ? fm.default : null
        };
    }
    return null;
};

const normalizeAuthor = author => {
    if (typeof author === 'string') {
        return author;
    }
    if (author && typeof author === 'object') {
        return {
            name: author.name || null,
            email: author.email || null,
            url: author.url || null
        };
    }
    return null;
};

/**
 * Extract the frozen display object from a package.json.
 * @param {object} packageJson - package.json with an openblock section
 * @returns {object} Canonical display object
 */
const extractDisplay = packageJson => {
    const openblock = packageJson.openblock || {};
    const display = {};

    for (const field of FROZEN_OPENBLOCK_FIELDS) {
        if (!Object.prototype.hasOwnProperty.call(openblock, field)) {
            continue;
        }
        const value = openblock[field];
        if (field === 'name' || field === 'description') {
            display[field] = normalizeMessage(value);
        } else if (field === 'tags') {
            display[field] = Array.isArray(value) ? value.map(String) : value;
        } else {
            display[field] = value;
        }
    }

    if (Object.prototype.hasOwnProperty.call(packageJson, 'author')) {
        display.author = normalizeAuthor(packageJson.author);
    }

    return display;
};

/**
 * List referenced icon fields with their raw values.
 * @param {object} packageJson - package.json with an openblock section
 * @returns {Array<{field: string, value: string}>} Referenced icon fields
 */
const listIconFields = packageJson => {
    const openblock = packageJson.openblock || {};
    const refs = [];
    for (const field of ICON_FIELDS) {
        const value = openblock[field];
        if (typeof value === 'string' && value) {
            refs.push({field, value});
        }
    }
    return refs;
};

/**
 * Hash an icon's raw bytes.
 * @param {Buffer|Uint8Array} bytes - Icon file bytes
 * @returns {string} `sha256:<hex>`
 */
const hashIconBytes = bytes => {
    const hash = crypto.createHash('sha256');
    hash.update(bytes);
    return `sha256:${hash.digest('hex')}`;
};

/**
 * Deterministically stringify with sorted keys.
 * @param {*} value - JSON-serializable value
 * @returns {string} Canonical JSON
 */
const canonicalStringify = value => {
    const canonicalize = node => {
        if (Array.isArray(node)) {
            return node.map(canonicalize);
        }
        if (node && typeof node === 'object') {
            const out = {};
            for (const key of Object.keys(node).sort()) {
                out[key] = canonicalize(node[key]);
            }
            return out;
        }
        return node;
    };
    return JSON.stringify(canonicalize(value));
};

/**
 * Compute the combined displayHash over display + icon hashes.
 * @param {object} display - Display object from extractDisplay()
 * @param {object} icons - Map of icon field → `sha256:<hex>`
 * @returns {string} `sha256:<hex>`
 */
const computeDisplayHash = (display, icons) => {
    const payload = canonicalStringify({display, icons: icons || {}});
    const hash = crypto.createHash('sha256');
    hash.update(payload, 'utf-8');
    return `sha256:${hash.digest('hex')}`;
};

/**
 * Assemble an approved-baseline record for approved/{id}.json.
 * @param {object} options - Record options
 * @param {string} options.id - Plugin id
 * @param {string} options.type - 'devices' or 'extensions'
 * @param {string} options.repository - Canonical repository URL
 * @param {object} options.display - Display object from extractDisplay()
 * @param {object} options.icons - Map of icon field → `sha256:<hex>`
 * @returns {object} Approved record
 */
const buildApprovedRecord = ({id, type, repository, display, icons}) => ({
    id,
    type,
    repository,
    display,
    icons: icons || {},
    displayHash: computeDisplayHash(display, icons)
});

module.exports = {
    FROZEN_OPENBLOCK_FIELDS,
    ICON_FIELDS,
    extractDisplay,
    listIconFields,
    hashIconBytes,
    canonicalStringify,
    computeDisplayHash,
    buildApprovedRecord
};
