/** File handles still come from Chromium's user-selected file/folder picker.
 * This grants only the app document's File System API, not unrelated permissions
 * or restricted OS paths. Do not gate on isMainFrame: Chromium reports false here. */
function installFilePermissions(session, contents) {
    const trusted = (sender, permission, origin) => sender === contents && !contents.isDestroyed()
        && contents.getURL() === 'director://app/' && permission === 'fileSystem'
        && (origin === 'director://app' || origin === 'director://app/');
    session.setPermissionCheckHandler((sender, permission, origin) => trusted(sender, permission, origin));
    session.setPermissionRequestHandler((sender, permission, callback, details) => callback(trusted(sender, permission, details.requestingUrl)));
}
module.exports = { installFilePermissions };
