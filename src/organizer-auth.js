const ENDPOINT='https://fgomaujsdblpzxhnnqrg.supabase.co/functions/v1/gantt03-organizer';
const STORAGE_KEY='gantt03-organizer-session.v1';
let storage;try{storage=window.localStorage;}catch{}
let session=null,loginPromise=null;
try{const saved=JSON.parse(storage?.getItem(STORAGE_KEY)||'null');if(saved&&typeof saved.token==='string'&&saved.expiresAt>Date.now())session=saved;else storage?.removeItem(STORAGE_KEY);}catch{}

async function send(body){
 const response=await fetch(ENDPOINT,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body),cache:'no-store',signal:AbortSignal.timeout(30000)});
 const result=await response.json().catch(()=>({error:'The organizer service did not respond.'}));
 return {response,result};
}
function forget(){session=null;try{storage?.removeItem(STORAGE_KEY);}catch{}document.body.dataset.organizerLocked='true';}
function remember(value){session=value;try{storage?.setItem(STORAGE_KEY,JSON.stringify(value));}catch{}document.body.dataset.organizerLocked='false';}
export function signOut(){forget();location.reload();}
async function signIn(){
 if(loginPromise)return loginPromise;
 loginPromise=new Promise(resolve=>{
  const dialog=document.querySelector('#organizer-login'),form=document.querySelector('#organizer-form'),input=document.querySelector('#organizer-passcode'),button=document.querySelector('#organizer-submit'),error=document.querySelector('#organizer-error');
  document.body.dataset.organizerLocked='true';error.textContent='';input.value='';
  dialog.oncancel=event=>event.preventDefault();dialog.showModal();input.focus();
  form.onsubmit=async event=>{
   event.preventDefault();if(button.disabled)return;button.disabled=true;error.textContent='Signing in…';
   try{
    const {response,result}=await send({action:'login',accessCode:input.value});
    if(!response.ok||!result.session)throw Error(result.error||'Could not sign in.');
    remember(result.session);input.value='';dialog.close();resolve();
   }catch(e){error.textContent=e.name==='TimeoutError'?'The connection timed out. Please try again.':e.message;}
   finally{button.disabled=false;}
  };
 }).finally(()=>{loginPromise=null;});
 return loginPromise;
}
export async function organizerRequest(path,method='GET',body){
 if(!session||session.expiresAt<=Date.now()){forget();await signIn();}
 let answer=await send({sessionToken:session.token,path,method,body});
 // A 401 is returned before any database operation. Retry only after a new sign-in.
 if(answer.response.status===401){forget();await signIn();answer=await send({sessionToken:session.token,path,method,body});}
 if(!answer.response.ok)throw Error(answer.result.error||`Request failed (${answer.response.status})`);
 if(answer.result.session)remember(answer.result.session);
 return answer.result.data;
}
