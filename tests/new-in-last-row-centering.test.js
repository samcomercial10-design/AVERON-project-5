const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const root=path.resolve(__dirname,'..');

test('New In centers incomplete rows without changing every product grid',()=>{
  const css=fs.readFileSync(path.join(root,'styles.css'),'utf8');
  const index=fs.readFileSync(path.join(root,'index.html'),'utf8');

  assert.match(index,/id="product-grid"/);
  assert.match(css,/#product-grid\s*\{[^}]*display:flex;[^}]*flex-wrap:wrap;[^}]*justify-content:center;/s);
  assert.match(css,/#product-grid\s*>\s*\.card\s*\{[^}]*calc\(\(100% - 84px\) \/ 4\)/s);
  assert.match(css,/@media \(max-width:1024px\) and \(min-width:901px\)[\s\S]*calc\(\(100% - 56px\) \/ 3\)/);
  assert.match(css,/@media \(max-width:900px\)[\s\S]*calc\(\(100% - 12px\) \/ 2\)/);
});
