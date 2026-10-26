const base='https://fgomaujsdblpzxhnnqrg.supabase.co/rest/v1/';
// Publishable browser key; this app intentionally has public read/write access.
const key='sb_publishable_JOUqLZDnfGu_yCa6k6FVDQ_AYwpr72i';
export async function request(path,method='GET',body){const res=await fetch(base+path,{method,headers:{apikey:key,'Content-Type':'application/json',Prefer:'return=representation'},body:body===undefined?undefined:JSON.stringify(body)});const data=await res.json().catch(()=>null);if(!res.ok)throw Error(data?.message||`Request failed (${res.status})`);return data;}
export async function load(){return request('gantt03_nodes?select=*&order=position.asc,id.asc&limit=10000');}
export async function create(body){return request('gantt03_nodes','POST',body);}
export async function update(id,body){const rows=await request(`gantt03_nodes?id=eq.${id}`,'PATCH',body);if(!rows.length)throw Error('This node was deleted. Refresh the chart.');return rows;}
export async function remove(id){return request(`gantt03_nodes?id=eq.${id}`,'DELETE');}
export async function addParent(id,title){return request('rpc/gantt03_add_parent','POST',{target_id:id,parent_title:title});}
