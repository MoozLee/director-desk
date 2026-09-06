import fs from 'node:fs/promises';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { chromium } from 'playwright-core';
import { build } from 'esbuild';
import './build-offline-skill.mjs';

const check = spawnSync(process.execPath, ['scripts/check-release-privacy.mjs'], { stdio: 'inherit' });
if (check.status !== 0) process.exit(check.status || 1);
const metadata = JSON.parse(await fs.readFile('package.json', 'utf8'));
const manifest = JSON.parse(await fs.readFile('.audit/release-web-manifest.json', 'utf8'));
const desktopRoot = path.resolve('.audit/desktop-app');
// Always start from a clean, verified staging directory; never package the workspace root.
if (path.dirname(desktopRoot) !== path.resolve('.audit') || path.basename(desktopRoot) !== 'desktop-app') throw new Error('Invalid staging directory');
await fs.rm(desktopRoot, { recursive: true, force: true });
await fs.mkdir(path.join(desktopRoot, 'desktop'), { recursive: true });
for (const { file } of manifest.files) {
    const destination = path.join(desktopRoot, 'dist', file); await fs.mkdir(path.dirname(destination), { recursive: true });
    await fs.copyFile(path.join('dist', file), destination);
}
// Rasterize the existing public vector product mark, then wrap its PNG as a Windows icon.
const browser = await chromium.launch({ executablePath: process.env.CHROME_PATH || path.join(process.env.ProgramFiles, 'Google/Chrome/Application/chrome.exe'), headless: true });
try {
    const page = await browser.newPage({ viewport: { width: 256, height: 256 } });
    await page.setContent('<style>html,body{margin:0;width:256px;height:256px;background:transparent}svg{width:256px;height:256px}</style>' + await fs.readFile('public/favicon.svg', 'utf8'));
    const png = await page.screenshot({ omitBackground: true });
    const header = Buffer.alloc(22); header.writeUInt16LE(1, 2); header.writeUInt16LE(1, 4);
    header.writeUInt16LE(1, 10); header.writeUInt16LE(32, 12); header.writeUInt32LE(png.length, 14); header.writeUInt32LE(22, 18);
    await fs.writeFile('desktop/icon.ico', Buffer.concat([header, png]));
} finally { await browser.close(); }
await fs.copyFile('desktop/main.cjs', path.join(desktopRoot, 'desktop/main.cjs'));
await fs.copyFile('desktop/preload.cjs', path.join(desktopRoot, 'desktop/preload.cjs'));
await build({ entryPoints: ['src/automation/contract.ts'], outfile: path.join(desktopRoot, 'desktop/tools-contract.cjs'), bundle: true, platform: 'node', format: 'cjs', sourcemap: false, minify: true });
const bundled = await build({ entryPoints: ['desktop/integration.cjs'], outfile: path.join(desktopRoot, 'desktop/integration.cjs'), bundle: true, platform: 'node', format: 'cjs', external: ['electron', './tools-contract.cjs'], sourcemap: false, minify: true, metafile: true });
for (const file of ['SKILL.md', 'references/project-format.md', 'references/online-workflow.md', 'scripts/project-tool.mjs', 'assets/minimal.director']) {
    const relative = path.join('skills/director-desk', file), destination = path.join(desktopRoot, relative);
    await fs.mkdir(path.dirname(destination), { recursive: true }); await fs.copyFile(relative, destination);
}
await fs.copyFile('desktop/icon.ico', path.join(desktopRoot, 'desktop/icon.ico'));
await fs.writeFile(path.join(desktopRoot, 'package.json'), JSON.stringify({ name: 'director-desk', productName: '导演台', version: metadata.version,
    description: '导演台 · AI 短剧预演', main: 'desktop/main.cjs', author: 'DirectorDesk', private: true }, null, 2));
const packages = new Set(['three', 'mediabunny']);
for (const input of Object.keys(bundled.metafile.inputs)) { const match = input.match(/^node_modules\/(?:@[^/]+\/[^/]+|[^/]+)/); if (match) packages.add(match[0].slice(13)); }
const licenses = await Promise.all([...packages].sort().map(async name => {
    const dir = path.join('node_modules', name), files = await fs.readdir(dir), license = files.find(f => /^licen[sc]e(?:\.[a-z]+)?$/i.test(f));
    if (!license) throw new Error('Missing bundled dependency license: ' + name);
    return `${name}\n${await fs.readFile(path.join(dir, license), 'utf8')}\n`;
}));
licenses.push(await fs.readFile('src/animation/library/NOTICE.txt', 'utf8'));
await fs.writeFile(path.join(desktopRoot, 'THIRD-PARTY-LICENSES.txt'), licenses.join('\n'));
const stagedCheck = spawnSync(process.execPath, ['scripts/check-release-privacy.mjs', '--desktop'], { stdio: 'inherit' });
if (stagedCheck.status !== 0) process.exit(stagedCheck.status || 1);
console.log('Prepared isolated desktop payload with minimal product metadata and no development dependencies.');
