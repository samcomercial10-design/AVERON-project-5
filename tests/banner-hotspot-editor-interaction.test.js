const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const root=path.resolve(__dirname,'..');

test('hotspot editor updates in place so typing, dragging and resizing keep focus/pointer capture',()=>{
  const admin=fs.readFileSync(path.join(root,'admin.js'),'utf8');

  const updateStart=admin.indexOf('function updateSelectedHotspot');
  const dragStart=admin.indexOf('function enableGuideDrag');
  assert.ok(updateStart>=0 && dragStart>updateStart);

  const updateBlock=admin.slice(updateStart,dragStart);
  assert.doesNotMatch(updateBlock,/renderHotspotsAdmin\(\)/);
  assert.match(updateBlock,/syncHotspotGeometry/);
  assert.match(admin,/setPointerCapture/);
  assert.match(admin,/updateFields:true/);
  assert.match(admin,/populateSelectedHotspotFields/);
});
