/**
 * Standalone cross-repo contract check for the display-manifest mirror.
 * Run: `node test/display-manifest.test.js` (or `npm test`).
 *
 * The frozen vectors below are identical to those in the registry's
 * scripts/test/display-manifest.test.js. If this test fails, the CLI's
 * normalization has drifted from the registry's and every approved/{id}.json it
 * generates would be rejected by the PR-validation bot.
 */

const assert = require('assert');
const {extractDisplay, hashIconBytes, computeDisplayHash, buildApprovedRecord} = require('../src/lib/display-manifest');

const samplePkg = {
    author: 'OpenBlock',
    openblock: {
        deviceId: 'arduinoUno',
        name: {formatMessage: {id: 'arduinoUno.name', default: 'Arduino Uno'}},
        description: 'A classic board',
        helpLink: 'https://example.com/help',
        learnMore: 'https://example.com/learn',
        manufactor: 'Arduino',
        tags: ['arduino', 'kit'],
        iconURL: './icon.png',
        type: 'arduino'
    }
};

const display = extractDisplay(samplePkg);
assert.ok(!('type' in display), 'non-frozen fields must be excluded');

const iconHash = hashIconBytes(Buffer.from('fake-png-bytes'));
assert.strictEqual(
    iconHash,
    'sha256:3c6ed5fc41c950bf0db531eb22f945467fb8d999f80d82ba27dcc9fd90add54d',
    'icon hash vector drifted from the registry module'
);

const displayHash = computeDisplayHash(display, {iconURL: iconHash});
assert.strictEqual(
    displayHash,
    'sha256:3eaf38fb08846c7923cede63daacba3e873f48b9eafc7089354273495d2de3bc',
    'displayHash vector drifted from the registry module'
);

const record = buildApprovedRecord({
    id: 'arduinoUno',
    type: 'devices',
    repository: 'https://github.com/openblock-plugin/arduinoUno',
    display,
    icons: {iconURL: iconHash}
});
assert.strictEqual(record.displayHash, displayHash);

console.log('display-manifest.test.js (cli): all assertions passed');
