import {chromium} from '@playwright/test';
import assert from 'node:assert/strict';
import * as api from '../src/api.js';
import {colorsOn} from '../src/interactions.js';
const browser=await chromium.launch({channel:'msedge',headless:true});
const page=await browser.newPage({viewport:{width:1440,height:1000}}),ids=new Set(),suffix=Date.now(),errors=[];
page.on('pageerror',e=>errors.push(e.message));
const name=n=>page.locator(`.node[data-id="${n.id}"]`),cell=(n,day)=>page.locator(`.cell[data-node-id="${n.id}"][data-day="${day}"]`);
const data=async n=>(await api.load()).find(x=>x.id===n.id);
async function seed(title,parent_id=null,position=-9999){const [n]=await api.create({title:`Undo QA ${title} ${suffix}`,parent_id,position});ids.add(n.id);return n;}
async function saved(){await page.waitForFunction(()=>document.querySelector('#status').textContent==='Saved · Supabase');}
async function undo(){await page.keyboard.press('Escape');await page.waitForFunction(()=>document.querySelector('#status').textContent==='Undone · Supabase');}
async function color(n,day,label){await showAll();await cell(n,day).click({button:'right'});await page.getByRole('menuitem',{name:label,exact:true}).click();await saved();await showAll();}
async function corner(n,day){const c=cell(n,day),r=await c.boundingBox();await page.mouse.move(r.x+20,r.y+5);await page.mouse.move(r.x+r.width-2,r.y+r.height-2);return c.locator('.fill-handle');}
async function drag(from,to){const a=await from.boundingBox(),b=await to.boundingBox();await page.mouse.move(a.x+a.width/2,a.y+a.height/2);await page.mouse.down();await page.mouse.move(b.x+b.width/2,b.y+b.height/2,{steps:10});await page.mouse.up();await saved();assert.equal(await page.locator('.fill-handle:visible').count(),0);}
async function add(action,target,title){await name(target).click({button:'right'});await page.getByRole('menuitem',{name:action,exact:true}).click();await page.getByRole('textbox',{name:'New node name'}).fill(title);await page.getByRole('button',{name:'Save new row',exact:true}).click();await saved();const created=(await api.load()).find(n=>n.title===title);ids.add(created.id);return created;}
async function showAll(){await page.locator('#expand-toggle').click();if(await page.locator('#expand-toggle').textContent()==='Expand All')await page.locator('#expand-toggle').click();}
try{
 const root=await seed('root'),child=await seed('child',root.id),leaf=await seed('leaf',child.id),other=await seed('other',null,-9998);
 await page.goto('http://localhost:5173/gantt03/');await saved();await page.locator('#days').selectOption('30');await page.locator('#range-start').fill('2026-10-24');await page.locator('#range-start').dispatchEvent('change');
 await cell(root,'2026-10-25').hover();assert.equal(await page.locator('.fill-handle:visible').count(),0);
 const dot=await corner(root,'2026-10-25');assert.equal(await dot.isVisible(),true);await page.mouse.down();await page.mouse.up();assert.equal(await page.locator('.fill-handle:visible').count(),0);
 await color(root,'2026-10-25','Red');await undo();assert.deepEqual(colorsOn(await data(root),'2026-10-25'),[]);
 await color(root,'2026-10-25','Yellow');await drag(await corner(root,'2026-10-25'),cell(root,'2026-10-28'));assert.deepEqual(colorsOn(await data(root),'2026-10-27'),['#ffff00']);await undo();assert.deepEqual(colorsOn(await data(root),'2026-10-27'),[]);assert.deepEqual(colorsOn(await data(root),'2026-10-25'),['#ffff00']);
 await drag(cell(root,'2026-10-25'),cell(other,'2026-10-29'));await undo();assert.deepEqual(colorsOn(await data(root),'2026-10-25'),['#ffff00']);assert.deepEqual(colorsOn(await data(other),'2026-10-29'),[]);
 const sibling=await add('Add sibling',child,`Undo QA sibling ${suffix}`);await undo();assert.equal(await data(sibling),undefined);
 const wrapper=await add('Add parent',child,`Undo QA wrapper ${suffix}`);await undo();assert.equal(await data(wrapper),undefined);assert.equal((await data(child)).parent_id,root.id);assert.equal((await data(leaf)).parent_id,child.id);
 await showAll();await name(child).dragTo(name(other));await saved();assert.equal((await data(child)).parent_id,other.id);await undo();assert.equal((await data(child)).parent_id,root.id);
 await name(child).click();await page.locator('[name=title]').fill(`Edited ${suffix}`);await page.getByRole('button',{name:'Save',exact:true}).click();await page.locator('#editor').waitFor({state:'hidden'});await undo();assert.equal((await data(child)).title,child.title);
 await name(root).click({button:'right'});await page.getByRole('menuitem',{name:'Delete',exact:true}).click();await page.locator('#panel-content').getByRole('button',{name:'Delete',exact:true}).click();await page.locator('#panel').waitFor({state:'hidden'});await undo();assert.ok(await data(root));assert.equal((await data(child)).parent_id,root.id);assert.equal((await data(leaf)).parent_id,child.id);
 // Newer edits from another session make undo fail rather than overwrite them.
 await color(other,'2026-10-26','Green');await api.update(other.id,{notes:'Newer external edit'});await page.keyboard.press('Escape');await page.waitForFunction(()=>document.querySelector('#status').textContent.includes('another session'));assert.equal((await data(other)).notes,'Newer external edit');assert.deepEqual(colorsOn(await data(other),'2026-10-26'),['#008000']);
 assert.deepEqual(errors,[]);console.log('Passed corner-only circle, release dismissal, Esc undo of colors/painting/moving/sibling/parent/reorder/edit/deleted subtree, and stale undo rejection.');
}finally{for(const id of ids)await api.remove(id);await browser.close();}
