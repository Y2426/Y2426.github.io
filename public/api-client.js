import {cloudConfig} from './cloud-config.js';
export const cloudMode = !!cloudConfig;
let clientPromise;
async function client(){
 if(!clientPromise)clientPromise=import('./supabase-sdk.js').then(({createClient})=>createClient(cloudConfig.url,cloudConfig.key,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:false}}));
 return clientPromise;
}
function checked(result){if(result.error)throw Error(result.error.message||result.error);return result.data;}
function accountAddress(username){
 const name=String(username||'').trim().toLowerCase();
 if(!/^[a-z0-9_]{3,30}$/.test(name))throw Error('账号需为 3–30 位字母、数字或下划线');
 // Internal identifier only: this is NOT a verified contact email.
 return name+'@accounts.myecho.fun';
}
export async function mediaUrl(media){
 if(!cloudMode||!media?.startsWith('/media/'))return media;
 const sb=await client();return checked(await sb.storage.from('echo-media').createSignedUrl(media.slice(7),7200)).signedUrl;
}
export async function api(route,method='GET',body={}){
 if(!cloudMode){const r=await fetch('/api/'+route,{method,headers:method==='GET'?{}:{'Content-Type':'application/json'},body:method==='GET'?undefined:JSON.stringify(body)});const data=await r.json();if(!r.ok)throw Error(data.error||'请求失败');return data;}
 const sb=await client();
 if(route==='login'||route==='register'){
  if(method!=='POST')throw Error('请求方法不支持');
  const email=accountAddress(body.username),password=String(body.password||'');
  if(password.length<10||password.length>128)throw Error('密码须为 10–128 位');
  const data=checked(route==='login'?await sb.auth.signInWithPassword({email,password}):await sb.auth.signUp({email,password,options:{data:{username:String(body.username).trim().toLowerCase()}}}));
  if(!data.session)throw Error('账号尚未启用。请联系管理员检查 Supabase 注册配置。');
  return api('me');
 }
 if(route==='logout'){checked(await sb.auth.signOut({scope:'local'}));return {ok:true};}
 if(route==='change-password'){
  const user=checked(await sb.auth.getUser()).user;
  if(!user)throw Error('请先登录');
  if(String(body.newPassword||'').length<10||String(body.newPassword).length>128)throw Error('新密码须为 10–128 位');
  checked(await sb.auth.signInWithPassword({email:user.email,password:body.currentPassword}));
  checked(await sb.auth.updateUser({password:body.newPassword}));
  checked(await sb.auth.signOut({scope:'others'}));return {ok:true};
 }
 const data=checked(await sb.rpc('echo_api',{route,method,body}));
 if(data?.error)throw Error(data.error);
 if(route.startsWith('course/')&&data?.media)return {...data,media:await mediaUrl(data.media)};
 return data;
}
// Explicit transport for existing feature modules; never overrides global fetch.
export async function apiFetch(url,options={}){
 if(!cloudMode)return fetch(url,options);
 try{return Response.json(await api(url.replace(/^\/api\//,''),options.method||'GET',options.body?JSON.parse(options.body):{}));}
 catch(e){return Response.json({error:e.message},{status:400});}
}
export async function uploadMedia(file,onProgress=()=>{}){
 const type={mp4:'video/mp4',webm:'video/webm',mp3:'audio/mpeg',wav:'audio/wav'}[file.name.split('.').at(-1).toLowerCase()];
 if(!type)throw Error('不支持此媒体格式');
 if(cloudMode){
  if(file.size>50*1024*1024)throw Error('免费存储单个文件上限 50 MB，请先压缩视频');
  const sb=await client(),name='upload-'+crypto.randomUUID().replaceAll('-','')+'.'+file.name.split('.').at(-1).toLowerCase();
  onProgress(0);checked(await sb.storage.from('echo-media').upload(name,file,{contentType:type,upsert:false}));onProgress(100);
  return {media:'/media/'+name,kind:type.startsWith('video')?'video':'audio'};
 }
 return new Promise((resolve,reject)=>{const xhr=new XMLHttpRequest();xhr.open('POST','/api/admin/upload');xhr.setRequestHeader('Content-Type',type);xhr.upload.onprogress=e=>{if(e.lengthComputable)onProgress(e.loaded/e.total*100);};xhr.onload=()=>{try{const d=JSON.parse(xhr.responseText);xhr.status===200?resolve(d):reject(Error(d.error));}catch{reject(Error('上传失败'));}};xhr.onerror=()=>reject(Error('上传中断'));xhr.send(file);});
}
