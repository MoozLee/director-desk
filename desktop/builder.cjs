const path = require('node:path');
module.exports = {
    appId: 'app.directordesk.desktop', productName: '导演台', copyright: 'Copyright © 2026 DirectorDesk',
    directories: { app: '.audit/desktop-app', output: 'release', buildResources: 'desktop' },
    files: ['package.json', 'desktop/main.cjs', 'desktop/preload.cjs', 'desktop/integration.cjs', 'desktop/tools-contract.cjs', 'desktop/icon.ico', 'skills/director-desk/SKILL.md', 'skills/director-desk/references/project-format.md', 'skills/director-desk/references/online-workflow.md', 'skills/director-desk/scripts/project-tool.mjs', 'skills/director-desk/assets/minimal.director', 'dist/index.html', 'dist/favicon.svg', 'dist/assets/*.js', 'dist/assets/*.css', 'THIRD-PARTY-LICENSES.txt', '!node_modules{,/**/*}'],
    onNodeModuleFile: () => false,
    asar: true, npmRebuild: false, publish: null,
    electronVersion: require('electron/package.json').version,
    electronDist: 'node_modules/electron/dist',
    win: { target: [{ target: 'nsis', arch: ['x64'] }], executableName: 'DirectorDesk', icon: path.join(__dirname, 'icon.ico'), signExecutable: false },
    nsis: { oneClick: false, perMachine: false, allowToChangeInstallationDirectory: true,
        createDesktopShortcut: true, createStartMenuShortcut: true, shortcutName: '导演台',
        runAfterFinish: false, deleteAppDataOnUninstall: false, differentialPackage: false,
        artifactName: 'DirectorDesk-Setup-${version}.${ext}', installerLanguages: ['zh_CN', 'en_US'] },
};
