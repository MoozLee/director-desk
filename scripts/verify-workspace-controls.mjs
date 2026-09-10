import {createServer} from 'vite';
import {chromium} from 'playwright-core';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
await fs.mkdir('tmp/workspace-controls',{recursive:true});
const server=await createServer({server:{host:'127.0.0.1',port:0}});await server.listen();
const browser=await chromium.launch({channel:'chrome',headless:true});
try {
 const page=await browser.newPage({viewport:{width:1600,height:1000}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto(`http://127.0.0.1:${server.httpServer.address().port}`);await page.waitForFunction(()=>window.__director);
 await page.locator('[data-creation-mode="geometry"]').click();assert.equal(await page.evaluate(()=>window.__director.getProject().creationMode),'geometry');
 await page.locator('[data-act="undo"]').click();assert.equal(await page.locator('[data-creation-mode="full"]').getAttribute('aria-pressed'),'true');
 await page.locator('[data-act="project"]').click();assert.equal(await page.locator('.modal-back').count(),0,'top-level dialog has no redundant return');await page.locator('#rename-input').fill('未提交的项目名');
 await page.locator('[data-act="resource-open"]').click();assert.equal(await page.locator('.modal-back').innerText(),'返回');assert.match(await page.locator('.modal-back').getAttribute('title'),/项目/);
 assert.equal(await page.locator('.modal-back').evaluate(el=>el.parentElement.className),'modal-footer');assert.equal(await page.locator('.modal-back').evaluate(el=>el.nextElementSibling),null,'back is last footer control');
 await page.locator('[data-act="model-library"]').click();assert.match(await page.locator('.modal-back').getAttribute('title'),/工程模型资源/);
 await page.locator('.modal-back').click();assert.equal(await page.locator('#resource-choice').count(),1);
 await page.locator('.modal-back').click();assert.equal(await page.locator('#rename-input').inputValue(),'未提交的项目名');
 await page.locator('.modal-header [data-act="close-modal"]').click();
 await page.locator('#settings-toggle').click();await page.locator('[data-setting="help"]').click();await page.locator('.modal-back').click();assert.equal(await page.locator('.settings-grid').count(),1);
 await page.locator('[data-setting="ai"]').click();assert.equal(await page.locator('#ai-page-back').count(),0,'peer tabs do not need back');await page.locator('#ai-chat-toggle').click();assert.equal(await page.locator('#ai-chat').isVisible(),true);
 assert.equal(await page.locator('#ai-panel [data-parent-page-back]').evaluate(el=>el.parentElement.className),'ai-footer');await page.locator('#ai-panel [data-parent-page-back]').click();assert.equal(await page.locator('.settings-grid').count(),1);await page.locator('.modal-header [data-act="close-modal"]').click();
 await page.locator('#settings-toggle').click();await page.locator('[data-setting="ai"]').click();assert.equal(await page.locator('#ai-panel').isVisible(),true);assert.equal(await page.locator('#ai-settings').isVisible(),true);await page.locator('#ai-close').click();
 const before=await page.evaluate(()=>window.__director.getProject()),actor=before.entities.find(e=>e.kind==='actor');
 await page.locator(`[data-select="${actor.id}"]`).first().click();await page.locator('[data-inspect="base"]').click();
 const input=page.locator('[data-field="pos.0"]');await input.fill('2');
 assert.equal(await page.evaluate(id=>window.__director.getEngine().models.get(id).position.x,actor.id),2,'position changes before blur/change');
 await input.fill('3');assert.equal(await page.evaluate(id=>window.__director.getEngine().models.get(id).position.x,actor.id),3);
 await input.press('Tab');await page.locator('[data-act="undo"]').click();assert.deepEqual(await page.evaluate(()=>window.__director.getProject()),before,'continuous input is one undo');
 const rotation=page.locator('[data-field="rot.1"]');await rotation.fill('45');
 assert.equal(await page.evaluate(id=>window.__director.getProject().entities.find(e=>e.id===id).rotation[1],actor.id),Math.PI/4);
 await rotation.press('Escape');assert.deepEqual(await page.evaluate(()=>window.__director.getProject()),before);
 const spin=await input.boundingBox();await page.mouse.move(spin.x+spin.width-15,spin.y+11);await page.mouse.down();
 await page.waitForTimeout(500);const during=await page.evaluate(id=>window.__director.getEngine().models.get(id).position.x,actor.id);
 assert.ok(during>actor.position[0],'holding native spinner previews before release');
 await page.waitForTimeout(500);assert.ok(await page.evaluate(id=>window.__director.getEngine().models.get(id).position.x,actor.id)>during,'native spinner continues repeating');
 await page.mouse.up();await page.locator('[data-act="undo"]').click();assert.deepEqual(await page.evaluate(()=>window.__director.getProject()),before);
 for(const [width,height] of [[1600,1000],[1000,720]]) {
  await page.setViewportSize({width,height});await page.waitForTimeout(100);
  const layout=await page.evaluate(()=>{const b=s=>document.querySelector(s).getBoundingClientRect();const z=b('.timeline-zoom-controls'),t=b('.timeline'),c=b('.project-title .chevron'),p=b('.project-title');return {zoomRight:z.right,zoomBottom:z.bottom,timelineRight:t.right,timelineBottom:t.bottom,chevronCenter:c.y+c.height/2,buttonCenter:p.y+p.height/2};});
  assert.ok(layout.timelineRight-layout.zoomRight<20);assert.ok(layout.timelineBottom-layout.zoomBottom<10);assert.ok(Math.abs(layout.chevronCenter-layout.buttonCenter)<1);
  await page.locator('#settings-toggle').click();const overflow=await page.locator('.modal').evaluate(el=>el.scrollHeight>el.clientHeight+1);assert.equal(overflow,false);await page.locator('[data-act="close-modal"]').last().click();
 }
 await page.evaluate(async()=>{
  const state={currentVersion:'0.4.1',mode:'installed',phase:'current',version:'',notes:'',percent:0,message:'已是最新版',checkedAt:'',source:'github',canDownload:true,config:{url:'https://example.com/',automatic:true,source:'auto'}};
  window.directorDesktop={update:async()=>({ok:true,data:state}),onUpdate:fn=>{window.__notifyUpdate=fn;return()=>{};}};
  const {mountUpdates}=await import('/src/ui/update-panel.ts');mountUpdates(async run=>run());window.__updateState=state;
 });
 assert.equal(await page.locator('#update-panel').isVisible(),false);
 await page.evaluate(()=>window.__notifyUpdate({...window.__updateState,phase:'available',version:'0.5.0',message:'可更新'}));assert.equal(await page.locator('#update-panel').isVisible(),true);assert.equal(await page.locator('#update-toggle').evaluate(e=>e.classList.contains('has-update')),true);
 await page.locator('#update-close').click();await page.evaluate(()=>window.__notifyUpdate({...window.__updateState,phase:'available',version:'0.5.0'}));assert.equal(await page.locator('#update-panel').isVisible(),false,'same version does not repeatedly interrupt');
 await page.screenshot({path:'tmp/workspace-controls/workspace.png'});assert.deepEqual(errors,[]);console.log('Workspace controls, live preview and single undo, responsive alignment, settings routes, quiet/current and new-version popup passed.');
}finally{await browser.close();await server.close();}
