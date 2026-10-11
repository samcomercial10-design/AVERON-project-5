'use strict';
require('dotenv').config();
const fs=require('node:fs'),path=require('node:path');
const errors=[],warnings=[];
const need=(name,test,msg)=>{const v=String(process.env[name]||'').trim();if(!test(v))errors.push(`${name}: ${msg}`);};
const site=String(process.env.SITE_URL||'').trim().replace(/\/$/,'');
need('NODE_ENV',v=>v==='production','must be exactly production');
need('SITE_URL',v=>/^https:\/\/[^/\s]+$/i.test(v),'must be the canonical HTTPS origin, e.g. https://www.example.com');
need('STRIPE_SECRET_KEY',v=>/^sk_live_/.test(v),'use the Stripe LIVE secret key before accepting real payments');
need('STRIPE_WEBHOOK_SECRET',v=>/^whsec_/.test(v),'configure the production Stripe webhook signing secret');
need('SUPABASE_URL',v=>/^https:\/\/[^/\s]+\.supabase\.co$/i.test(v),'configure the real Supabase project URL');
need('SUPABASE_ANON_KEY',v=>v.length>=20&&!/REPLACE_ME|YOUR_PROJECT_REF/i.test(v),'configure the real Supabase publishable/anon key');
need('ADMIN_EMAIL',v=>/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v),'configure the private Content Studio admin email');
need('ADMIN_PASSWORD_HASH',v=>/^scrypt\$[A-Za-z0-9_-]+\$[A-Za-z0-9_-]+$/.test(v),'generate with npm run admin:hash');
need('AVERON_DATA_DIR',v=>Boolean(v)&&path.isAbsolute(path.resolve(v)),'point to a private persistent directory/volume');
for(const name of ['AVERON_LEGAL_NAME','AVERON_BUSINESS_ADDRESS','AVERON_PRIVACY_EMAIL','AVERON_CUSTOMER_SERVICE_EMAIL','AVERON_RETURNS_EMAIL'])need(name,v=>Boolean(v),'complete the legal/business details before launch');
if(String(process.env.CJ_LIVE_AUTOMATION||'false').toLowerCase()!=='true')warnings.push('CJ_LIVE_AUTOMATION is off: paid live Stripe orders will not be sent automatically to CJ.');
if(String(process.env.CJ_AUTO_PAY_BALANCE||'false').toLowerCase()==='true')warnings.push('CJ_AUTO_PAY_BALANCE is ON: verify CJ balance and live order settings carefully.');
if(site&&site.includes('localhost'))errors.push('SITE_URL cannot use localhost in production.');
const dataDir=String(process.env.AVERON_DATA_DIR||'').trim();
if(dataDir){
 try{fs.mkdirSync(dataDir,{recursive:true});fs.accessSync(dataDir,fs.constants.R_OK|fs.constants.W_OK);}catch(_){errors.push('AVERON_DATA_DIR must exist or be creatable and writable by the Node process.');}
}
if(errors.length){
 console.error('\nAVERON production preflight: FAILED\n');
 errors.forEach(x=>console.error('  ERROR  '+x));
 warnings.forEach(x=>console.warn('  WARN   '+x));
 process.exit(1);
}
console.log('\nAVERON production preflight: OK');
warnings.forEach(x=>console.warn('  WARN   '+x));
console.log('  SITE   '+site);
console.log('  DATA   '+path.resolve(dataDir));
