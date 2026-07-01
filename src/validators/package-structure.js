/**
 * Package.json structure validator
 * Validates detailed package.json structure for device and extension plugins
 */

/**
 * Validate openblock.arch field on a device or extension manifest.
 * Structural check only: non-empty array of non-empty strings.
 * Content is intentionally unconstrained — third-party vendors may coin
 * custom identifiers (e.g. acme-customboard) and the OpenBlock canonical
 * set evolves over time. Extensions may use wildcards (e.g. arduino-*).
 * @param {any} arch - Value of openblock.arch
 * @returns {Array<string>} Error messages
 */
const validateArch = function (arch) {
    const errors = [];
    if (!Array.isArray(arch) || arch.length === 0) {
        errors.push('openblock.arch must be a non-empty array');
        return errors;
    }
    arch.forEach((item, i) => {
        if (typeof item !== 'string' || !item) {
            errors.push(`openblock.arch[${i}] must be a non-empty string`);
        }
    });
    return errors;
};

// Icon fields and the raster formats allowed for them. SVG is rejected: it can
// carry script, and the display channel only needs raster icons. Restricting the
// format at the gate keeps unsafe icons out of the ecosystem and the frozen
// display baseline, so the GUI never has to sanitize at render time.
const ICON_FIELDS = ['iconURL', 'connectionIconURL', 'connectionSmallIconURL'];
const ALLOWED_ICON_EXTENSIONS = ['.png', '.jpg', '.jpeg'];

// Link fields must be plain http(s):// URLs. Forbidding other schemes blocks
// javascript:/data: links, which become RCE when clicked under nodeIntegration.
const LINK_FIELDS = ['helpLink', 'learnMore'];
const SAFE_URL_SCHEME = /^https?:\/\//i;

/**
 * Validate an icon field's file extension (SVG and other non-raster formats are
 * rejected). Only checks fields that are present non-empty strings.
 * @param {string} field - Field name
 * @param {string} value - Field value (relative path or URL)
 * @returns {string|null} Error message or null
 */
const iconExtensionError = function (field, value) {
    const clean = String(value).split(/[?#]/)[0].toLowerCase();
    const dot = clean.lastIndexOf('.');
    const ext = dot >= 0 ? clean.slice(dot) : '';
    if (!ALLOWED_ICON_EXTENSIONS.includes(ext)) {
        return `openblock.${field} must be a ${ALLOWED_ICON_EXTENSIONS.join('/')} image (SVG is not allowed)`;
    }
    return null;
};

/**
 * Validate a link field uses an http(s):// scheme.
 * @param {string} field - Field name
 * @param {string} value - Field value
 * @returns {string|null} Error message or null
 */
const unsafeUrlError = function (field, value) {
    if (!SAFE_URL_SCHEME.test(String(value).trim())) {
        return `openblock.${field} must be an http(s):// URL (javascript:/data: and other schemes are not allowed)`;
    }
    return null;
};

/**
 * Validate formatMessage structure or string
 * @param {any} value - Value to check
 * @returns {boolean} True if valid formatMessage or string
 */
const isValidFormatMessageOrString = function (value) {
    if (typeof value === 'string') return true;
    if (typeof value === 'object' && value !== null) {
        const fm = value.formatMessage;
        if (fm && typeof fm === 'object') {
            return typeof fm.id === 'string' && typeof fm.default === 'string';
        }
    }
    return false;
};

/**
 * Validate device-specific fields
 * @param {object} openblock - openblock field from package.json
 * @returns {Array<string>} Array of error messages
 */
const validateDeviceFields = function (openblock) {
    const errors = [];

    // Check deviceId
    if (!openblock.deviceId || typeof openblock.deviceId !== 'string') {
        errors.push('openblock.deviceId is required for device plugins');
    }

    // Check manufactor
    if (!openblock.manufactor || typeof openblock.manufactor !== 'string') {
        errors.push('openblock.manufactor is required');
    }

    // Check learnMore
    if (!openblock.learnMore || typeof openblock.learnMore !== 'string') {
        errors.push('openblock.learnMore is required');
    }

    // Check bluetoothRequired
    if (typeof openblock.bluetoothRequired !== 'boolean') {
        errors.push('openblock.bluetoothRequired must be a boolean');
    }

    // Check serialportRequired
    if (typeof openblock.serialportRequired !== 'boolean') {
        errors.push('openblock.serialportRequired must be a boolean');
    }

    // Check internetConnectionRequired
    if (typeof openblock.internetConnectionRequired !== 'boolean') {
        errors.push('openblock.internetConnectionRequired must be a boolean');
    }

    // Check programMode
    const validProgramModes = ['realtime', 'upload'];
    if (!Array.isArray(openblock.programMode) || openblock.programMode.length === 0) {
        errors.push('openblock.programMode must be a non-empty array');
    } else {
        const invalidModes = openblock.programMode.filter(m => !validProgramModes.includes(m));
        if (invalidModes.length > 0) {
            errors.push(`Invalid programMode values: ${invalidModes.join(', ')}.` +
                ` Must be: ${validProgramModes.join(', ')}`);
        }
    }

    // Check tags
    const validDeviceTags = ['arduino', 'microPython', 'kit'];
    if (!Array.isArray(openblock.tags) || openblock.tags.length === 0) {
        errors.push('openblock.tags must be a non-empty array');
    } else {
        const invalidTags = openblock.tags.filter(t => !validDeviceTags.includes(t));
        if (invalidTags.length > 0) {
            errors.push(`Invalid tags: ${invalidTags.join(', ')}. Must be: ${validDeviceTags.join(', ')}`);
        }
    }

    // Check arch: required, array of non-empty strings (content unconstrained)
    errors.push(...validateArch(openblock.arch));

    // Check libraries (optional): must be a string (relative directory path)
    if (typeof openblock.libraries !== 'undefined' && typeof openblock.libraries !== 'string') {
        errors.push('openblock.libraries must be a string (relative directory path)');
    }

    // Check firmwares (optional): array of {id, name, file}; ids must be unique
    if (typeof openblock.firmwares !== 'undefined') {
        if (Array.isArray(openblock.firmwares)) {
            const seenIds = new Set();
            openblock.firmwares.forEach((fw, i) => {
                if (!fw || typeof fw !== 'object') {
                    errors.push(`openblock.firmwares[${i}] must be an object`);
                    return;
                }
                if (typeof fw.id !== 'string' || !fw.id) {
                    errors.push(`openblock.firmwares[${i}].id must be a non-empty string`);
                } else if (seenIds.has(fw.id)) {
                    errors.push(`openblock.firmwares[${i}].id "${fw.id}" is duplicated`);
                } else {
                    seenIds.add(fw.id);
                }
                if (!isValidFormatMessageOrString(fw.name)) {
                    errors.push(`openblock.firmwares[${i}].name must be a non-empty string` +
                        ` or a {formatMessage:{id,default}} object`);
                }
                if (typeof fw.file !== 'string' || !fw.file) {
                    errors.push(`openblock.firmwares[${i}].file must be a non-empty string`);
                }
            });
        } else {
            errors.push('openblock.firmwares must be an array of {id, name, file} entries');
        }
    }

    return errors;
};

/**
 * Validate extension-specific fields
 * @param {object} openblock - openblock field from package.json
 * @returns {Array<string>} Array of error messages
 */
const validateExtensionFields = function (openblock) {
    const errors = [];

    // Check extensionId
    if (!openblock.extensionId || typeof openblock.extensionId !== 'string') {
        errors.push('openblock.extensionId is required for extension plugins');
    }

    // Check arch: required, array of non-empty strings (wildcards allowed)
    errors.push(...validateArch(openblock.arch));

    // Reject legacy supportDevice field outright (replaced by arch)
    if (typeof openblock.supportDevice !== 'undefined') {
        errors.push('openblock.supportDevice is no longer supported; use openblock.arch instead');
    }

    // Check tags
    const validExtensionTags = ['ai', 'kit', 'sensor', 'actuator', 'display',
        'communication', 'audio', 'data', 'control', 'other'];
    if (!Array.isArray(openblock.tags) || openblock.tags.length === 0) {
        errors.push('openblock.tags must be a non-empty array');
    } else {
        const invalidTags = openblock.tags.filter(t => !validExtensionTags.includes(t));
        if (invalidTags.length > 0) {
            errors.push(`Invalid tags: ${invalidTags.join(', ')}. Must be: ${validExtensionTags.join(', ')}`);
        }
    }

    return errors;
};

/**
 * Validate package.json structure
 * @param {object} packageJson - Parsed package.json
 * @returns {object} Validation result {valid: boolean, errors: Array<string>}
 */
const validatePackageStructure = function (packageJson) {
    const errors = [];
    const openblock = packageJson.openblock;

    if (!openblock) {
        return {valid: false, errors: ['Missing openblock field']};
    }

    // Check author
    if (!packageJson.author) {
        errors.push('Missing author field');
    }

    // Check openblock.name
    if (!isValidFormatMessageOrString(openblock.name)) {
        errors.push('openblock.name must be a string or valid formatMessage structure');
    }

    // Check openblock.description
    if (!isValidFormatMessageOrString(openblock.description)) {
        errors.push('openblock.description must be a string or valid formatMessage structure');
    }

    // Check openblock.helpLink
    if (!openblock.helpLink || typeof openblock.helpLink !== 'string') {
        errors.push('openblock.helpLink is required');
    }

    // Check openblock.iconURL
    if (!openblock.iconURL || typeof openblock.iconURL !== 'string') {
        errors.push('openblock.iconURL is required');
    }

    // Icon format: reject SVG and other non-raster icons (any present icon field)
    for (const field of ICON_FIELDS) {
        if (typeof openblock[field] === 'string' && openblock[field]) {
            const err = iconExtensionError(field, openblock[field]);
            if (err) errors.push(err);
        }
    }

    // Link scheme: helpLink/learnMore must be http(s):// (no javascript:/data:)
    for (const field of LINK_FIELDS) {
        if (typeof openblock[field] === 'string' && openblock[field]) {
            const err = unsafeUrlError(field, openblock[field]);
            if (err) errors.push(err);
        }
    }

    // Check openblock.translations
    if (!openblock.translations || typeof openblock.translations !== 'string') {
        errors.push('openblock.translations is required');
    }

    // Check examples (optional, applies to both device and extension):
    // array of {id, name, file, [description], [iconURL]}; ids must be unique
    if (typeof openblock.examples !== 'undefined') {
        if (Array.isArray(openblock.examples)) {
            const seenExampleIds = new Set();
            openblock.examples.forEach((ex, i) => {
                if (!ex || typeof ex !== 'object') {
                    errors.push(`openblock.examples[${i}] must be an object`);
                    return;
                }
                if (typeof ex.id !== 'string' || !ex.id) {
                    errors.push(`openblock.examples[${i}].id must be a non-empty string`);
                } else if (seenExampleIds.has(ex.id)) {
                    errors.push(`openblock.examples[${i}].id "${ex.id}" is duplicated`);
                } else {
                    seenExampleIds.add(ex.id);
                }
                if (!isValidFormatMessageOrString(ex.name)) {
                    errors.push(`openblock.examples[${i}].name must be a non-empty string` +
                        ` or a {formatMessage:{id,default}} object`);
                }
                if (typeof ex.description !== 'undefined' &&
                    !isValidFormatMessageOrString(ex.description)) {
                    errors.push(`openblock.examples[${i}].description must be a non-empty string` +
                        ` or a {formatMessage:{id,default}} object`);
                }
                if (typeof ex.file !== 'string' || !ex.file) {
                    errors.push(`openblock.examples[${i}].file must be a non-empty string`);
                }
                if (typeof ex.iconURL !== 'undefined' &&
                    (typeof ex.iconURL !== 'string' || !ex.iconURL)) {
                    errors.push(`openblock.examples[${i}].iconURL must be a non-empty string`);
                }
            });
        } else {
            errors.push('openblock.examples must be an array of {id, name, file} entries');
        }
    }

    // Type-specific validation
    const pluginType = openblock.pluginType;
    if (pluginType === 'device') {
        errors.push(...validateDeviceFields(openblock));
    } else if (pluginType === 'extension') {
        errors.push(...validateExtensionFields(openblock));
    }

    return {
        valid: errors.length === 0,
        errors
    };
};

module.exports = validatePackageStructure;
