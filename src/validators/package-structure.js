/**
 * Package.json structure validator
 * Validates detailed package.json structure for device and extension plugins
 */

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

    // Check programLanguage
    const validProgramLanguages = ['block', 'cpp', 'microPython'];
    if (!Array.isArray(openblock.programLanguage) || openblock.programLanguage.length === 0) {
        errors.push('openblock.programLanguage must be a non-empty array');
    } else {
        const invalidLangs = openblock.programLanguage.filter(l => !validProgramLanguages.includes(l));
        if (invalidLangs.length > 0) {
            errors.push(`Invalid programLanguage values: ${invalidLangs.join(', ')}.` +
                ` Must be: ${validProgramLanguages.join(', ')}`);
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

    // Check supportDevice
    if (!Array.isArray(openblock.supportDevice) || openblock.supportDevice.length === 0) {
        errors.push('openblock.supportDevice must be a non-empty array');
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

    // Check openblock.translations
    if (!openblock.translations || typeof openblock.translations !== 'string') {
        errors.push('openblock.translations is required');
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
