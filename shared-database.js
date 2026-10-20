/* Authenticated, shared records. Local IndexedDB remains available for backup. */
(function () {
  'use strict';
  const local=window.MerchantDB;
  const originalReady=local.ready;
  const sharedKeys=new Set(['mandiriMerchantPotentialV1','mandiriPerformanceExcelV1','mandiriRegisteredMerchantsV1','mandiriReportPeriodsV1']);
  const records=new Map(),versions={},hasOwn=(value,key)=>Object.prototype.hasOwnProperty.call(value,key);
  const copy=value=>value===undefined?undefined:JSON.parse(JSON.stringify(value));
  let connected=false,busy=0,queue=Promise.resolve(),timer,user;
  async function api(path,options={}) {
    const role=typeof currentUser!=='undefined'&&currentUser?currentUser.role:'BM';
    const response=await fetch('/api/'+path,{credentials:'same-origin',cache:'no-store',...options,headers:{...options.headers,'X-Prototype-Role':role}});
    const data=await response.json().catch(()=>({error:'Koneksi database tidak tersedia.'}));
    if(!response.ok)throw new Error(data.error||'Data tidak dapat disinkronkan.');return data;
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
    if(!connected||busy||document.hidden)return;
    try{const data=await api('state?versions='+encodeURIComponent(JSON.stringify(versions)));if(busy)return;data.records.forEach(accept);if(data.records.length)announce();document.dispatchEvent(new CustomEvent('merchantdb:online'))}
    catch(error){document.dispatchEvent(new CustomEvent('merchantdb:offline',{detail:error}))}
  }
  local.connectShared=async()=>{
    await originalReady;
    const session=await api('session');user=session.user;
    const data=await api('state');records.clear();data.records.forEach(accept);connected=true;local.sharedUser=user;
    clearInterval(timer);timer=setInterval(sync,5000);announce();return user;
  };
  const originalRead=local.read.bind(local),originalWrite=local.write.bind(local),originalExport=local.exportAll.bind(local);
  local.read=(key,fallback)=>connected&&sharedKeys.has(key)?copy(records.has(key)?records.get(key):fallback):originalRead(key,fallback);
  local.write=(key,value)=>{
    if(!connected||!sharedKeys.has(key))return originalWrite(key,value);
    const diff=changes(records.get(key)||{},copy(value));if(!diff.length)return Promise.resolve();
    busy++;
    const operation=queue.then(async()=>{const result=await api('state',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({key,changes:diff})});accept(result.record);});
    queue=operation.catch(()=>{});
    return operation.finally(()=>{busy--;if(!busy)sync()});
  };
  local.exportAll=async()=>{const payload=await originalExport();if(connected)for(const key of sharedKeys){delete payload.data[key];if(records.has(key))payload.data[key]=copy(records.get(key))}return payload};
  local.exportLocalBackup=originalExport;
  const originalImport=local.importAll.bind(local);
  local.importAll=async payload=>{if(!connected)return originalImport(payload);if(payload?.format!=='retensi-merchant-backup'||!plain(payload.data))throw Error('Format backup tidak dikenali.');for(const [key,value] of Object.entries(payload.data))if(sharedKeys.has(key))await local.write(key,value);announce()};
  const originalStatus=local.status.bind(local);
  local.status=()=>connected?'shared':originalStatus();
  local.syncShared=sync;
  window.addEventListener('focus',sync);
  if(location.hostname==='retensi-merchant.pages.dev'){
    local.ready=local.connectShared().catch(error=>{document.dispatchEvent(new CustomEvent('merchantdb:offline',{detail:error}));throw error});
  }
})();
