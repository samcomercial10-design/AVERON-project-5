'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),os=require('node:os'),path=require('node:path'),{spawnSync}=require('node:child_process');
const {buildPublic}=require('../scripts/build-public');
const root=path.resolve(__dirname,'..');
function envPatch(patch,fn){const old={};for(const [k,v] of Object.entries(patch)){old[k]=process.env[k];if(v==null)delete process.env[k];else process.env[k]=v;}try{return fn();}finally{for(const [k,v] of Object.entries(old)){if(v==null)delete process.env[k];else process.env[k]=v;}}}
test('build generates production robots/sitemap from SITE_URL without hard-coded domain',()=>{
 envPatch({SITE_URL:'https://shop.example.test'},()=>buildPublic());
 const robots=fs.readFileSync(path.join(root,'public','robots.txt'),'utf8');
 const sitemap=fs.readFileSync(path.join(root,'public','sitemap.xml'),'utf8');
 assert.match(robots,/Sitemap: https:\/\/shop\.example\.test\/sitemap\.xml/);
 assert.doesNotMatch(sitemap,/\{\{BASE_URL\}\}/);
 assert.match(sitemap,/https:\/\/shop\.example\.test\/clothing\.html/);
});
test('legal business fields can be injected at build time from environment',()=>{
 envPatch({AVERON_LEGAL_NAME:'AVERON Test Ltd',AVERON_BUSINESS_ADDRESS:'1 Test Street',AVERON_PRIVACY_EMAIL:'privacy@example.test',AVERON_CUSTOMER_SERVICE_EMAIL:'hello@example.test',AVERON_RETURNS_EMAIL:'returns@example.test'},()=>buildPublic());
 const privacy=fs.readFileSync(path.join(root,'public','privacy-policy.html'),'utf8');
 const terms=fs.readFileSync(path.join(root,'public','terms.html'),'utf8');
 const returns=fs.readFileSync(path.join(root,'public','returns-refunds.html'),'utf8');
 assert.match(privacy,/AVERON Test Ltd/);assert.match(privacy,/privacy@example\.test/);
 assert.match(terms,/hello@example\.test/);assert.match(returns,/returns@example\.test/);
 assert.doesNotMatch(privacy,/\[LEGAL NAME \/ COMPANY NAME\]/);
});
test('production preflight fails closed when production configuration is incomplete',()=>{
 const tmp=fs.mkdtempSync(path.join(os.tmpdir(),'averon-preflight-'));
 const r=spawnSync(process.execPath,['scripts/production-preflight.js'],{cwd:root,encoding:'utf8',env:{...process.env,NODE_ENV:'production',SITE_URL:'https://shop.example.test',AVERON_DATA_DIR:tmp,STRIPE_SECRET_KEY:'',STRIPE_WEBHOOK_SECRET:''}});
 fs.rmSync(tmp,{recursive:true,force:true});
 assert.notEqual(r.status,0);assert.match(r.stderr,/FAILED/);
});
