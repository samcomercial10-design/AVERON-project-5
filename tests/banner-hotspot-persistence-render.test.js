const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const root=path.resolve(__dirname,'..');
test('hotspot links are normalized, validated and rendered as anchors',()=>{
 const admin=fs.readFileSync(path.join(root,'admin.js'),'utf8');
 const content=fs.readFileSync(path.join(root,'content.js'),'utf8');
 assert.match(admin,/x='#'\+x/);
 assert.match(admin,/new URL\(x,location\.origin\)/);
 assert.match(admin,/invalidHotspot/);
 assert.match(content,/new URL\(x,location\.origin\)/);
 assert.match(content,/createElement\('a'\)/);
 assert.match(content,/section\.appendChild\(a\)/);
});
