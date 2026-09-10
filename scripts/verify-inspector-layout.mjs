import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
import {createServer} from 'vite';
import {chromium} from 'playwright-core';
await fs.mkdir('tmp/inspector-layout',{recursive:true});
const server=await createServer({server:{host:'127.0.0.1',port:0,watch:{ignored:['**/tmp/**','**/.local/**']}}});await server.listen();
const browser=await chromium.launch({channel:'chrome',headless:true});
try {
 const page=await browser.newPage({viewport:{width:1440,height:900}}),issues=[],errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto(`http://127.0.0.1:${server.httpServer.address().port}`);await page.waitForFunction(()=>window.__director);
 const ids=await page.evaluate(async()=>{const {demoProject,entity}=await import('/src/model.ts');const p=demoProject();p.entities.push(entity('prop','stairs','楼梯'),entity('crowd','crowd','群演'),entity('prop','light-spot','聚光灯'));window.__director.replaceProject(p);return [p.entities[0],p.entities[1],p.entities[4],p.entities.find(e=>e.asset==='chair'),...p.entities.slice(-3)].map(e=>e.id);});
 let checked=0;
 for(const [width,height,panelWidth] of [[1440,900,400],[1280,720,320]]) {
  await page.setViewportSize({width,height});await page.evaluate(w=>document.documentElement.style.setProperty('--inspector-width',w+'px'),panelWidth);
  for(const id of [...ids,'environment']) {
   if(id==='environment')await page.evaluate(()=>document.querySelector('[data-act="lighting-open"]').click());
   else {
    const name=await page.evaluate(id=>window.__director.getProject().entities.find(e=>e.id===id).name,id);await page.locator('#search').fill(name);
    await page.locator(`[data-select="${id}"]`).first().click();
   }
   const tabs=id==='environment'?['environment']:await page.locator('[data-inspect]').evaluateAll(es=>es.map(e=>e.dataset.inspect));
   for(const tab of tabs) {
    if(tab!=='environment')await page.locator(`[data-inspect="${tab}"]`).click();
    const attribute=await page.evaluate(()=>document.querySelector('[data-inspector-section]')?'data-inspector-section':document.querySelector('[data-cinema-tab]')?'data-cinema-tab':'data-light-tab');
    const sections=await page.locator(`[${attribute}]`).evaluateAll((es,attr)=>es.map(e=>e.getAttribute(attr)),attribute);
    for(const section of sections.length?sections:['']) {
     if(section)await page.locator(`[${attribute}="${section}"]`).click();
     const result=await page.locator('#inspector-content').evaluate(root=>{
      const bounds=root.getBoundingClientRect(),controls=[...root.querySelectorAll('button,input,select,textarea')].filter(e=>e.checkVisibility()&&!e.closest('nav'));
      const problems=[],label=e=>e.getAttribute('aria-label')||e.id||e.dataset.act||e.textContent?.trim().slice(0,30)||e.dataset.field||e.tagName;
      for(let i=0;i<controls.length;i++) {
       const a=controls[i],r=a.getBoundingClientRect();
       if(r.left<bounds.left-1||r.right>bounds.right+1)problems.push(`横向溢出 ${label(a)}`);
       for(const b of controls.slice(i+1)){if(a.contains(b)||b.contains(a))continue;const s=b.getBoundingClientRect(),x=Math.min(r.right,s.right)-Math.max(r.left,s.left),y=Math.min(r.bottom,s.bottom)-Math.max(r.top,s.top);if(x>1&&y>1)problems.push(`重叠 ${label(a)} / ${label(b)}`);else if(x>4&&y>-4&&y<=1)problems.push(`垂直贴合 ${label(a)} / ${label(b)}`);}
      }
      if(root.scrollHeight>root.clientHeight+2)problems.push(`高度溢出 ${root.scrollHeight-root.clientHeight}px`);
      return problems;
     });
     checked++;if(result.length)issues.push({width,height,id,tab,section,problems:result});
     if(tab==='camera'&&section==='motion')await page.screenshot({path:`tmp/inspector-layout/camera-motion-${width}.png`});
    }
   }
  }
 }
 await fs.writeFile('tmp/inspector-layout/report.json',JSON.stringify({checked,issues,errors},null,2));
 console.log(JSON.stringify({checked,issues,errors},null,2));assert.deepEqual(errors,[]);assert.equal(issues.length,0,'Inspector layout issues; see report');
} finally {await browser.close();await server.close();}
