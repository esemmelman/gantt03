import {chromium} from '@playwright/test';
import assert from 'node:assert/strict';
import * as api from '../src/api.js';
import {colorsOn} from '../src/interactions.js';
const browser=await chromium.launch({channel:'msedge',headless:true});
const page=await browser.newPage({viewport:{width:1600,height:1000},timezoneId:'America/Los_Angeles'});
const errors=[];page.on('pageerror',e=>errors.push(e.message));
const cleanup=new Set(),suffix=Date.now();
async function create(title,parent_id=null,position=0){const [n]=await api.create({title:`Drag QA ${title} ${suffix}`,parent_id,position});cleanup.add(n.id);return n;}
const cell=(n,day)=>page.locator(`.cell[data-node-id="${n.id}"][data-day="${day}"]`);
const name=n=>page.locator(`.node[data-id="${n.id}"]`);
async function saved(){await page.waitForFunction(()=>document.querySelector('#status').textContent==='Saved · Supabase');}
async function reload(){await page.reload();await saved();await page.locator('#range-start').fill('2026-10-24');await page.locator('#range-start').dispatchEvent('change');}
async function menu(n,day,label){await cell(n,day).click({button:'right'});assert.deepEqual(await page.locator('#menu button').allTextContents(),['Red','Blue','Green','Clear']);await page.getByRole('menuitem',{name:label,exact:true}).click();await saved();}
async function drag(from,to,shift=false){const a=await from.boundingBox(),b=await to.boundingBox();if(shift)await page.keyboard.down('Shift');await page.mouse.move(a.x+a.width/2,a.y+a.height/2);await page.mouse.down();await page.mouse.move(b.x+b.width/2,b.y+b.height/2,{steps:12});await page.mouse.up();if(shift)await page.keyboard.up('Shift');await saved();assert.equal(await page.locator('#editor').isVisible(),false);}
async function data(n){return (await api.load()).find(x=>x.id===n.id);}
async function nativeDrop(source,target,fraction=.5){const box=await target.boundingBox();await source.dragTo(target,{sourcePosition:{x:110,y:11},targetPosition:{x:120,y:Math.floor(box.height*fraction)}});await saved();}
try{
 const a=await create('A',null,-1000),b=await create('B',null,-999),child=await create('child',a.id),grandchild=await create('grandchild',child.id),fourth=await create('fourth',grandchild.id);
 await page.goto('http://localhost:5173/gantt03/');await saved();await reload();
 await cell(a,'2026-10-24').hover();
 const tooltip=(await page.locator('#day-tooltip').textContent()).split('\n');assert.equal(tooltip[0],a.title);assert.equal(tooltip[1],'Oct. 24 Sat');assert.match(tooltip[2],/^-?\d+$/);
 const offsets=await page.evaluate(()=>{const cells=[...document.querySelectorAll('thead tr:last-child [data-day]')];return cells.slice(0,3).map(c=>Number(c.title.split('\n').at(-1)));});assert.equal(offsets[1]-offsets[0],1);assert.equal(offsets[2]-offsets[1],1);
 assert.equal(await page.locator('#color-drag-mode').inputValue(),'move');
 for(const [day,color,hex] of [['2026-10-24','Red','#ff0000'],['2026-10-25','Blue','#0000ff'],['2026-10-26','Green','#008000']]){await menu(a,day,color);assert.deepEqual(colorsOn(await data(a),day),[hex]);}
 await menu(a,'2026-10-25','Clear');assert.deepEqual(colorsOn(await data(a),'2026-10-25'),[]);assert.deepEqual(colorsOn(await data(a),'2026-10-24'),['#ff0000']);
 // A normal unmodified drag moves the color directly, without a handle or mode change.
 await drag(cell(a,'2026-10-24'),cell(b,'2026-10-29'));
 assert.deepEqual(colorsOn(await data(a),'2026-10-24'),[]);assert.deepEqual(colorsOn(await data(b),'2026-10-29'),['#ff0000']);
 await drag(cell(b,'2026-10-29'),cell(a,'2026-10-24'));
 await page.locator('#color-drag-mode').selectOption('paint');
 // Paint includes intermediate cells, and clearing the middle splits the run.
 await drag(cell(a,'2026-10-24'),cell(a,'2026-10-28'));
 for(const day of ['2026-10-24','2026-10-25','2026-10-26','2026-10-27','2026-10-28'])assert.deepEqual(colorsOn(await data(a),day),['#ff0000']);
 await menu(a,'2026-10-26','Clear');assert.deepEqual(colorsOn(await data(a),'2026-10-26'),[]);assert.deepEqual(colorsOn(await data(a),'2026-10-27'),['#ff0000']);
 // Shift drag moves one cell across rows, preserving neighboring dates.
 await drag(cell(a,'2026-10-24'),cell(b,'2026-10-29'),true);
 assert.deepEqual(colorsOn(await data(a),'2026-10-24'),[]);assert.deepEqual(colorsOn(await data(a),'2026-10-25'),['#ff0000']);assert.deepEqual(colorsOn(await data(b),'2026-10-29'),['#ff0000']);
 // Explicit Move mode works within one row.
 await page.locator('#color-drag-mode').selectOption('move');await drag(cell(b,'2026-10-29'),cell(b,'2026-10-30'));
 assert.deepEqual(colorsOn(await data(b),'2026-10-29'),[]);assert.deepEqual(colorsOn(await data(b),'2026-10-30'),['#ff0000']);
 await page.locator('#color-drag-mode').selectOption('paint');
 // Rectangle painting covers every visible row and every intermediate date.
 await drag(cell(a,'2026-10-25'),cell(child,'2026-10-27'));
 for(const n of [a,child])for(const day of ['2026-10-25','2026-10-26','2026-10-27'])assert.deepEqual(colorsOn(await data(n),day),['#ff0000']);
 // A stale two-row save rolls back all changes, even an earlier valid row.
 const oldA=await data(a),oldB=await data(b),sorted=[oldA,oldB].sort((x,y)=>x.id.localeCompare(y.id));
 const valid=sorted[0],stale=sorted[1];
 await assert.rejects(()=>api.updateColors([{id:valid.id,expected_bars:valid.bars,bars:[]},{id:stale.id,expected_bars:[{invalid:true}],bars:[]}]),/another session/);
 assert.deepEqual((await data(valid)).bars,valid.bars);
 // Native node drag: before, after, nest, then detach to root.
 await nativeDrop(name(b),name(a),.1);assert.ok((await data(b)).position<(await data(a)).position);
 await nativeDrop(name(b),name(a),.9);assert.ok((await data(b)).position>(await data(a)).position);
 await nativeDrop(name(b),name(child));assert.equal((await data(b)).parent_id,child.id);
 await name(b).dragTo(page.locator('#root-drop'));await saved();assert.equal((await data(b)).parent_id,null);
 // Moving a project/task branch keeps its descendants attached.
 await name(child).dragTo(page.locator('#root-drop'));await saved();assert.equal((await data(child)).parent_id,null);assert.equal((await data(grandchild)).parent_id,child.id);assert.equal((await data(fourth)).parent_id,grandchild.id);
 await nativeDrop(name(child),name(a));assert.equal((await data(child)).parent_id,a.id);
 // Illegal drops never mutate the hierarchy.
 await name(a).dragTo(name(grandchild));assert.equal((await data(a)).parent_id,null);
 await name(b).dragTo(name(fourth));assert.equal((await data(b)).parent_id,null);
 await reload();assert.deepEqual(colorsOn(await data(b),'2026-10-30'),['#ff0000']);
 assert.equal(await cell(b,'2026-10-30').evaluate(c=>getComputedStyle(c).backgroundColor),'rgb(255, 0, 0)');
 assert.deepEqual(errors,[]);
 console.log('Passed name/date/offset tooltips; direct color drag and drop; Red/Blue/Green/Clear; paint rectangle; atomic conflict rollback; direct node reorder/nest/root drops; invalid depth/cycle drops; reload persistence.');
}finally{
 for(const id of cleanup)await api.remove(id);
 await browser.close();
}
