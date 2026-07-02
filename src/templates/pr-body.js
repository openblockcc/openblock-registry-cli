/**
 * @fileoverview
 * PR body templates for openblock-registry submissions.
 *
 * The PR body is generated on the developer's machine and is untrusted (§5.1).
 * Every fact a reviewer needs already comes from trusted sources: the registry
 * bot's authoritative display report (rendered from the published git tag) and
 * the PR's own registry.json / approved/{id}.json diff. So the body carries no
 * details of its own — restating them would only compete for the reviewer's
 * attention with the trustworthy report. It is left empty on purpose.
 */

/**
 * Generate PR body for publishing a new plugin or version. Intentionally empty:
 * all review information lives in the registry bot's report and the PR diff, so
 * the body adds nothing.
 * @returns {string} Empty PR body
 */
const generatePublishPRBody = () => '';

/**
 * Generate PR title
 * @param {string} action - 'publish'
 * @param {string} pluginId - Plugin ID
 * @param {string} version - Version
 * @returns {string} PR title
 */
const generatePRTitle = (action, pluginId, version) => {
    if (action === 'publish') {
        return `[Publish] ${pluginId}@${version}`;
    }
    return `[Update] ${pluginId}`;
};

module.exports = {
    generatePublishPRBody,
    generatePRTitle
};
