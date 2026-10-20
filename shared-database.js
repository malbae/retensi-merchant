/* Authenticated, shared records. Local IndexedDB remains available for backup. */
(function () {
  'use strict';
  const local=window.MerchantDB;
  const originalReady=local.ready;
  const hosted=!['localhost','127.0.0.1','[::1]',''].includes(location.hostname)&&!new URLSearchParams(location.search).has('localBackup');
  const sharedKeys=new Set(['mandiriMerchantPotentialV1','mandiriPerformanceExcelV1','mandiriRegisteredMerchantsV1','mandiriReportPeriodsV1']);
  const records=new Map(),versions={};
  const copy=value=>value===undefined?undefined:JSON.parse(JSON.stringify(value));
  let connected=false,busy=0,queue=Promise.resolve(),timer,user,online=false;
  function statusEvent(ok){online=ok;document.dispatchEvent(new CustomEvent('merchantdb:connection',{detail:{online:ok,connected,lastSync:ok?new Date().toISOString():null}}))}
  async function api(path,options={}) {
    const role=typeof currentUser!=='undefined'&&currentUser?currentUser.role:'BM';
    const response=await fetch('/api/'+path,{credentials:'same-origin',cache:'no-store',signal:AbortSignal.timeout(15000),...options,headers:{...options.headers,'X-Prototype-Role':role}});
    const data=await response.json().catch(()=>({error:'Koneksi database tidak tersedia.'}));
    if(!response.ok||data.error)throw new Error(data.error||'Data tidak dapat disinkronkan.');return data;
  }
  function same(a,b){return JSON.stringify(a)===JSON.stringify(b)}
  function plain(value){return value!==null&&typeof value==='object'&&!Array.isArray(value)}
  function changes(before,after,path=[]){
    if(same(before,after))return [];
    if(plain(before)&&plain(after))return [...new Set([...Object.keys(before),...Object.keys(after)])].flatMap(key=>changes(before[key],after[key],[...path,key]));
    return [{path,hadPrevious:before!==undefined,...(before!==undefined?{previous:before}:{}),...(after===undefined?{remove:true}:{value:after})}];
  }
  function accept(record){records.set(record.key,copy(record.value));versions[record.key]=record.version}
  function announce(){document.dispatchEvent(new CustomEvent('merchantdb:sync',{detail:{user}}))}
  async function sync(){
    if(!connected||busy||document.hidden)return false;
    try{const data=await api('state?versions='+encodeURIComponent(JSON.stringify(versions)));if(busy)return false;data.records.forEach(accept);if(data.records.length)announce();statusEvent(true);document.dispatchEvent(new CustomEvent('merchantdb:online'));return true}
    catch(error){statusEvent(false);document.dispatchEvent(new CustomEvent('merchantdb:offline',{detail:error}));return false}
  }
  local.connectShared=async()=>{
    await originalReady;
    const session=await api('session');user=session.user;
    const data=await api('state');records.clear();data.records.forEach(accept);connected=true;local.sharedUser=user;
    clearInterval(timer);timer=setInterval(sync,5000);announce();statusEvent(true);return user;
  };
  const originalRead=local.read.bind(local),originalWrite=local.write.bind(local),originalExport=local.exportAll.bind(local);
  local.read=(key,fallback)=>connected&&sharedKeys.has(key)?copy(records.has(key)?records.get(key):fallback):originalRead(key,fallback);
  local.write=(key,value)=>{
    if(!sharedKeys.has(key))return originalWrite(key,value);
    if(!connected){if(hosted)return Promise.reject(new Error('Database pusat belum terhubung. Data tidak disimpan secara lokal. Muat ulang halaman.'));return originalWrite(key,value)}
    const diff=changes(records.get(key)||{},copy(value));if(!diff.length)return Promise.resolve();
    busy++;
    const operation=queue.then(async()=>{const result=await api('state',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({key,changes:diff})});if(!result.record)throw new Error('Server tidak mengonfirmasi penyimpanan.');accept(result.record);statusEvent(true);});
    queue=operation.catch(()=>{});
    return operation.finally(()=>{busy--;if(!busy)sync()});
  };
  local.exportAll=async()=>{const payload=await originalExport();if(connected)for(const key of sharedKeys){delete payload.data[key];if(records.has(key))payload.data[key]=copy(records.get(key))}return payload};
  local.exportLocalBackup=originalExport;
  local.hasLocalData=()=>{const data=originalRead('mandiriPerformanceExcelV1',{});return !!(data.edc?.length||data.livin?.length)};
  local.migrateLocalData=async()=>{
    if(!connected)throw new Error('Database pusat belum terhubung.');
    if(typeof currentUser==='undefined'||currentUser?.role!=='RM')throw new Error('Masuk sebagai RM / Sales untuk memindahkan data lama beserta input potensinya.');
    await sync();const center=records.get('mandiriPerformanceExcelV1');
    if(center?.edc?.length||center?.livin?.length)throw new Error('Database pusat sudah memiliki data. Gunakan backup/pemulihan untuk memilih sumber yang sesuai.');
    const payload=await originalExport();if(!local.hasLocalData())throw new Error('Tidak ada data Excel lama di browser ini.');
    for(const key of ['mandiriMerchantPotentialV1','mandiriReportPeriodsV1','mandiriRegisteredMerchantsV1','mandiriPerformanceExcelV1'])if(payload.data[key])await local.write(key,payload.data[key]);announce();
  };
  const originalImport=local.importAll.bind(local);
  local.importAll=async payload=>{if(!connected)return originalImport(payload);if(payload?.format!=='retensi-merchant-backup'||!plain(payload.data))throw Error('Format backup tidak dikenali.');for(const [key,value] of Object.entries(payload.data))if(sharedKeys.has(key))await local.write(key,value);announce()};
  const originalStatus=local.status.bind(local);
  local.status=()=>connected?'shared':originalStatus();
  local.syncShared=sync;
  window.addEventListener('focus',sync);
  document.addEventListener('visibilitychange',()=>{if(!document.hidden)sync()});
  if(hosted){
    local.ready=local.connectShared().catch(error=>{statusEvent(false);document.dispatchEvent(new CustomEvent('merchantdb:offline',{detail:error}));throw error});
  }else originalReady.then(()=>{const element=document.getElementById('sharedConnectionStatus');if(element){element.title='Mode database browser';element.disabled=true}});
})();
