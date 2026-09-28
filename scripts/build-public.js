'use strict';
const fs=require('node:fs'),path=require('node:path');
function buildPublic(){
 const root=path.resolve(__dirname,'..'),dest=path.join(root,'public');
 fs.rmSync(dest,{recursive:true,force:true});fs.mkdirSync(dest,{recursive:true});
 for(const name of require('../public-files.json')){
  if(!/^[a-zA-Z0-9_-]+(?:\.[a-zA-Z0-9_-]+)*\.(html|js|css|txt|xml)$/.test(name))throw new Error('Invalid public manifest entry');
  fs.copyFileSync(path.join(root,name),path.join(dest,name));
 }
 const copyAssets=(src,out)=>{fs.mkdirSync(out,{recursive:true});for(const entry of fs.readdirSync(src,{withFileTypes:true})){
  if(entry.isSymbolicLink())continue;
  const from=path.join(src,entry.name),to=path.join(out,entry.name);
  if(entry.isDirectory())copyAssets(from,to);
  else if(/\.(png|jpe?g|webp|gif|svg|ico|woff2?|ttf|otf)$/i.test(entry.name))fs.copyFileSync(from,to);
 }};
 copyAssets(path.join(root,'assets'),path.join(dest,'assets'));
}
module.exports={buildPublic};if(require.main===module)buildPublic();
