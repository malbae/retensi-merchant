const SHARED_KEYS = new Set(['mandiriMerchantPotentialV1', 'mandiriPerformanceExcelV1', 'mandiriRegisteredMerchantsV1', 'mandiriReportPeriodsV1', 'mandiriBusinessCategoriesV1']);
const forbidden = new Set(['__proto__', 'prototype', 'constructor']);
let certCache;
function json(body, status = 200) { return new Response(JSON.stringify(body), {status, headers: {'Content-Type':'application/json', 'Cache-Control':'no-store'}}); }
function decode(value) { return Uint8Array.from(atob(value.replace(/-/g,'+').replace(/_/g,'/')), c=>c.charCodeAt(0)); }
export async function identity(request, env) {
  if(env.PUBLIC_PROTOTYPE==='true') {
    const role=request.headers.get('X-Prototype-Role')||'BM';
    if(!['BM','RM','OPS'].includes(role))throw new Error('FORBIDDEN');
    return {email:'prototype-public',role,prototype:true};
  }
  if (!env.ACCESS_TEAM_DOMAIN || !env.ACCESS_AUD || !env.USER_ROLES) throw new Error('SETUP_REQUIRED');
  const token = request.headers.get('Cf-Access-Jwt-Assertion');
  if (!token) throw new Error('LOGIN_REQUIRED');
  const parts = token.split('.');
  if (parts.length !== 3) throw new Error('LOGIN_REQUIRED');
  const header = JSON.parse(new TextDecoder().decode(decode(parts[0])));
  const claims = JSON.parse(new TextDecoder().decode(decode(parts[1])));
  const issuer = 'https://' + env.ACCESS_TEAM_DOMAIN.replace(/^https:\/\//,'').replace(/\/$/,'');
  const now = Date.now()/1000;
  if (header.alg !== 'RS256' || claims.iss !== issuer || !Number.isFinite(claims.exp) || claims.exp<=now || (claims.nbf && claims.nbf>now) || !(Array.isArray(claims.aud)?claims.aud:[claims.aud]).includes(env.ACCESS_AUD)) throw new Error('LOGIN_REQUIRED');
  if (!certCache || certCache.issuer!==issuer || certCache.expires<Date.now() || !certCache.keys.some(k=>k.kid===header.kid)) {
    const response=await fetch(issuer+'/cdn-cgi/access/certs');
    if (!response.ok) throw new Error('LOGIN_REQUIRED');
    certCache={issuer,keys:(await response.json()).keys,expires:Date.now()+300000};
  }
  const jwk=certCache.keys.find(k=>k.kid===header.kid);
  if (!jwk) throw new Error('LOGIN_REQUIRED');
  const key=await crypto.subtle.importKey('jwk',jwk,{name:'RSASSA-PKCS1-v1_5',hash:'SHA-256'},false,['verify']);
  if (!await crypto.subtle.verify('RSASSA-PKCS1-v1_5',key,decode(parts[2]),new TextEncoder().encode(parts[0]+'.'+parts[1]))) throw new Error('LOGIN_REQUIRED');
  const email=String(claims.email||'').toLowerCase(),roles=JSON.parse(env.USER_ROLES),role=roles[email];
  if (!['BM','RM','OPS'].includes(role)) throw new Error('FORBIDDEN');
  return {email,role};
}
function same(a,b) { return JSON.stringify(a)===JSON.stringify(b); }
export function mergeChanges(current, changes) {
  const result=structuredClone(current||{});
  for (const change of changes) {
    if (!Array.isArray(change.path) || !change.path.length || change.path.length>5 || change.path.some(k=>typeof k!=='string'||forbidden.has(k))) throw new Error('INVALID_CHANGE');
    let target=result;
    for (const field of change.path.slice(0,-1)) {
      if (target[field]===undefined) target[field]={};
      if (!target[field] || typeof target[field]!=='object' || Array.isArray(target[field])) throw new Error('CONFLICT');
      target=target[field];
    }
    const field=change.path.at(-1),exists=Object.hasOwn(target,field);
    const alreadyApplied=change.remove?!exists:(exists&&same(target[field],change.value));
    if (alreadyApplied) continue;
    if (exists!==change.hadPrevious || (exists&&!same(target[field],change.previous))) throw new Error('CONFLICT');
    if (change.remove) delete target[field];else target[field]=change.value;
  }
  return result;
}
export async function onRequest({request,env,params}) {
  try {
    const user=await identity(request,env);
    if (!env.DB) return json({error:'Database pusat belum dihubungkan.'},503);
    const path=Array.isArray(params.path)?params.path.join('/'):String(params.path||'');
    if (path==='session' && request.method==='GET') return json({user});
    if (path==='state' && request.method==='GET') {
      const versions=JSON.parse(new URL(request.url).searchParams.get('versions')||'{}');
      const {results}=await env.DB.prepare('SELECT key, version FROM shared_records').all();
      const records=[];
      for (const row of results) if (SHARED_KEYS.has(row.key)&&versions[row.key]!==row.version) {
        const record=await env.DB.prepare('SELECT key,value,version,updated_at,updated_by FROM shared_records WHERE key=?').bind(row.key).first();
        records.push({...record,value:JSON.parse(record.value)});
      }
      return json({records,user});
    }
    if (path==='state' && request.method==='POST') {
      const origin=request.headers.get('Origin');
      if (origin!==new URL(request.url).origin) return json({error:'Permintaan tidak diizinkan.'},403);
      if (Number(request.headers.get('Content-Length')||0)>8000000) return json({error:'Data terlalu besar.'},413);
      const text=await request.text();if(text.length>8000000)return json({error:'Data terlalu besar.'},413);
      const input=JSON.parse(text);
      if(!SHARED_KEYS.has(input.key)||!Array.isArray(input.changes)||input.changes.length>10000) return json({error:'Data tidak valid.'},400);
      if (input.key==='mandiriMerchantPotentialV1' && user.role!=='RM') return json({error:'Hanya RM / Sales yang dapat mengubah potensi merchant.'},403);
      if (input.key==='mandiriBusinessCategoriesV1' && user.role!=='RM') return json({error:'Hanya RM / Sales yang dapat mengubah kategori bisnis.'},403);
      for(let attempt=0;attempt<4;attempt++) {
        const old=await env.DB.prepare('SELECT value,version FROM shared_records WHERE key=?').bind(input.key).first();
        const value=mergeChanges(old?JSON.parse(old.value):{},input.changes),version=(old?.version||0)+1,time=new Date().toISOString();
        const statement=old?env.DB.prepare('UPDATE shared_records SET value=?,version=?,updated_at=?,updated_by=? WHERE key=? AND version=?').bind(JSON.stringify(value),version,time,user.email,input.key,old.version):env.DB.prepare('INSERT OR IGNORE INTO shared_records(key,value,version,updated_at,updated_by) VALUES(?,?,?,?,?)').bind(input.key,JSON.stringify(value),version,time,user.email);
        const result=await statement.run();
        if(result.meta.changes) return json({record:{key:input.key,value,version,updated_at:time,updated_by:user.email}});
      }
      return json({error:'Data sedang diperbarui pengguna lain. Muat ulang data lalu coba simpan kembali.'},409);
    }
    return json({error:'Tidak ditemukan.'},404);
  } catch(error) {
    const errors={SETUP_REQUIRED:[503,'Login database pusat belum dikonfigurasi.'],LOGIN_REQUIRED:[401,'Silakan login kembali.'],FORBIDDEN:[403,'Email Anda belum mendapat akses.'],CONFLICT:[409,'Data yang sama sudah diubah pengguna lain. Muat ulang data sebelum menyimpan.'],INVALID_CHANGE:[400,'Perubahan data tidak valid.']};
    const [status,message]=errors[error.message]||[500,'Database belum dapat diakses. Coba kembali sebentar lagi.'];
    return json({error:message},status);
  }
}
