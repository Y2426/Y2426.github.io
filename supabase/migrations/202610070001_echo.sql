-- All application tables are inaccessible directly; the RPC checks auth.uid().
create schema if not exists echo_private;
revoke all on schema echo_private from public, anon, authenticated;
create table echo_private.profiles (
 id uuid primary key references auth.users on delete cascade,
 username text not null, admin boolean not null default false,
 lifetime boolean not null default false, created timestamptz not null default now()
);
create table echo_private.states (
 user_id uuid primary key references auth.users on delete cascade,
 body jsonb not null check (octet_length(body::text) <= 300000)
);
create table echo_private.courses (
 id text primary key, draft jsonb not null, published jsonb,
 status text not null default 'draft' check(status in ('draft','published','archived')),
 revision integer not null default 1, updated timestamptz not null default now()
);
create table echo_private.events (
 id bigint generated always as identity primary key, course_id text not null,
 actor text not null, action text not null, revision integer not null, created timestamptz default now()
);
create table echo_private.codes (
 id uuid primary key default gen_random_uuid(), hash text unique not null,
 label text not null default '', created timestamptz default now(), expires timestamptz,
 revoked boolean not null default false, used_by uuid references auth.users,
 used_at timestamptz
);
create table echo_private.attempts (
 user_id uuid primary key references auth.users on delete cascade,
 window_start timestamptz not null default now(), n integer not null default 0
);
alter table echo_private.profiles enable row level security;
alter table echo_private.states enable row level security;
alter table echo_private.courses enable row level security;
alter table echo_private.events enable row level security;
alter table echo_private.codes enable row level security;
alter table echo_private.attempts enable row level security;

create function echo_private.new_user() returns trigger language plpgsql security definer set search_path='' as $$
begin
 insert into echo_private.profiles(id,username) values(new.id,coalesce(nullif(new.raw_user_meta_data->>'username',''),split_part(new.email,'@',1),'learner'));
 return new;
end $$;
create trigger echo_new_user after insert on auth.users for each row execute function echo_private.new_user();
insert into echo_private.profiles(id,username) select id,split_part(email,'@',1) from auth.users on conflict do nothing;

create function echo_private.profile(uid uuid) returns jsonb language sql stable security definer set search_path='' as $$
 select jsonb_build_object('id',p.id,'username',p.username,'admin',p.admin,'lifetime',p.lifetime,'points',0,'email',u.email)
 from echo_private.profiles p join auth.users u on u.id=p.id where p.id=uid;
$$;
create function public.echo_is_admin() returns boolean language sql stable security definer set search_path='' as $$
 select coalesce((select admin from echo_private.profiles where id=auth.uid()),false);
$$;
create function public.echo_media_allowed(object_name text) returns boolean language sql stable security definer set search_path='' as $$
 select public.echo_is_admin() or exists (
 select 1 from echo_private.courses c where c.status='published' and c.published->>'media'='/media/'||object_name
 and (not (c.published->>'premium')::boolean or coalesce((select lifetime from echo_private.profiles where id=auth.uid()),false)));
$$;

create function echo_private.validate_course(c jsonb, publishing boolean default false) returns void language plpgsql set search_path='' as $$
declare cue jsonb; previous_end numeric:=0;
begin
 if c is null or coalesce(c->>'id','') !~ '^[a-z0-9][a-z0-9-]{1,79}$' or length(trim(coalesce(c->>'title','')))=0 or length(c->>'title')>160 then raise exception '课程编号或标题无效'; end if;
 if jsonb_typeof(c->'premium') is distinct from 'boolean' or coalesce(c->>'kind','') not in ('audio','video') or jsonb_typeof(c->'cues') is distinct from 'array' then raise exception '课程格式无效'; end if;
 if octet_length(c::text)>300000 or jsonb_array_length(c->'cues')>3000 then raise exception '课程内容过大'; end if;
 if coalesce(c->>'media','')<>'' and c->>'media' !~ '^/media/[a-zA-Z0-9_-]+\.(mp4|webm|mp3|wav)$' then raise exception '请使用私有存储中的媒体文件'; end if;
 if coalesce(c->>'poster','')<>'' and c->>'poster' !~ '^/[a-zA-Z0-9_-]+\.(jpg|jpeg|png|webp)$' then raise exception '封面路径无效'; end if;
 if jsonb_typeof(c->'duration') is distinct from 'number' or (c->>'duration')::numeric<0 or (c->>'duration')::numeric>86400 then raise exception '媒体时长无效'; end if;
 for cue in select value from jsonb_array_elements(c->'cues') loop
  if jsonb_typeof(cue->'start') is distinct from 'number' or jsonb_typeof(cue->'end') is distinct from 'number' or (cue->>'start')::numeric<previous_end or (cue->>'end')::numeric<=(cue->>'start')::numeric or length(trim(coalesce(cue->>'text','')))=0 then raise exception '字幕时间轴或原文无效'; end if;
  previous_end:=(cue->>'end')::numeric;
 end loop;
 if (c->>'duration')::numeric>0 and previous_end>(c->>'duration')::numeric+0.25 then raise exception '字幕超出媒体时长'; end if;
 if publishing and (coalesce(c->>'media','')='' or jsonb_array_length(c->'cues')=0 or (c->>'duration')::numeric<=0) then raise exception '发布前需要媒体、时长和字幕'; end if;
end $$;

create function public.echo_api(route text, method text default 'GET', body jsonb default '{}'::jsonb) returns jsonb
language plpgsql security definer set search_path='' as $$
declare
 uid uuid:=auth.uid(); p echo_private.profiles; c echo_private.courses;
 cd echo_private.codes; result jsonb; course jsonb; cid text; action text;
 raw_code text; total integer; expiry timestamptz; old_timeline jsonb; new_timeline jsonb;
begin
 select * into p from echo_private.profiles where id=uid;
 if method not in ('GET','POST','PUT') then raise exception '请求方法不支持'; end if;
 if route='me' and method='GET' then return jsonb_build_object('user',echo_private.profile(uid),'paymentReady',false); end if;
 if route='payments/config' and method='GET' then return jsonb_build_object('ready',false,'mode','disabled','support','294480929@qq.com','disclosures','GitHub Pages / Supabase: account, learning records and private course storage.'); end if;
 if route in ('ai/status','email/status') and method='GET' then return jsonb_build_object('ready',false); end if;
 if route='courses' and method='GET' then
  select coalesce(jsonb_agg((published-'cues'-'vocabulary'-'media')||jsonb_build_object('count',jsonb_array_length(published->'cues'),'locked',(published->>'premium')::boolean and not coalesce(p.lifetime or p.admin,false)) order by updated desc),'[]') into result from echo_private.courses where status='published'; return result;
 end if;
 if route like 'course/%' and method='GET' then
  select * into c from echo_private.courses where id=split_part(route,'/',2) and status='published';
  if not found then raise exception '课程不存在'; end if;
  if (c.published->>'premium')::boolean and not coalesce(p.lifetime or p.admin,false) then raise exception '请先兑换资料库权益'; end if;
  return c.published;
 end if;
 if uid is null or p.id is null then raise exception '请先登录'; end if;
 if route='state' and method='GET' then return coalesce((select s.body from echo_private.states s where user_id=uid),'{"completed":{},"favorites":{},"vocab":{},"seconds":0}'::jsonb); end if;
 if route='state' and method='PUT' then
  if jsonb_typeof(body->'completed') is distinct from 'object' or jsonb_typeof(body->'favorites') is distinct from 'object' or jsonb_typeof(body->'vocab') is distinct from 'object' or jsonb_typeof(body->'seconds') is distinct from 'number' then raise exception '学习记录格式无效'; end if;
  insert into echo_private.states(user_id,body) values(uid,jsonb_build_object('completed',body->'completed','favorites',body->'favorites','vocab',body->'vocab','seconds',greatest(0,least(1000000000,(body->>'seconds')::numeric)) )) on conflict(user_id) do update set body=excluded.body;
  return '{"ok":true}';
 end if;
 if route='ledger' and method='GET' then return '[]'; end if;
 if route='orders' and method='GET' then return '{"orders":[]}'; end if;
 if route='redeem' and method='POST' then
  -- Failed guesses return normally so the rate-limit write is not rolled back.
  insert into echo_private.attempts(user_id,n) values(uid,1) on conflict(user_id) do update set n=case when echo_private.attempts.window_start<now()-interval '15 minutes' then 1 else echo_private.attempts.n+1 end,window_start=case when echo_private.attempts.window_start<now()-interval '15 minutes' then now() else echo_private.attempts.window_start end returning n into total;
  if total>30 then return '{"error":"尝试过多，请 15 分钟后再试"}'; end if;
  select * into p from echo_private.profiles where id=uid for update;
  if p.lifetime then return '{"error":"你已拥有资料库权益，本次未消耗兑换码"}'; end if;
  raw_code:=upper(trim(coalesce(body->>'code','')));
  select * into cd from echo_private.codes where hash=encode(sha256(convert_to(raw_code,'UTF8')),'hex') for update;
  if not found or cd.revoked or cd.used_by is not null or cd.expires<=now() then return '{"error":"兑换码无效、过期或已使用"}'; end if;
  update echo_private.codes set used_by=uid,used_at=now() where id=cd.id;
  update echo_private.profiles set lifetime=true where id=uid;
  return jsonb_build_object('user',echo_private.profile(uid));
 end if;
 if route not like 'admin/%' then raise exception '此功能尚未开放'; end if;
 if not p.admin then raise exception '此账号没有管理权限'; end if;
 if route='admin/users' and method='GET' then select coalesce(jsonb_agg(x),'[]') into result from (select username,created,lifetime,0 as points,(select email from auth.users where id=q.id) as email from echo_private.profiles q order by created desc limit 200)x; return result; end if;
 if route='admin/codes' and method='GET' then select coalesce(jsonb_agg(x),'[]') into result from (select id,label,created,expires,revoked,used_by,used_at from echo_private.codes order by created desc limit 200)x; return result; end if;
 if route='admin/codes' and method='POST' then
  total:=coalesce((body->>'count')::integer,1); if total<1 or total>50 then raise exception '每次生成 1–50 个兑换码'; end if;
  expiry:=nullif(body->>'expires','')::timestamptz; if expiry<=now() then raise exception '有效期必须在未来'; end if;
  if length(coalesce(body->>'label',''))>100 then raise exception '备注过长'; end if;
  result:='[]';
  for i in 1..total loop
   raw_code:=upper(replace(gen_random_uuid()::text||gen_random_uuid()::text,'-',''));
   insert into echo_private.codes(hash,label,expires) values(encode(sha256(convert_to(raw_code,'UTF8')),'hex'),coalesce(body->>'label',''),expiry);
   result:=result||jsonb_build_array(raw_code);
  end loop;
  return jsonb_build_object('codes',result);
 end if;
 if route like 'admin/codes/%/revoke' and method='POST' then
  update echo_private.codes set revoked=true where id=split_part(route,'/',3)::uuid and used_by is null;
  if not found then raise exception '兑换码不存在或已经使用'; end if; return '{"ok":true}';
 end if;
 if route='admin/courses' and method='GET' then select coalesce(jsonb_agg(jsonb_build_object('course',draft,'status',status,'revision',revision,'updated',updated,'hasChanges',draft is distinct from published) order by updated desc),'[]') into result from echo_private.courses;return result; end if;
 if route='admin/courses' and method='POST' then
  course:=body->'course'; perform echo_private.validate_course(course);
  insert into echo_private.courses(id,draft) values(course->>'id',course) returning * into c;
  insert into echo_private.events(course_id,actor,action,revision) values(c.id,p.username,'create',1);
  return jsonb_build_object('course',c.draft,'status',c.status,'revision',c.revision);
 end if;
 if route like 'admin/courses/%' then
  cid:=split_part(route,'/',3);action:=split_part(route,'/',4);
  select * into c from echo_private.courses where id=cid for update;
  if not found then raise exception '课程不存在'; end if;
  if method='GET' and action='history' then select coalesce(jsonb_agg(x),'[]') into result from (select e.actor,e.action,e.revision,e.created from echo_private.events e where e.course_id=cid order by e.id desc limit 100)x;return result; end if;
  if method='GET' and action='' then return jsonb_build_object('course',c.draft,'status',c.status,'revision',c.revision);end if;
  if (method='PUT' and action='') or (method='POST' and action in ('publish','archive','restore')) then
   if (body->>'revision')::integer is distinct from c.revision then raise exception '版本冲突，请刷新后重试'; end if;
   if action='' then course:=body->'course';perform echo_private.validate_course(course);if course->>'id' is distinct from cid then raise exception '课程编号不可修改';end if;c.draft:=course;end if;
   if action='publish' then
    if c.status='archived' then raise exception '请先恢复到草稿';end if;
    perform echo_private.validate_course(c.draft,true);
    if c.published is not null then
     select jsonb_agg(jsonb_build_array(value->'start',value->'end',value->'text')) into old_timeline from jsonb_array_elements(c.published->'cues');
     select jsonb_agg(jsonb_build_array(value->'start',value->'end',value->'text')) into new_timeline from jsonb_array_elements(c.draft->'cues');
     if old_timeline is distinct from new_timeline then raise exception '修改已发布课程的原文或时间轴，请新建课程';end if;
    end if;
    c.published:=c.draft;c.status:='published';
   end if;
   if action='archive' then c.status:='archived';end if;
   if action='restore' then c.status:='draft';end if;
   update echo_private.courses set draft=c.draft,published=c.published,status=c.status,revision=c.revision+1,updated=now() where id=cid returning * into c;
   insert into echo_private.events(course_id,actor,action,revision) values(cid,p.username,case when action='' then 'save' else action end,c.revision);
   return jsonb_build_object('course',c.draft,'status',c.status,'revision',c.revision);
  end if;
 end if;
 raise exception '接口不存在';
end $$;
revoke all on all functions in schema echo_private from public,anon,authenticated;
revoke all on function public.echo_api(text,text,jsonb),public.echo_is_admin(),public.echo_media_allowed(text) from public;
grant execute on function public.echo_api(text,text,jsonb),public.echo_is_admin(),public.echo_media_allowed(text) to anon,authenticated;

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('echo-media','echo-media',false,52428800,array['video/mp4','video/webm','audio/mpeg','audio/wav']) on conflict(id) do nothing;
create policy echo_media_read on storage.objects for select to anon,authenticated using(bucket_id='echo-media' and public.echo_media_allowed(name));
create policy echo_media_upload on storage.objects for insert to authenticated with check(bucket_id='echo-media' and public.echo_is_admin());
-- No update/delete policy: overwriting a published object is intentionally disallowed.
