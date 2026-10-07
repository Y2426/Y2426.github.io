import test from 'node:test';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {readFile,readdir} from 'node:fs/promises';
test('static build rejects secret keys and packages browser modules without private data',async()=>{
 const base={...process.env,SUPABASE_URL:'https://echo-build-check.supabase.co'};
 const run=key=>spawnSync(process.execPath,['scripts/build-static.mjs'],{env:{...base,SUPABASE_PUBLISHABLE_KEY:key},encoding:'utf8'});
 for(const key of ['sb_secret_testing', 'eyJhbGciOiJIUzI1NiJ9.'+Buffer.from('{"role":"service_role"}').toString('base64url')+'.test'])assert.notEqual(run(key).status,0);
 const r=run('sb_publishable_build_check_only');assert.equal(r.status,0,r.stderr);
 const files=await readdir('dist');assert.ok(files.includes('supabase-sdk.js'));assert.ok(!files.includes('lessons.json'));assert.ok(!files.includes('echo.sqlite'));assert.ok(!files.includes('content'));
 assert.match(await readFile('dist/cloud-config.js','utf8'),/echo-build-check/);
 assert.match(await readFile('dist/admin/index.html','utf8'),/admin.js/);
});
