import {test} from 'node:test';
import assert from 'node:assert/strict';
import {actionDiff} from '../src/history.js';
test('undo captures deleted descendants but excludes unrelated shared edits',()=>{
 const before={nodes:[{id:'a',parent_id:null},{id:'b',parent_id:'a'},{id:'c',parent_id:null,title:'old'}],links:''};
 const after={nodes:[{id:'c',parent_id:null,title:'new from another session'}],links:'external link'};
 const action=actionDiff(before,after,{ids:['a'],deleted:['a'],settings:false});
 assert.deepEqual(action.changes.map(c=>c.id),['a','b']);assert.equal(action.settings_before,null);
});
test('nested color changes are captured independent of object key order',()=>{
 const before={nodes:[{id:'a',bars:[{color:'#ff0000',start_date:'2026-10-25'}]}],links:''};
 const same={nodes:[{bars:[{start_date:'2026-10-25',color:'#ff0000'}],id:'a'}],links:''};
 assert.equal(actionDiff(before,same).changes.length,0);
 assert.equal(actionDiff(before,{...same,nodes:[{id:'a',bars:[]}]}).changes.length,1);
});
