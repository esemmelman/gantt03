import {chromium} from '@playwright/test';
import assert from 'node:assert/strict';
import * as api from '../src/api.js';
const browser=await chromium.launch({channel:'msedge',headless:true});
const page=await browser.newPage(),ids=[],errors=[],suffix=Date.now();page.on('pageerror',e=>errors.push(e.message));
const name=n=>page.locator(`.node[data-id="${n.id}"]`),get=n=>api.getNode(n.id);
async function seed(title,parent_id=null){const [n]=await api.create({title:`Archive QA ${title} ${suffix}`,parent_id,position:-999999});ids.push(n.id);return n;}
async function saved(){await page.waitForFunction(()=>document.querySelector('#status').textContent==='Saved · Supabase');}
async function archive(n){await name(n).click({button:'right'});await page.getByRole('menuitem',{name:'Archive',exact:true}).click();await saved();await name(n).waitFor({state:'hidden'});}
async function undo(){await page.keyboard.press('Escape');await page.waitForFunction(()=>document.querySelector('#status').textContent==='Undone · Supabase');}
try{
 const root=await seed('root'),child=await seed('child',root.id),leaf=await seed('leaf',child.id);
 await api.update(child.id,{notes:'Preserve notes',notes_html:'<b>Preserve notes</b>',comments:[{id:crypto.randomUUID(),body:'Preserve comment',created_at:new Date().toISOString()}],bars:[{start_date:'2026-10-28',end_date:'2026-10-29',color:'#ffff00'}]});const before=await get(child);
 await page.goto('http://localhost:5173/gantt03/');await saved();await page.locator('#days').selectOption('30');
 assert.equal(await page.getByRole('button',{name:'Drop node at root',exact:true}).count(),0);assert.equal(await page.locator('#root-drop').count(),0);
 const width=await page.locator('.cell').first().evaluate(n=>n.getBoundingClientRect().width);assert.equal(width,52);
 const cell=page.locator(`.cell[data-node-id="${child.id}"]`).first();await cell.click({button:'right'});assert.deepEqual(await page.locator('#menu button').allTextContents(),['Red','Yellow','Green','Clear']);await page.keyboard.press('Escape');
 await archive(child);assert.equal(await name(leaf).count(),0);assert.equal((await get(child)).archived,true);assert.equal((await get(leaf)).parent_id,child.id);assert.equal((await get(child)).notes_html,before.notes_html);assert.deepEqual((await get(child)).comments,before.comments);
 await page.getByRole('button',{name:'Archive',exact:true}).click();await page.getByRole('button',{name:`Restore ${child.title}`,exact:true}).click();await saved();await page.getByRole('button',{name:'Close',exact:true}).click();assert.equal(await name(child).count(),1);assert.equal(await name(leaf).count(),1);assert.deepEqual((await get(child)).bars,before.bars);
 await undo();assert.equal(await name(child).count(),0);await undo();assert.equal(await name(child).count(),1);
 // Restoring an ancestor must keep a separately archived descendant archived.
 await archive(leaf);await archive(root);assert.equal(await name(child).count(),0);
 await page.reload();await saved();await page.getByRole('button',{name:'Archive',exact:true}).click();assert.equal(await page.getByRole('button',{name:`Restore ${leaf.title}`,exact:true}).count(),0);await page.getByRole('button',{name:`Restore ${root.title}`,exact:true}).click();await saved();assert.equal(await page.getByRole('button',{name:`Restore ${leaf.title}`,exact:true}).count(),1);await page.getByRole('button',{name:`Restore ${leaf.title}`,exact:true}).click();await saved();await page.getByRole('button',{name:'Close',exact:true}).click();assert.equal(await name(leaf).count(),1);
 assert.deepEqual(errors,[]);console.log('Passed Red/Yellow/Green/Clear, 52px dates, root-drop removal, archive/restore with preserved data/hierarchy, independent child archives, reload persistence, and undo.');
}finally{for(const id of ids)await api.remove(id);await browser.close();}
