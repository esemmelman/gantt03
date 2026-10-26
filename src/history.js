export function actionDiff(before,after,scope=null){
 const old=new Map(before.nodes.map(n=>[n.id,n])),next=new Map(after.nodes.map(n=>[n.id,n]));
 const touched=scope?new Set(scope.ids):null;
 if(scope)for(const n of before.nodes){let current=n;while(current){if(scope.deleted.includes(current.id)){touched.add(n.id);break;}current=old.get(current.parent_id);}}
 // Compare full nested values; object key order is not meaningful for snapshots.
 const stable=value=>Array.isArray(value)?value.map(stable):value&&typeof value==='object'?Object.fromEntries(Object.keys(value).sort().map(k=>[k,stable(value[k])])):value;
 const changes=[...new Set([...old.keys(),...next.keys()])].filter(id=>(!touched||touched.has(id))&&JSON.stringify(stable(old.get(id)))!==JSON.stringify(stable(next.get(id)))).map(id=>({id,before:old.get(id)||null,after:next.get(id)||null}));
 const changedLinks=(!scope||scope.settings)&&before.links!==after.links;
 return {changes,settings_before:changedLinks?before.links:null,settings_after:changedLinks?after.links:null};
}
