import {test} from 'node:test';
import assert from 'node:assert/strict';
import {actions,level,height,visible,projectRoot,projectVisible,archivedRoots,addDays} from '../src/model.js';
const nodes=[{id:'a',parent_id:null,position:0},{id:'b',parent_id:'a',position:0},{id:'c',parent_id:'b',position:0},{id:'d',parent_id:'c',position:0}];
test('fourth-level nodes allow siblings without adding a deeper level',()=>{assert.equal(level(nodes,nodes[3]),4);assert.deepEqual(actions(nodes,nodes[3]),['Sibling','Edit','Notes','Comments','Archive','Delete']);assert.deepEqual(actions(nodes,nodes[2]),['Add parent','Add child','Sibling','Edit','Notes','Comments','Archive','Delete']);});
test('wrapping a branch accounts for all descendant levels',()=>{assert.equal(height(nodes,nodes[0]),4);assert.equal(level(nodes,nodes[1])+height(nodes,nodes[1]),5);});
test('collapse retains the parent and hides all descendants',()=>{assert.deepEqual(visible(nodes,new Set(['b'])).map(n=>n.id),['a','b']);assert.deepEqual(visible(nodes,new Set()).map(n=>n.depth),[1,2,3,4]);});
test('date stepping works across month and year boundaries',()=>{assert.equal(addDays('2026-12-31',1),'2027-01-01');assert.equal(addDays('2028-02-28',1),'2028-02-29');});
test('archiving a branch hides its descendants and preserves independent child archives',()=>{
 const archived=nodes.map(n=>({...n,archived:n.id==='b'||n.id==='d'}));
 assert.deepEqual(visible(archived,new Set()).map(n=>n.id),['a']);assert.deepEqual(archivedRoots(archived).map(n=>n.id),['b']);
 archived[1].archived=false;assert.deepEqual(visible(archived,new Set()).map(n=>n.id),['a','b','c']);assert.deepEqual(archivedRoots(archived).map(n=>n.id),['d']);
});
test('project focus keeps the root and all four levels together without changing data order',()=>{
 const projects=[{id:'other',parent_id:null,position:-1},...nodes,{id:'last',parent_id:null,position:2}];
 assert.equal(projectRoot(projects,'d'),'a');assert.deepEqual(projectVisible(projects,new Set(),'a').map(n=>n.id),['a','b','c','d']);
 assert.deepEqual(projectVisible(projects,new Set(['b']),'a').map(n=>n.id),['a','b']);assert.deepEqual(projectVisible(projects,new Set()).map(n=>n.id),['other','a','b','c','d','last']);
});
