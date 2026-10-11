'use strict';
const fs=require('node:fs'),path=require('node:path');

function escapeHtml(value){
 return String(value??'').replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
}
function canonicalSiteUrl(){
 const raw=String(process.env.SITE_URL||'').trim().replace(/\/$/,'');
 return /^https:\/\/[^/\s]+$/i.test(raw)?raw:'';
}
function applyLegalConfig(html){
 const values={
  '[LEGAL NAME / COMPANY NAME]':process.env.AVERON_LEGAL_NAME,
  '[BUSINESS ADDRESS]':process.env.AVERON_BUSINESS_ADDRESS,
  '[PRIVACY EMAIL]':process.env.AVERON_PRIVACY_EMAIL,
  '[CUSTOMER SERVICE EMAIL]':process.env.AVERON_CUSTOMER_SERVICE_EMAIL,
  '[RETURNS EMAIL]':process.env.AVERON_RETURNS_EMAIL
 };
 for(const [placeholder,value] of Object.entries(values)){
  const clean=String(value||'').trim();
  if(clean)html=html.split(placeholder).join(escapeHtml(clean));
 }
 return html;
}
function writeSeoFiles(root,dest){
 const siteUrl=canonicalSiteUrl();
 const robots=['User-agent: *','Disallow: /admin.html','Disallow: /admin-login.html','Disallow: /reset-password.html','Disallow: /auth-callback.html'];
 if(siteUrl)robots.push('',`Sitemap: ${siteUrl}/sitemap.xml`);
 fs.writeFileSync(path.join(dest,'robots.txt'),robots.join('\n')+'\n');
 if(!siteUrl)return;
 const tpl=fs.readFileSync(path.join(root,'sitemap.xml.template'),'utf8');
 fs.writeFileSync(path.join(dest,'sitemap.xml'),tpl.replaceAll('{{BASE_URL}}',siteUrl));
}
function buildPublic(){
 const root=path.resolve(__dirname,'..'),dest=path.join(root,'public');
 fs.rmSync(dest,{recursive:true,force:true});fs.mkdirSync(dest,{recursive:true});
 for(const name of require('../public-files.json')){
  if(!/^[a-zA-Z0-9_-]+(?:\.[a-zA-Z0-9_-]+)*\.(html|js|css|txt|xml)$/.test(name))throw new Error('Invalid public manifest entry');
  const from=path.join(root,name),to=path.join(dest,name);
  if(name.endsWith('.html'))fs.writeFileSync(to,applyLegalConfig(fs.readFileSync(from,'utf8')));
  else fs.copyFileSync(from,to);
 }
 const copyAssets=(src,out)=>{fs.mkdirSync(out,{recursive:true});for(const entry of fs.readdirSync(src,{withFileTypes:true})){
  if(entry.isSymbolicLink())continue;
  const from=path.join(src,entry.name),to=path.join(out,entry.name);
  if(entry.isDirectory())copyAssets(from,to);
  else if(/\.(png|jpe?g|webp|gif|svg|ico|woff2?|ttf|otf)$/i.test(entry.name))fs.copyFileSync(from,to);
 }};
 copyAssets(path.join(root,'assets'),path.join(dest,'assets'));
 writeSeoFiles(root,dest);
}
module.exports={buildPublic,applyLegalConfig,canonicalSiteUrl};if(require.main===module)buildPublic();
