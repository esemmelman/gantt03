import {test} from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import vm from 'node:vm';
const source=fs.readFileSync('src/organizer-auth.js','utf8').replaceAll('export ','');
function app(saved=null){
 const data=new Map(saved?[['gantt03-organizer-session.v1',JSON.stringify(saved)]]:[]),nodes={};
 for(const id of ['#organizer-login','#organizer-form','#organizer-passcode','#organizer-submit','#organizer-error'])nodes[id]={value:'',disabled:false,textContent:'',open:false,focus(){},showModal(){this.open=true;},close(){this.open=false;}};
 const calls=[];const session={token:'signed-token',expiresAt:Date.now()+90*86400000};
 const storage={getItem:k=>data.get(k)||null,setItem:(k,v)=>data.set(k,v),removeItem:k=>data.delete(k)};
 const context=vm.createContext({window:{localStorage:storage},document:{body:{dataset:{}},querySelector:id=>nodes[id]},location:{reload(){}},Date,JSON,Error,AbortSignal,fetch:async(url,opts)=>{const body=JSON.parse(opts.body);calls.push({url,body});return Response.json(body.action==='login'?{session}:{data:[{title:'Synthetic chart'}],session});}});
 vm.runInContext(source,context);return {context,nodes,calls,data,session};
}
test('parallel chart loads share one login and store a token instead of the passcode',async()=>{
 const a=app();const first=a.context.organizerRequest('gantt03_nodes','GET'),second=a.context.organizerRequest('gantt03_settings?id=eq.1','GET');
 assert.equal(a.nodes['#organizer-login'].open,true);assert.equal(a.calls.length,0);
 a.nodes['#organizer-passcode'].value='synthetic-passcode';await a.nodes['#organizer-form'].onsubmit({preventDefault(){}});await Promise.all([first,second]);
 assert.equal(a.calls.filter(c=>c.body.action==='login').length,1);
 assert.ok(!JSON.stringify([...a.data]).includes('synthetic-passcode'));assert.equal(a.nodes['#organizer-passcode'].value,'');
});
test('returning browser loads chart without asking for a passcode',async()=>{
 const a=app({token:'remembered',expiresAt:Date.now()+86400000});await a.context.organizerRequest('gantt03_nodes','GET');
 assert.equal(a.nodes['#organizer-login'].open,false);assert.equal(a.calls[0].body.sessionToken,'remembered');
 assert.equal(a.context.document.body.dataset.organizerLocked,'false');
});
