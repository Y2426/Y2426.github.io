import {createHash} from 'node:crypto';
export function checked(r){if(r.error)throw Error(r.error.message);if(r.data?.error)throw Error(r.data.error);return r.data;}
export async function storeDraft(sb,course,video){
 const rpc=async(route,method='GET',body={})=>checked(await sb.rpc('echo_api',{route,method,body}));
 const find=async()=>(await rpc('admin/courses')).find(r=>r.course.id===course.id);
 const old=await find();if(old)return {row:old,reused:true};
 if(!Buffer.isBuffer(video)||!video.length||video.length>50*1024*1024)throw Error('视频为空或超过 50 MiB');
 const hash=createHash('sha256').update(video).digest('hex'),name='yt-'+hash+'.mp4';
 const bucket=sb.storage.from('echo-media');
 const upload=await bucket.upload(name,video,{contentType:'video/mp4',upsert:false});
 if(upload.error){
  // Recover an uploaded object after a failed database write, without overwriting it.
  if(!['409','400'].includes(String(upload.error.statusCode)))throw Error(upload.error.message);
  const blob=checked(await bucket.download(name));
  const actual=createHash('sha256').update(Buffer.from(await blob.arrayBuffer())).digest('hex');
  if(actual!==hash)throw Error('已存在的媒体校验失败');
 }
 const draft={...course,media:'/media/'+name};
 try{
  const row=await rpc('admin/courses','POST',{course:draft});
  if(row.status!=='draft')throw Error('数据库未返回草稿状态');
  return {row,reused:false};
 }catch(e){
  const saved=await find();if(saved)return {row:saved,reused:true};throw e;
 }
}
