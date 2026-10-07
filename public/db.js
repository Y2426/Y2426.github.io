const opening = new Promise((resolve,reject)=>{
  const request=indexedDB.open('echo-studio',1);
  request.onupgradeneeded=()=>request.result.createObjectStore('courses',{keyPath:'id'});
  request.onsuccess=()=>resolve(request.result);
  request.onerror=()=>reject(request.error);
});
async function operation(mode,action) {
  const db=await opening;
  return new Promise((resolve,reject)=>{
    const tx=db.transaction('courses',mode); const req=action(tx.objectStore('courses'));
    tx.oncomplete=()=>resolve(req.result);tx.onerror=()=>reject(tx.error);tx.onabort=()=>reject(tx.error||new Error('保存中断'));
  });
}
export const getCourses=()=>operation('readonly',store=>store.getAll());
export const saveCourse=course=>operation('readwrite',store=>store.put(course));
export const deleteCourse=id=>operation('readwrite',store=>store.delete(id));
