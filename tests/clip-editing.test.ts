import assert from 'node:assert/strict';
import test from 'node:test';
import { demoProject, clone, validateProject } from '../src/model.ts';
import { entityPosition, sampledAction, entityYaw } from '../src/timeline.ts';
import { splitClip, setClipRange, deleteClip } from '../src/clip-editing.ts';
test('splitting smooth paths preserves sampled position and supports independent move/delete/file roundtrip',()=>{
 const p=demoProject(), e=p.entities[1], before=clone(e);
 const right=splitClip(p,{kind:'path',entityId:e.id,index:0},3);
 for(let t=0;t<10;t+=.037) assert.ok(entityPosition(e,t).distanceTo(entityPosition(before,t))<1e-10);
 setClipRange(p,right,20,23); assert.equal(p.duration,23);
 assert.ok(entityPosition(e,21).distanceTo(entityPosition(before,4))<1e-10);
 assert.deepEqual(validateProject(JSON.parse(JSON.stringify(p))),p);
 deleteClip(p,{kind:'path',entityId:e.id,index:0}); assert.equal(e.path!.sections!.length,1);
});
test('splitting actions preserves phase, progress and turn accumulation',()=>{
 for(const index of [1,2]) {
  const p=demoProject(),e=p.entities[1],c=e.clips[index],before=clone(e);
  splitClip(p,{kind:'action',entityId:e.id,id:c.id},(c.start+c.end)/2);
  for(let t=0;t<15;t+=.071) {
   const a=sampledAction(e,t),b=sampledAction(before,t);
   assert.equal(a.action,b.action);assert.ok(Math.abs(a.local-b.local)<1e-10);assert.ok(Math.abs(a.progress-b.progress)<1e-10);
   assert.equal(entityYaw(e,t,p),entityYaw(before,t,p));
  }
  validateProject(p);
 }
});
test('shot duration changes boundaries without altering motion and actions',()=>{
 const p=demoProject(), entities=clone(p.entities);
 setClipRange(p,{kind:'cut',index:1},5,8);assert.equal(p.cuts[2].time,8);
 setClipRange(p,{kind:'cut',index:2},8,12);assert.equal(p.duration,12);
 assert.deepEqual(p.entities,entities);validateProject(p);
 assert.throws(()=>setClipRange(p,{kind:'cut',index:0},1,3));
});
