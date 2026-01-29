/**
 * @fileoverview
 * Parser for Arduino library.properties files.
 *
 * library.properties format:
 * https://arduino.github.io/arduino-cli/latest/library-specification/#libraryproperties-file-format
 */

const fs = require('fs');
const path = require('path');

/**
 * Parse a library.properties file
 * @param {string} filePath - Path to library.properties file
 * @returns {object|null} Parsed properties or null if file doesn't exist
 */
const parseLibraryProperties = filePath => {
    if (!fs.existsSync(filePath)) {
        return null;
    }

    const content = fs.readFileSync(filePath, 'utf8');
    const props = {};

    content.split('\n').forEach(line => {
        line = line.trim();
        // Skip empty lines and comments
        if (!line || line.startsWith('#')) {
            return;
        }

        const separatorIndex = line.indexOf('=');
        if (separatorIndex > 0) {
            const key = line.substring(0, separatorIndex).trim();
            const value = line.substring(separatorIndex + 1).trim();
            props[key] = value;
        }
    });

    return props;
};

/**
 * Check if a directory is a valid Arduino library
 * @param {string} libDir - Library directory path
 * @returns {boolean} True if valid Arduino library
 */
const isArduinoLibrary = libDir => {
    const propsPath = path.join(libDir, 'library.properties');
    if (!fs.existsSync(propsPath)) {
        return false;
    }

    const props = parseLibraryProperties(propsPath);
    // Must have at least name field
    return props && props.name;
};

/**
 * Get library info from directory
 * @param {string} libDir - Library directory path
 * @returns {object|null} Library info or null
 */
const getLibraryInfo = libDir => {
    const propsPath = path.join(libDir, 'library.properties');
    const props = parseLibraryProperties(propsPath);

    if (!props || !props.name) {
        return null;
    }

    return {
        name: props.name,
        version: props.version || '0.0.0',
        author: props.author || '',
        maintainer: props.maintainer || '',
        sentence: props.sentence || '',
        paragraph: props.paragraph || '',
        category: props.category || 'Uncategorized',
        url: props.url || '',
        architectures: props.architectures ? props.architectures.split(',').map(a => a.trim()) : ['*'],
        depends: props.depends ? props.depends.split(',').map(d => d.trim()) : []
    };
};

module.exports = {
    parseLibraryProperties,
    isArduinoLibrary,
    getLibraryInfo
};
