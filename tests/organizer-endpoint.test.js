import {test} from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import vm from 'node:vm';import {stripTypeScriptTypes} from 'node:module';import {webcrypto,createHash} from 'node:crypto';
const passcode='synthetic-passcode';
const source=stripTypeScriptTypes(fs.readFileSync('supabase/functions/gantt03-organizer/index.ts','utf8').replace('__DEPLOYMENT_ACCESS_HASH__',createHash('sha256').update(passcode).digest('hex')).replace('export async function','async function'));
function createHandler(fetch,now=()=>Date.now()){let handle;class Clock extends Date{static now(){return now();}}vm.runInNewContext(source,{Request,Response,URLSearchParams,AbortSignal,TextEncoder,TextDecoder,atob,btoa,Date:Clock,crypto:webcrypto,fetch,Deno:{env:{get:n=>n==='SUPABASE_URL'?'https://database.example':'server-secret'},serve:h=>handle=h}});return handle;}
const request=body=>new Request('https://example.org',{method:'POST',headers:{Origin:'https://esemmelman.github.io'},body:JSON.stringify(body)});
test('anonymous and incorrect passcode requests cannot reach database operations',async()=>{const h=createHandler(()=>assert.fail('No database access'));for(const body of [{},{accessCode:'wrong',path:'gantt03_nodes',method:'POST',body:{title:'test'}},{sessionToken:'forged'}])assert.equal((await h(request(body))).status,401);});
test('sessions permit only allowlisted chart operations, never arbitrary tables or functions',async()=>{
 const calls=[];const h=createHandler(async(url,opts)=>{calls.push({url,opts});return Response.json([]);});
 const login=await (await h(request({action:'login',accessCode:passcode}))).json();assert.equal(calls.length,0);
 const sessionToken=login.session.token;
 for(const [path,method,body] of [['hanukkah_serenading_signups','GET'],['rpc/execute_sql','POST',{}],['gantt03_nodes?id=eq.00000000-0000-4000-8000-000000000001&title=neq.secret','DELETE'],['gantt03_nodes','POST',{unexpected:'field'}]])assert.equal((await h(request({sessionToken,path,method,body}))).status,400);
 assert.equal(calls.length,0);
 const id='00000000-0000-4000-8000-000000000001';
 for(const [path,method,body] of [['gantt03_nodes?select=*&order=position.asc,id.asc&limit=10000','GET'],['gantt03_nodes','POST',{title:'test'}],[`gantt03_nodes?id=eq.${id}`,'PATCH',{title:'changed'}],[`gantt03_nodes?id=eq.${id}`,'DELETE'],['gantt03_settings?id=eq.1','PATCH',{general_links:'test'}],['rpc/gantt03_undo_action','POST',{changes:[]}]])assert.equal((await h(request({sessionToken,path,method,body}))).status,200);
 assert.equal(calls.length,6);assert.equal(calls[0].opts.headers.Authorization,'Bearer server-secret');
});
test('Gantt sessions expire at 90 days and reject tampering',async()=>{
 let now=1800000000000;const h=createHandler(()=>assert.fail('No database read for login'),()=>now);
 const first=await (await h(request({action:'login',accessCode:passcode}))).json();assert.equal(first.session.expiresAt,now+90*86400000);
 now+=89*86400000;const reused=await (await h(request({action:'login',sessionToken:first.session.token}))).json();assert.equal(reused.session.expiresAt,first.session.expiresAt);
 now=first.session.expiresAt;assert.equal((await h(request({action:'login',sessionToken:first.session.token}))).status,401);
 assert.equal((await h(request({action:'login',sessionToken:'forged.'+first.session.token.split('.')[1]}))).status,401);
});
