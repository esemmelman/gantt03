import {chromium} from '@playwright/test';
import assert from 'node:assert/strict';
import * as api from '../src/api.js';
import {level} from '../src/model.js';
const browser=await chromium.launch({channel:'msedge',headless:true});
const page=await browser.newPage(),ids=[],errors=[],suffix=Date.now();page.on('pageerror',e=>errors.push(e.message));
const name=n=>page.locator(`.node[data-id="${n.id}"]`),get=async n=>api.getNode(n.id);
async function seed(title,parent_id=null,position=-999999){const [n]=await api.create({title:`Level QA ${title} ${suffix}`,parent_id,position});ids.push(n.id);return n;}
async function save(){await page.getByRole('button',{name:'Save',exact:true}).click();await page.locator('#editor').waitFor({state:'hidden'});}
async function move(n,depth,parent){await name(n).click();await page.locator('#node-level').selectOption(String(depth));await page.locator('#node-parent').selectOption(parent?.id||'');await save();const all=await api.load();assert.equal(level(all,all.find(x=>x.id===n.id)),depth);assert.equal((await get(n)).parent_id,parent?.id||null);}
try{
 const root=await seed('root'),other=await seed('other',null,-999998),child=await seed('child',root.id),grand=await seed('grandchild',child.id),leaf=await seed('leaf',grand.id);
 await api.update(child.id,{notes:'Retain notes',notes_html:'<b>Retain notes</b>',comments:[{id:crypto.randomUUID(),body:'Retain comment',created_at:new Date().toISOString()}],bars:[{start_date:'2026-11-01',end_date:'2026-11-02',color:'#008000'}]});const before=await get(child);
 await page.goto('http://localhost:5173/gantt03/');await page.getByRole('status').filter({hasText:'Saved'}).waitFor();await page.locator('#days').selectOption('30');
 await name(child).click();assert.equal(await page.locator('#node-level').inputValue(),'2');assert.equal(await page.locator('#node-level option[value="3"]').evaluate(option=>option.disabled),true);assert.equal(await page.locator('#node-level option[value="4"]').evaluate(option=>option.disabled),true);
 const parents=await page.locator('#node-parent option').evaluateAll(options=>options.map(o=>o.value));assert.ok(!parents.includes(child.id));assert.ok(!parents.includes(grand.id));assert.ok(!parents.includes(leaf.id));
 await page.getByRole('button',{name:'Cancel',exact:true}).click();await move(child,1,null);
 assert.equal((await get(grand)).parent_id,child.id);assert.equal((await get(leaf)).parent_id,grand.id);let moved=await get(child);assert.equal(moved.notes_html,before.notes_html);assert.deepEqual(moved.comments,before.comments);assert.deepEqual(moved.bars,before.bars);
 await page.keyboard.press('Escape');await page.waitForFunction(()=>document.querySelector('#status').textContent==='Undone · Supabase');assert.equal((await get(child)).parent_id,root.id);
 await move(leaf,1,null);await move(leaf,2,other);await move(leaf,3,child);await move(leaf,4,grand);
 await page.reload();await page.getByRole('status').filter({hasText:'Saved'}).waitFor();await name(leaf).click();assert.equal(await page.locator('#node-level').inputValue(),'4');assert.equal(await page.locator('#node-parent').inputValue(),grand.id);
 assert.deepEqual(errors,[]);console.log('Passed level 1–4 changes, parent filtering, descendant/cycle exclusion, whole-branch depth limits, preserved notes/comments/colors, undo, and reload persistence.');
}finally{for(const id of ids)await api.remove(id);await browser.close();}
