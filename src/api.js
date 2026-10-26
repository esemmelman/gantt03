const base='https://fgomaujsdblpzxhnnqrg.supabase.co/rest/v1/';
// Publishable browser key; this app intentionally has public read/write access.
const key='sb_publishable_JOUqLZDnfGu_yCa6k6FVDQ_AYwpr72i';
let recording=null;
export function beginRecording(){recording={ids:[],deleted:[],settings:false};}
export function endRecording(){const result=recording;recording=null;return result;}
function track(path,method,body,data){
 if(!recording||method==='GET')return;
 if(path.startsWith('gantt03_nodes')){for(const row of data||[])recording.ids.push(row.id);if(method==='DELETE'){const id=path.split('id=eq.')[1];recording.deleted.push(id);recording.ids.push(id);}}
 if(path==='rpc/gantt03_add_parent')recording.ids.push(body.target_id,data);
 if(path==='rpc/gantt03_update_colors')recording.ids.push(...body.changes.map(n=>n.id));
 if(path.startsWith('gantt03_settings'))recording.settings=true;
}
export async function request(path,method='GET',body){const res=await fetch(base+path,{method,headers:{apikey:key,'Content-Type':'application/json',Prefer:'return=representation'},body:body===undefined?undefined:JSON.stringify(body)});const data=await res.json().catch(()=>null);if(!res.ok)throw Error(data?.message||`Request failed (${res.status})`);track(path,method,body,data);return data;}
export async function load(){return request('gantt03_nodes?select=*&order=position.asc,id.asc&limit=10000');}
export async function create(body){return request('gantt03_nodes','POST',body);}
export async function update(id,body){const rows=await request(`gantt03_nodes?id=eq.${id}`,'PATCH',body);if(!rows.length)throw Error('This node was deleted. Refresh the chart.');return rows;}
export async function remove(id){return request(`gantt03_nodes?id=eq.${id}`,'DELETE');}
export async function addParent(id,title){return request('rpc/gantt03_add_parent','POST',{target_id:id,parent_title:title});}
export async function updateColors(changes){return request('rpc/gantt03_update_colors','POST',{changes});}
export async function snapshot(){const [nodes,settings]=await Promise.all([load(),request('gantt03_settings?id=eq.1')]);return {nodes,links:settings[0].general_links};}
export async function undoAction(action){return request('rpc/gantt03_undo_action','POST',action);}
