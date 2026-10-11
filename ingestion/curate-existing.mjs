// Explicit operator command: refresh course copy and vocabulary without publishing
// or touching its media/timeline. Optimistic revision checks preserve concurrent edits.
import {createClient} from '@supabase/supabase-js';
import {mkdir,writeFile} from 'node:fs/promises';
import path from 'node:path';
import {curateCourse} from './curation.mjs';
import {checked} from './sink.mjs';
const id=process.argv[2];
if(!/^yt-[a-f0-9]{22}$/.test(id||''))throw Error('请指定自动导入的 YouTube 课程编号');
const sb=createClient(process.env.SUPABASE_URL,process.env.SUPABASE_PUBLISHABLE_KEY,{auth:{persistSession:false,autoRefreshToken:false}});
checked(await sb.auth.signInWithPassword({email:process.env.INGEST_ADMIN_USERNAME.toLowerCase()+'@accounts.myecho.fun',password:process.env.INGEST_ADMIN_PASSWORD}));
const rpc=async(route,method='GET',body={})=>checked(await sb.rpc('echo_api',{route,method,body}));
try{
 const row=await rpc('admin/courses/'+id);
 if(row.course.source?.platform!=='youtube')throw Error('不是 YouTube 导入课程');
 const dir=path.resolve('data/curation-backups');await mkdir(dir,{recursive:true});
 await writeFile(path.join(dir,id+'-v'+row.revision+'.json'),JSON.stringify(row,null,2),{flag:'wx'}).catch(e=>{if(e.code!=='EEXIST')throw e;});
 const course=await curateCourse(row.course);
 if(course.media!==row.course.media||JSON.stringify(course.cues)!==JSON.stringify(row.course.cues))throw Error('编辑不得改变视频或字幕时间轴');
 const saved=await rpc('admin/courses/'+id,'PUT',{course,revision:row.revision});
 await writeFile(path.join(dir,id+'-updated.json'),JSON.stringify(saved,null,2));
 console.log(JSON.stringify({title:course.title,level:course.level,description:course.description,difficulty:course.difficulty.reason,vocabulary:Object.keys(course.vocabulary),status:saved.status,revision:saved.revision},null,2));
}finally{await sb.auth.signOut({scope:'local'});}
