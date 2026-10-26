import {test} from 'node:test';
import assert from 'node:assert/strict';
import {dayOffset,cellTooltip,paintRange,colorsOn,nodeDrop} from '../src/interactions.js';
const red='#ff0000',blue='#0000ff';
const bar=(start,end,color=red)=>({start_date:start,end_date:end,color});
test('cell tooltips include the row name, requested date format, and signed integer offset',()=>{
 assert.equal(cellTooltip('2026-10-25','Project name','2026-10-25'),'Project name\nOct. 25 Sun\n0');
 assert.equal(cellTooltip('2026-10-24','Task name','2026-10-25'),'Task name\nOct. 24 Sat\n-1');
 assert.equal(cellTooltip('2027-01-01',undefined,'2026-12-31'),'Jan. 1 Fri\n1');
});
test('day offsets use calendar days across DST, leap days and year changes',()=>{
 assert.equal(dayOffset('2026-11-02','2026-10-31'),2);
 assert.equal(dayOffset('2026-03-09','2026-03-07'),2);
 assert.equal(dayOffset('2028-03-01','2028-02-28'),2);
 assert.equal(dayOffset('2026-12-31','2027-01-01'),-1);
 assert.equal(dayOffset('2026-10-25','2026-10-25'),0);
});
test('clearing the middle of a run preserves both neighbors',()=>{
 assert.deepEqual(paintRange([bar('2026-10-24','2026-10-30')],'2026-10-26','2026-10-28',[]),[
  bar('2026-10-24','2026-10-25'),bar('2026-10-29','2026-10-30')
 ]);
});
test('painting replaces only the selected dates and coalesces adjacent equal colors',()=>{
 const result=paintRange([bar('2026-10-24','2026-10-27'),bar('2026-10-29','2026-10-30')],'2026-10-28','2026-10-28',[red]);
 assert.deepEqual(result,[bar('2026-10-24','2026-10-30')]);
 const replaced=paintRange(result,'2026-10-26','2026-10-28',[blue]);
 assert.deepEqual(colorsOn({bars:replaced},'2026-10-25'),[red]);
 assert.deepEqual(colorsOn({bars:replaced},'2026-10-26'),[blue]);
 assert.deepEqual(colorsOn({bars:replaced},'2026-10-29'),[red]);
});
test('moving a striped cell keeps both colors and clears only its source date',()=>{
 const bars=[bar('2026-10-24','2026-10-26'),bar('2026-10-25','2026-10-27',blue)],colors=colorsOn({bars},'2026-10-25');
 const moved=paintRange(paintRange(bars,'2026-10-25','2026-10-25',[]),'2026-11-01','2026-11-01',colors);
 assert.deepEqual(colorsOn({bars:moved},'2026-10-25'),[]);
 assert.deepEqual(colorsOn({bars:moved},'2026-11-01'),[blue,red]);
 assert.deepEqual(colorsOn({bars:moved},'2026-10-26'),[blue,red]);
});
const nodes=[{id:'a',parent_id:null,position:0},{id:'b',parent_id:'a',position:0},{id:'c',parent_id:'b',position:0},{id:'d',parent_id:'c',position:0},{id:'e',parent_id:null,position:1}];
test('node drops prevent cycles and account for the full subtree depth',()=>{
 assert.throws(()=>nodeDrop(nodes,nodes[0],nodes[2],'inside'),/own branch/);
 assert.throws(()=>nodeDrop(nodes,nodes[4],nodes[3],'inside'),/four levels/);
 assert.throws(()=>nodeDrop(nodes,nodes[0],nodes[4],'inside'),/four levels/);
 assert.deepEqual(nodeDrop(nodes,nodes[4],nodes[0],'before'),{parent_id:null,position:-1});
 assert.deepEqual(nodeDrop(nodes,nodes[2],null,'inside'),{parent_id:null,position:2});
});
