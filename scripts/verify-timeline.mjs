import assert from 'node:assert/strict';
export async function verifyTimeline(page,baseline) {
 const project=()=>page.evaluate(()=>window.__director.getProject());
 await page.evaluate(p=>window.__director.replaceProject(p),baseline);baseline=await project();
 const restore=async()=>{await page.evaluate(p=>window.__director.replaceProject(p),baseline);await page.locator('#timeline-mode').selectOption('edit');await page.locator('#timeline-zoom').selectOption('1');await page.evaluate(()=>{document.querySelector('#timeline-content').scrollLeft=0;});};
 const ruler=()=>page.locator('.ruler').boundingBox();
 for(const zoom of ['0.25','1','4','16']) {
  await restore();await page.locator('#timeline-zoom').selectOption(zoom);
  await page.evaluate(()=>window.__director.setTime(12));await page.locator('#timeline-center').click();
  const r=await ruler(),v=await page.locator('#timeline-content').boundingBox(),x=v.x+v.width*.5;
  await page.mouse.move(x,r.y+8);await page.mouse.down();
  const t0=await page.evaluate(()=>window.__director.getEngine().time);
  await page.mouse.move(x+180,r.y+8,{steps:6});await page.mouse.up();
  const t1=await page.evaluate(()=>window.__director.getEngine().time);
  assert.ok(Math.abs((t1-t0)*60*Number(zoom)-180)<=60*Number(zoom)/24+.1,`1:1 playhead movement at zoom ${zoom}`);
  assert.deepEqual(await project(),baseline);
 }
 await restore();
 let r=await ruler();const v=await page.locator('#timeline-content').boundingBox();
 await page.mouse.move(r.x+4*60,r.y+8);await page.mouse.down();await page.mouse.move(v.x+v.width-5,r.y+8);
 await page.waitForFunction(()=>document.querySelector('#timeline-content').scrollLeft>200);
 const a=await page.evaluate(()=>window.__director.getEngine().time);await page.waitForTimeout(400);const b=await page.evaluate(()=>window.__director.getEngine().time);
 assert.ok(b>a+1,'stationary pointer at edge keeps scrolling');await page.mouse.up();assert.deepEqual(await project(),baseline);
 await restore();r=await ruler();await page.mouse.click(r.x+19*60,r.y+8);assert.equal(await page.evaluate(()=>window.__director.getEngine().time),19);assert.equal((await project()).duration,15);
 // Isolated action: moving should match the mouse and extend the project.
 const p=structuredClone(baseline),actor=p.entities[0];actor.clips=[{id:actor.clips[0].id,start:2,end:4,action:'walk',speed:1}];
 await page.evaluate(p=>window.__director.replaceProject(p),p);await page.evaluate(()=>document.querySelector('#timeline-content').scrollLeft=0);
 let bar=page.locator(`[data-clip-id="${actor.clips[0].id}"]`),box=await bar.boundingBox();
 await page.mouse.move(box.x+20,box.y+10);await page.mouse.down();await page.mouse.move(box.x+320,box.y+10,{steps:5});await page.mouse.up();
 assert.equal((await project()).entities[0].clips[0].start,7);
 await page.locator('[data-act="undo"]').click();assert.deepEqual(await project(),p);
 await bar.click();assert.equal(await page.locator('[data-inspector-section="clips"]').getAttribute('aria-pressed'),'true');assert.equal(await page.locator('#basic-clip-choice').inputValue(),actor.clips[0].id);await page.evaluate(()=>window.__director.setTime(3));await page.locator('#timeline-content').focus();await page.keyboard.press('Control+b');
 assert.equal((await project()).entities[0].clips.length,2);assert.equal(await page.locator('.clip-selected').count(),1);
 await page.keyboard.press('Delete');assert.equal((await project()).entities[0].clips.length,1);assert.equal((await project()).entities.length,p.entities.length);
 await restore();
 const path=page.locator(`[data-path-id="${baseline.entities[1].id}"]`);await path.scrollIntoViewIfNeeded();await path.click();await page.evaluate(()=>window.__director.setTime(3));await page.locator('#timeline-content').focus();await page.keyboard.press('Control+b');
 assert.equal((await project()).entities[1].path.sections.length,2);
 await page.locator('#timeline-trim').click();await page.locator('#clip-start').fill('20');await page.locator('#clip-end').fill('23');await page.locator('#apply-clip-time').click();
 assert.equal((await project()).entities[1].path.sections[1].start,20);assert.equal((await project()).duration,23);
 const edited=await project(),savedDocument=await page.evaluate(()=>window.__director.getDocument());const download=page.waitForEvent('download');await page.locator('[data-act="save"]').click();const file=await download;const stream=await file.createReadStream();let json='';for await(const chunk of stream)json+=chunk;assert.deepEqual(JSON.parse(json),savedDocument);
 await page.locator('[data-act="undo"]').click();assert.equal((await project()).entities[1].path.sections[1].start,3);
 await page.locator('[data-act="redo"]').click();assert.deepEqual(await project(),edited);
 // Cancel a drag after edge scrolling: no partial project mutation survives.
 await page.evaluate(()=>{document.querySelector('#timeline-content').scrollLeft=0;});
 const first=page.locator(`[data-path-id="${baseline.entities[1].id}"][data-section="0"]`);await first.scrollIntoViewIfNeeded();box=await first.boundingBox();
 await page.mouse.move(box.x+8,box.y+6);await page.mouse.down();await page.mouse.move(1670,box.y+6);await page.waitForTimeout(200);await page.keyboard.press('Escape');await page.mouse.up();assert.deepEqual(await project(),edited);

 await restore();await page.locator('[data-cut="2"]').dblclick();await page.locator('#clip-duration').fill('8');await page.locator('#apply-clip-time').click();
 assert.equal((await project()).duration,18);assert.deepEqual((await project()).entities,baseline.entities);
 await page.locator('[data-cut="2"] .resize-handle').scrollIntoViewIfNeeded();box=await page.locator('[data-cut="2"] .resize-handle').boundingBox();
 await page.mouse.move(box.x+3,box.y+8);await page.mouse.down();await page.mouse.move(box.x+123,box.y+8);await page.mouse.up();assert.equal((await project()).duration,20);
 await page.screenshot({path:'tmp/smoke/10-timeline-editing.png'});
 console.log('Verified 1:1 drag at four zooms, stationary edge scrolling, browsing 19s, clip movement/undo, Ctrl+B, deletion, split path retiming, direct shot duration and edge resize.');
 await restore();
}
