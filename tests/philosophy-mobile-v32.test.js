
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');

test('mobile philosophy uses the four approved exact lines',()=>{
  const html=fs.readFileSync(path.join(__dirname,'..','index.html'),'utf8');
  const css=fs.readFileSync(path.join(__dirname,'..','styles.css'),'utf8');

  assert.match(
    html,
    /<span>AVERON is built around<\/span><br\/><span>a simple idea: great style<\/span><br\/><span>does not need to demand<\/span><br\/><span>attention\.<\/span>/
  );
  assert.match(css,/philosophy exact mobile line breaks v35/);
  assert.match(css,/\.philosophy \.philosophy-statement span\{[\s\S]*?display:block !important;[\s\S]*?white-space:nowrap !important;/);
});
