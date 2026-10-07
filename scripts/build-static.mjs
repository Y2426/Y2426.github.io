import {mkdir,readFile,writeFile,readdir} from 'node:fs/promises';
import {build} from 'esbuild';
const url=process.env.SUPABASE_URL,key=process.env.SUPABASE_PUBLISHABLE_KEY;
if(!/^https:\/\/[a-z0-9-]+\.supabase\.co$/.test(url||''))throw Error('SUPABASE_URL must be your HTTPS project URL');
if(!key||key.startsWith('sb_secret_'))throw Error('Supply only a Supabase publishable/anon key');
if(!key.startsWith('sb_publishable_')){
 let payload;try{payload=JSON.parse(Buffer.from(key.split('.')[1],'base64url'));}catch{}
 if(payload?.role!=='anon')throw Error('Only an anon or publishable key can be shipped to browsers');
}
await mkdir('dist',{recursive:true});
// Validate the entire browser module graph before producing deployment output.
await build({entryPoints:['public/app.js','public/admin.js','public/email-account.js','public/billing.js','public/policies.js'],bundle:true,format:'esm',platform:'browser',outdir:'dist',write:false,external:['./supabase-sdk.js']});
for(const name of await readdir('public')) await writeFile('dist/'+name,await readFile('public/'+name));
await build({stdin:{contents:"export {createClient} from '@supabase/supabase-js';",resolveDir:process.cwd()},bundle:true,format:'esm',platform:'browser',outfile:'dist/supabase-sdk.js',minify:true});
await writeFile('dist/cloud-config.js','export const cloudConfig = '+JSON.stringify({url,key})+';\n');
// Root custom domain expected; duplicate routes support static directory hosting.
for(const name of ['admin','account']){
 await mkdir('dist/'+name,{recursive:true});
 await writeFile('dist/'+name+'/index.html',await readFile('public/'+name+'.html','utf8'));
}
await writeFile('dist/.nojekyll','');
if(process.env.SITE_DOMAIN){if(!/^[a-z0-9.-]+$/.test(process.env.SITE_DOMAIN))throw Error('Invalid domain');await writeFile('dist/CNAME',process.env.SITE_DOMAIN);}
console.log('Static build ready: dist (no database, media, passwords or private keys included)');
