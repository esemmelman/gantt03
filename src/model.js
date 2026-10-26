export function children(nodes,id){return nodes.filter(n=>n.parent_id===id).sort((a,b)=>a.position-b.position||a.id.localeCompare(b.id));}
export function level(nodes,node){let d=1,p=node.parent_id;const seen=new Set([node.id]);while(p){if(seen.has(p))throw Error('Invalid hierarchy');seen.add(p);const parent=nodes.find(n=>n.id===p);if(!parent)break;d++;p=parent.parent_id;}return d;}
export function height(nodes,node){return 1+Math.max(0,...children(nodes,node.id).map(n=>height(nodes,n)));}
export function visible(nodes,collapsed){const result=[];function walk(parent,depth){for(const n of children(nodes,parent)){result.push({...n,depth});if(!collapsed.has(n.id))walk(n.id,depth+1);}}walk(null,1);return result;}
export function actions(nodes,node){return level(nodes,node)===4?['Sibling','Edit','Delete']:['Add parent','Add child','Sibling','Edit','Delete'];}
export function iso(date){return `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`;}
export function addDays(value,count){const d=new Date(value+'T12:00:00');d.setDate(d.getDate()+count);return iso(d);}
