const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');

test('site imagery has no repeating diagonal texture overlay',()=>{
  const css=fs.readFileSync(path.resolve(__dirname,'..','styles.css'),'utf8');
  assert.doesNotMatch(css,/repeating-linear-gradient/i);
});
