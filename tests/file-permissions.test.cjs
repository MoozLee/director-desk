const test=require('node:test'),assert=require('node:assert/strict');
const {installFilePermissions}=require('../desktop/file-permissions.cjs');
test('file picker writes are permitted only for this app document; unrelated permissions remain denied',()=>{
    let check,request,url='director://app/';
    const contents={getURL:()=>url,isDestroyed:()=>false};
    installFilePermissions({setPermissionCheckHandler:f=>check=f,setPermissionRequestHandler:f=>request=f},contents);
    assert.equal(check(contents,'fileSystem','director://app',{isMainFrame:false}),true);
    let granted;request(contents,'fileSystem',x=>granted=x,{requestingUrl:'director://app/',isMainFrame:false});assert.equal(granted,true);
    for(const permission of ['media','clipboard-read','geolocation','unknown'])assert.equal(check(contents,permission,'director://app'),false);
    for(const origin of ['https://example.com','director://app.evil/','director://app/other','null',''])assert.equal(check(contents,'fileSystem',origin),false);
    assert.equal(check({},'fileSystem','director://app'),false);
    url='https://example.com';assert.equal(check(contents,'fileSystem','director://app'),false);
});
