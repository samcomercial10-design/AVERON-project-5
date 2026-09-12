'use strict';

const target = process.argv[2] || process.env.DEPLOY_HEALTH_URL;
if (!target || !/^https?:\/\//i.test(target)) {
  console.error(JSON.stringify({level:'error',event:'deploy_health_check_config_error',message:'Pass a health URL, e.g. npm run deploy:verify -- https://example.com/readyz'}));
  process.exit(2);
}

(async () => {
  const started = Date.now();
  try {
    const res = await fetch(target, { signal: AbortSignal.timeout(10000), headers: { 'user-agent': 'averon-deploy-check/1.0' } });
    const body = await res.text();
    const ok = res.ok;
    console.log(JSON.stringify({level:ok?'info':'error',event:'deploy_health_check',url:target,status_code:res.status,duration_ms:Date.now()-started,response:body.slice(0,1000)}));
    process.exit(ok ? 0 : 1);
  } catch (err) {
    console.error(JSON.stringify({level:'error',event:'deploy_health_check_failed',url:target,duration_ms:Date.now()-started,error:{name:err.name,message:err.message,stack:err.stack}}));
    process.exit(1);
  }
})();
