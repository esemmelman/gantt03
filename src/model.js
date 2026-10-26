export function children(nodes,id){return nodes.filter(n=>n.parent_id===id).sort((a,b)=>a.position-b.position||a.id.localeCompare(b.id));}
export function level(nodes,node){let d=1,p=node.parent_id;const seen=new Set([node.id]);while(p){if(seen.has(p))throw Error('Invalid hierarchy');seen.add(p);const parent=nodes.find(n=>n.id===p);if(!parent)break;d++;p=parent.parent_id;}return d;}
export function height(nodes,node){return 1+Math.max(0,...children(nodes,node.id).map(n=>height(nodes,n)));}
export function visible(nodes,collapsed){const result=[];function walk(parent,depth){for(const n of children(nodes,parent)){if(n.archived)continue;result.push({...n,depth});if(!collapsed.has(n.id))walk(n.id,depth+1);}}walk(null,1);return result;}
export function actions(nodes,node){return level(nodes,node)===4?['Sibling','Edit','Notes','Comments','Archive','Delete']:['Add parent','Add child','Sibling','Edit','Notes','Comments','Archive','Delete'];}
export function iso(date){return `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`;}
export function addDays(value,count){const d=new Date(value+'T12:00:00');d.setDate(d.getDate()+count);return iso(d);}

export function archivedRoots(nodes){const byId=new Map(nodes.map(n=>[n.id,n]));return nodes.filter(n=>{if(!n.archived)return false;let parent=byId.get(n.parent_id);while(parent){if(parent.archived)return false;parent=byId.get(parent.parent_id);}return true;});}
