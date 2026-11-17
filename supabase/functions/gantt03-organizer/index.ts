// Replaced only in the deployment payload; credential verifiers stay out of Git.
const ACCESS_HASH = '__DEPLOYMENT_ACCESS_HASH__';
const ORIGIN = 'https://esemmelman.github.io';
const SESSION_MS = 90 * 24 * 60 * 60 * 1000;
const encode = (bytes: Uint8Array) => btoa(String.fromCharCode(...bytes)).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');
const decode = (value: string) => Uint8Array.from(atob(value.replace(/-/g,'+').replace(/_/g,'/')), c=>c.charCodeAt(0));
async function signingKey(secret: string) {
  return crypto.subtle.importKey('raw',new TextEncoder().encode(secret+':gantt03-session:'+ACCESS_HASH),{name:'HMAC',hash:'SHA-256'},false,['sign','verify']);
}
async function issueSession(secret: string) {
  const issuedAt=Date.now(),expiresAt=issuedAt+SESSION_MS;
  const payload=encode(new TextEncoder().encode(JSON.stringify({v:1,issuedAt,expiresAt})));
  const signature=await crypto.subtle.sign('HMAC',await signingKey(secret),new TextEncoder().encode(payload));
  return {token:payload+'.'+encode(new Uint8Array(signature)),expiresAt};
}
async function verifySession(token: unknown,secret: string) {
  try {
    if(typeof token!=='string'||token.length>1024)return null;
    const parts=token.split('.');if(parts.length!==2)return null;
    if(!await crypto.subtle.verify('HMAC',await signingKey(secret),decode(parts[1]),new TextEncoder().encode(parts[0])))return null;
    const payload=JSON.parse(new TextDecoder().decode(decode(parts[0])));
    const now=Date.now();
    if(payload.v!==1||!Number.isSafeInteger(payload.issuedAt)||!Number.isSafeInteger(payload.expiresAt)||payload.issuedAt>now||payload.expiresAt<=now||payload.expiresAt-payload.issuedAt!==SESSION_MS)return null;
    return {token,expiresAt:payload.expiresAt};
  }catch{return null;}
}
export async function handle(req: Request): Promise<Response> {
 const origin=req.headers.get('Origin');
 const headers: Record<string,string>={'Content-Type':'application/json','Cache-Control':'no-store','Vary':'Origin'};
 if(origin===ORIGIN)headers['Access-Control-Allow-Origin']=ORIGIN;
 const reply=(body: unknown,status=200)=>new Response(JSON.stringify(body),{status,headers});
 if(origin&&origin!==ORIGIN)return reply({error:'Origin not allowed'},403);
 if(req.method==='OPTIONS')return new Response(null,{status:204,headers:{...headers,'Access-Control-Allow-Methods':'POST, OPTIONS','Access-Control-Allow-Headers':'content-type'}});
 if(req.method!=='POST')return reply({error:'Method not allowed'},405);
 try{
  const raw=await req.text();if(raw.length>2000000)return reply({error:'Request is too large'},413);
  const input=JSON.parse(raw);
  const base=Deno.env.get('SUPABASE_URL'),key=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if(!base||!key)return reply({error:'Database access unavailable'},503);
  let session=await verifySession(input.sessionToken,key);
  if(!session){
   const accessCode=input.accessCode;
   if(typeof accessCode!=='string'||!accessCode||accessCode.length>128)return reply({error:'Enter the organizer access code.'},401);
   const digest=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(accessCode))),b=>b.toString(16).padStart(2,'0')).join('');
   let difference=0;for(let i=0;i<ACCESS_HASH.length;i++)difference|=ACCESS_HASH.charCodeAt(i)^digest.charCodeAt(i);
   if(difference!==0)return reply({error:'Organizer access code is not valid.'},401);
   session=await issueSession(key);
  }
  if(input.action==='login')return reply({session});
  const route=allowedRoute(input.path,input.method);
  if(!route)return reply({error:'This chart operation is not allowed.'},400);
  if(input.method!=='GET'&&!validBody(input.path,input.body))return reply({error:'Invalid chart request.'},400);
  const response=await fetch(base+'/rest/v1/'+route,{
   method:input.method,headers:{apikey:key,Authorization:'Bearer '+key,'Content-Type':'application/json',Prefer:'return=representation'},
   body:input.method==='GET'?undefined:JSON.stringify(input.body),signal:AbortSignal.timeout(20000)
  });
  const data=await response.json().catch(()=>null);
  if(!response.ok)return reply({error:data?.message||'Could not save the chart.'},response.status);
  return reply({data,session});
 }catch{return reply({error:'The chart service could not complete the request. Please refresh before retrying a change.'},502);}
}
const UUID='[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}';
function allowedRoute(path: unknown,method: unknown): string|null {
 if(typeof path!=='string'||typeof method!=='string')return null;
 if(method==='GET'&&path==='gantt03_nodes?select=*&order=position.asc,id.asc&limit=10000')return path;
 if(method==='POST'&&path==='gantt03_nodes')return path;
 if(['GET','PATCH','DELETE'].includes(method)&&new RegExp('^gantt03_nodes\\?id=eq\\.'+UUID+'$').test(path))return path;
 if(['GET','PATCH'].includes(method)&&path==='gantt03_settings?id=eq.1')return path;
 if(method==='POST'&&['rpc/gantt03_add_parent','rpc/gantt03_update_colors','rpc/gantt03_save_notes','rpc/gantt03_add_comment','rpc/gantt03_undo_action'].includes(path))return path;
 return null;
}
function validBody(path: string,body: unknown) {
 if(path.startsWith('gantt03_nodes?id=eq.')&&body===undefined)return true;
 if(!body||typeof body!=='object'||Array.isArray(body))return false;
 const keys=Object.keys(body);
 if(path.startsWith('gantt03_nodes'))return keys.every(k=>['id','parent_id','title','start_date','end_date','color','text_color','notes','links','position','bars','notes_html','comments','archived'].includes(k));
 if(path.startsWith('gantt03_settings'))return keys.length===1&&keys[0]==='general_links'&&typeof (body as Record<string,unknown>).general_links==='string';
 const params: Record<string,string[]>={
 'rpc/gantt03_add_parent':['target_id','parent_title'],'rpc/gantt03_update_colors':['changes'],
 'rpc/gantt03_save_notes':['target_id','expected_html','new_html','plain_text'],
 'rpc/gantt03_add_comment':['target_id','comment_id','comment_body'],
 'rpc/gantt03_undo_action':['changes','settings_before','settings_after']
 };
 return !!params[path]&&keys.every(k=>params[path].includes(k));
}
Deno.serve(handle);
