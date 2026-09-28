// Isolated test preload: replaces external services ONLY when explicitly loaded by node --require.
'use strict';
const fs=require('node:fs'),path=require('node:path'),Module=require('node:module');
const fixtureDir=process.env.AVERON_TEST_FIXTURES;
if(!fixtureDir)throw new Error('Test fixture directory is required');
const realLoad=Module._load,RealStripe=require('stripe');
const json=(name)=>JSON.parse(fs.readFileSync(path.join(fixtureDir,name),'utf8'));
const record=(kind,data)=>fs.appendFileSync(path.join(fixtureDir,'calls.jsonl'),JSON.stringify({kind,data})+'\n');
const session=id=>json('sessions.json')[id];
class TestStripe{
 constructor(){
  this.webhooks=new RealStripe('sk_test_fixture').webhooks;
  this.checkout={sessions:{
   retrieve:async id=>{record('retrieve',id);if(!session(id))throw new Error('Not found');return session(id);},
   listLineItems:async id=>({data:json('items.json')[id]||[]}),
   create:async (params,options)=>{record('checkout',{params,options});return {id:'cs_test_created',url:'https://checkout.stripe.com/test_fixture'};}
  }};
  this.refunds={create:async (params,options)=>{record('refund',{params,options});return {id:'re_fixture',status:'succeeded'};},retrieve:async id=>json('refunds.json')[id]};
  this.paymentIntents={retrieve:async id=>json('intents.json')[id]};
 }
}
Module._load=function(name,...rest){if(name==='stripe')return TestStripe;return realLoad.call(this,name,...rest);};
global.fetch=async (url,options={})=>{
 url=String(url);
 if(url.startsWith('https://fixture.supabase.co/auth/v1/user')){
  const token=String(options.headers.Authorization||'').replace('Bearer ','');
  const user=['alice','bob'].includes(token)?{id:token,email:token+'@example.test'}:null;
  return new Response(JSON.stringify(user||{}),{status:user?200:401,headers:{'Content-Type':'application/json'}});
 }
 if(url.includes('developers.cjdropshipping.com')){
  if(url.endsWith('/authentication/getAccessToken'))return new Response(JSON.stringify({result:true,data:{accessToken:'fixture_token',accessTokenExpiryDate:'2099-01-01'}}));
  if(url.includes('/shopping/order/createOrder')){
   record('cj-create',JSON.parse(options.body));
   if(fs.existsSync(path.join(fixtureDir,'fail-cj')))throw new Error('Simulated uncertain provider timeout');
   return new Response(JSON.stringify({result:true,data:{orderId:'CJ_FIXTURE_ORDER',orderNumber:JSON.parse(options.body).orderNumber}}));
  }
  return new Response(JSON.stringify({result:true,data:{}}));
 }
 throw new Error('External network forbidden in test: '+url);
};
