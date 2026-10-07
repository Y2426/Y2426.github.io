import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {PGlite} from '@electric-sql/pglite';

test('Supabase: permissions, private media, redemption, expiry, rate limits and course lifecycle',async()=>{
 const db=new PGlite();
 await db.exec(`create role anon; create role authenticated;
 create schema auth; create table auth.users(id uuid primary key,email text,raw_user_meta_data jsonb);
 create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
 grant usage on schema auth,public to anon,authenticated;
 create schema storage; create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);
 create table storage.objects(id uuid default gen_random_uuid(),bucket_id text,name text);
 alter table storage.objects enable row level security;
 grant usage on schema storage to anon,authenticated; grant select,insert on storage.objects to anon,authenticated;`);
 await db.exec(await readFile(new URL('../supabase/migrations/202610070001_echo.sql',import.meta.url),'utf8'));
 const admin='00000000-0000-0000-0000-000000000001',user='00000000-0000-0000-0000-000000000002',other='00000000-0000-0000-0000-000000000003';
 await db.query(`insert into auth.users values($1,'admin@accounts.myecho.fun','{"username":"owner","admin":true}'),($2,'learner@accounts.myecho.fun','{}'),($3,'other@accounts.myecho.fun','{}')`,[admin,user,other]);
 assert.equal((await db.query('select admin from echo_private.profiles where id=$1',[admin])).rows[0].admin,false,'metadata cannot grant admin');
 await db.query('update echo_private.profiles set admin=true where id=$1',[admin]);
 async function as(uid){await db.exec('reset role');await db.query("select set_config('request.jwt.claim.sub',$1,false)",[uid||'']);await db.exec('set role '+(uid?'authenticated':'anon'));}
 async function api(route,method='GET',body={}){return (await db.query('select public.echo_api($1,$2,$3) as result',[route,method,body])).rows[0].result;}
 const course={id:'test-course',title:'Test',kind:'video',media:'/media/test.mp4',duration:2,premium:true,cues:[{start:0,end:2,text:'Hello',translation:'你好'}]};
 await as(null);assert.equal((await api('me')).user,null);await assert.rejects(api('admin/codes'));await assert.rejects(db.query('select * from echo_private.codes'));
 await as(user);await assert.rejects(api('admin/courses','POST',{course}));await assert.rejects(api('admin/codes','POST',{count:1}));
 await as(admin);let c=await api('admin/courses','POST',{course});c=await api('admin/courses/test-course/publish','POST',{revision:c.revision});
 await db.query("insert into storage.objects(bucket_id,name) values('echo-media','test.mp4')");
 await as(null);assert.equal((await api('courses'))[0].locked,true);assert.equal((await api('courses'))[0].media,undefined);await assert.rejects(api('course/test-course'));assert.equal((await db.query('select * from storage.objects')).rows.length,0);
 await as(user);assert.match((await api('redeem','POST',{code:'invalid'})).error,/无效/);
 await api('state','PUT',{completed:{one:true},favorites:{},vocab:{},seconds:5});
 await as(other);assert.deepEqual((await api('state')).completed,{});await assert.rejects(db.query("insert into storage.objects(bucket_id,name) values('echo-media','bad.mp4')"));
 await as(admin);const code=(await api('admin/codes','POST',{count:2,label:'test'})).codes;
 await as(user);assert.equal((await api('redeem','POST',{code:code[0]})).user.lifetime,true);assert.equal((await api('course/test-course')).title,'Test');assert.equal((await db.query('select * from storage.objects')).rows.length,1);
 assert.match((await api('redeem','POST',{code:code[1]})).error,/已拥有/);
 await as(other);assert.match((await api('redeem','POST',{code:code[0]})).error,/已使用/);
 await as(admin);let codes=await api('admin/codes');assert.equal(codes.some(x=>'hash'in x),false);let unused=codes.find(x=>!x.used_by);await api('admin/codes/'+unused.id+'/revoke','POST');
 await as(other);assert.match((await api('redeem','POST',{code:code[1]})).error,/无效/);
 for(let i=0;i<30;i++)await api('redeem','POST',{code:'bad'});assert.match((await api('redeem','POST',{code:'bad'})).error,/尝试过多/);
 await as(admin);assert.equal((await api('admin/courses/test-course/history')).length,2);
 await assert.rejects(api('admin/courses/test-course','PUT',{course,revision:1}),/版本冲突/);
 c=await api('admin/courses/test-course/archive','POST',{revision:c.revision});
 await as(user);await assert.rejects(api('course/test-course'));assert.equal((await db.query('select * from storage.objects')).rows.length,0);
 await as(admin);c=await api('admin/courses/test-course/restore','POST',{revision:c.revision});assert.equal(c.status,'draft');
 const changed={...course,cues:[{start:0,end:2,text:'Changed'}]};c=await api('admin/courses/test-course','PUT',{course:changed,revision:c.revision});await assert.rejects(api('admin/courses/test-course/publish','POST',{revision:c.revision}),/时间轴/);
 const expiring=(await api('admin/codes','POST',{count:1,expires:new Date(Date.now()+86400000).toISOString()})).codes[0];
 await db.exec('reset role');await db.exec("update echo_private.codes set expires=now()-interval '1 day' where used_by is null;delete from echo_private.attempts;");
 await as(other);assert.match((await api('redeem','POST',{code:expiring})).error,/过期/);assert.equal((await api('payments/config')).ready,false);await assert.rejects(api('orders','POST',{}));
 await db.close();
});
