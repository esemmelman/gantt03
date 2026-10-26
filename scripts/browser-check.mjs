import {chromium} from '@playwright/test';
import assert from 'node:assert/strict';
import * as api from '../src/api.js';
const browser=await chromium.launch({channel:'msedge',headless:true});
const page=await browser.newPage({viewport:{width:1440,height:900}});
const errors=[];page.on('pageerror',e=>errors.push(e.message));
let root;
const siblingIds=[];
const suffix=Date.now();
try{
 await page.goto('http://localhost:5173/gantt03/');
 await page.getByRole('status').filter({hasText:'Saved'}).waitFor();
 const initialRootCount=(await api.load()).filter(n=>!n.parent_id).length;
 assert.equal(await page.locator('#expand-toggle').count(),1);
 await page.locator('.node[data-id]').filter({hasText:'Brotherhood'}).click({button:'right'});
 assert.deepEqual(await page.locator('#menu button').allTextContents(),['Add parent','Add child','Sibling','Edit','Notes','Comments','Delete']);
 await page.keyboard.press('Escape');
 await page.getByRole('button',{name:'Add root',exact:true}).click();
 await page.getByRole('textbox',{name:'New node name'}).fill(`QA ${suffix}`);
 await page.getByRole('textbox',{name:'New node name'}).press('Enter');
 await page.locator('.draft-row').waitFor({state:'hidden'});
 root=(await api.load()).find(n=>n.title===`QA ${suffix}`);
 assert.ok(root);
 let target=root;
 for(let depth=2;depth<=4;depth++){
  await page.locator(`.node[data-id="${target.id}"]`).click({button:'right'});
  await page.getByRole('menuitem',{name:'Add child',exact:true}).click();
  assert.equal(await page.locator('#editor').isVisible(),false);
  await page.getByRole('textbox',{name:'New node name'}).fill(`QA level ${depth} ${suffix}`);
  await page.getByRole('button',{name:'Save new row',exact:true}).click();
  await page.locator('.draft-row').waitFor({state:'hidden'});
  target=(await api.load()).find(n=>n.title===`QA level ${depth} ${suffix}`);
 }
 // Siblings insert after the selected branch at the same level, even at level four.
 const second=(await api.load()).find(n=>n.title===`QA level 2 ${suffix}`);
 for(const anchor of [target,second,root]){
  await page.locator(`.node[data-id="${anchor.id}"]`).click({button:'right'});
  await page.getByRole('menuitem',{name:'Sibling',exact:true}).click();
  assert.equal(await page.locator('.draft-row').evaluate(row=>row.previousElementSibling.querySelector('.node').dataset.id),target.id);
  const title=`QA sibling ${anchor.id} ${suffix}`;
  await page.getByRole('textbox',{name:'New node name'}).fill(title);
  await page.getByRole('button',{name:'Save new row',exact:true}).click();await page.locator('.draft-row').waitFor({state:'hidden'});
  const all=await api.load(),sibling=all.find(n=>n.title===title);siblingIds.push(sibling.id);
  assert.equal(sibling.parent_id,anchor.parent_id);
  const sameLevel=all.filter(n=>n.parent_id===anchor.parent_id).sort((a,b)=>a.position-b.position);
  assert.equal(sameLevel[sameLevel.findIndex(n=>n.id===anchor.id)+1].id,sibling.id);
  await page.reload();await page.getByRole('status').filter({hasText:'Saved'}).waitFor();assert.equal(await page.locator(`.node[data-id="${sibling.id}"]`).count(),1);
  await api.remove(sibling.id);await page.getByRole('button',{name:'Refresh',exact:true}).click();await page.locator(`.node[data-id="${sibling.id}"]`).waitFor({state:'hidden'});
 }
 await page.locator('.cell').first().hover();
 assert.equal(await page.locator('#day-tooltip').evaluate(n=>getComputedStyle(n).backgroundColor),'rgb(255, 255, 255)');
 await page.locator(`.node[data-id="${target.id}"]`).click({button:'right'});
 assert.deepEqual(await page.locator('#menu button').allTextContents(),['Sibling','Edit','Notes','Comments','Delete']);
 await page.getByRole('menuitem',{name:'Edit',exact:true}).click();
 for(const bar of [
  {start_date:'2026-10-27',end_date:'2026-10-29',color:'#ff0000'},
  {start_date:'2026-10-28',end_date:'2026-10-30',color:'#0000ff'}
 ]){
  await page.getByRole('button',{name:'Add color range'}).click();
  const row=page.locator('.bar-range').last();
  for(const [key,value] of Object.entries(bar))await row.locator(`[data-field=${key}]`).fill(value);
 }
 await page.getByRole('button',{name:'Save',exact:true}).click();
 await page.locator('#editor').waitFor({state:'hidden'});
 await page.reload();await page.getByRole('status').filter({hasText:'Saved'}).waitFor();
 const saved=(await api.load()).find(n=>n.id===target.id);assert.equal(saved.bars.length,2);
 await page.locator('#range-start').fill('2026-10-24');await page.locator('#range-start').dispatchEvent('change');
 const coloredRow=page.locator(`.node[data-id="${target.id}"]`).locator('..');
 const overlap=coloredRow.locator('.cell').nth(4);
 assert.match(await overlap.evaluate(n=>n.style.getPropertyValue('--bar')),/linear-gradient/);
 assert.match(await overlap.evaluate(n=>getComputedStyle(n).backgroundImage),/255, 0, 0/);
 assert.match(await overlap.evaluate(n=>getComputedStyle(n).backgroundImage),/0, 0, 255/);
 // Clicking an unscheduled day appends a range without erasing prior colors.
 await coloredRow.locator('.cell').nth(8).dblclick();
 assert.equal(await page.locator('.bar-range').count(),3);
 await page.getByRole('button',{name:'Save',exact:true}).click();await page.locator('#editor').waitFor({state:'hidden'});
 await assert.rejects(()=>api.create({parent_id:target.id,title:'Illegal fifth level'}),/four levels/);
 await assert.rejects(()=>api.addParent(root.id,'Illegal wrapper'),/four levels/);
 assert.equal((await api.load()).filter(n=>n.title==='Illegal wrapper').length,0);
 await api.remove(target.id);
 const third=(await api.load()).find(n=>n.title===`QA level 3 ${suffix}`);
 await page.getByRole('button',{name:'Refresh',exact:true}).click();await page.locator(`.node[data-id="${target.id}"]`).waitFor({state:'hidden'});
 await page.locator(`.node[data-id="${third.id}"]`).click({button:'right'});
 await page.getByRole('menuitem',{name:'Add parent',exact:true}).click();
 await page.getByRole('textbox',{name:'New node name'}).fill(`QA wrapper ${suffix}`);
 await page.getByRole('button',{name:'Save new row',exact:true}).click();await page.locator('.draft-row').waitFor({state:'hidden'});await page.locator('.node[data-id]').filter({hasText:`QA wrapper ${suffix}`}).click();
 await page.locator('#editor').waitFor({state:'visible'});await page.getByRole('button',{name:'Cancel',exact:true}).click();
 const wrapper=(await api.load()).find(n=>n.title===`QA wrapper ${suffix}`);
 assert.equal((await api.load()).find(n=>n.id===third.id).parent_id,wrapper.id);
 await assert.rejects(()=>api.update(root.id,{parent_id:third.id}),/ancestor/);
 await page.getByRole('button',{name:'Collapse All',exact:true}).click();
 assert.equal(await page.locator('tbody tr').count(),initialRootCount+1);
 await page.getByRole('button',{name:'Expand All',exact:true}).click();
 assert.ok(await page.locator('tbody tr').count()>initialRootCount+1);
 assert.equal(await page.locator('#expand-toggle').textContent(),'Collapse All');
 // A canceled inline draft does not leave a database row behind.
 await page.getByRole('button',{name:'Add root',exact:true}).click();
 await page.getByRole('textbox',{name:'New node name'}).fill('Canceled draft');
 await page.getByRole('button',{name:'Cancel new row'}).click();
 assert.equal((await api.load()).filter(n=>n.title==='Canceled draft').length,0);
 assert.deepEqual(errors,[]);
 console.log('Browser and live Supabase checks passed: inline child/parent rows, detail symbols, multiple/overlapping colors, persistence, atomic wrapping, four-level limits, cycle rejection, toggle, cancel.');
}finally{
 for(const id of siblingIds)await api.remove(id);
 if(root)await api.remove(root.id);
 await page.goto('http://localhost:5173/gantt03/');await page.getByRole('status').filter({hasText:'Saved'}).waitFor();
 await page.screenshot({path:'preview.png',fullPage:true});
 await browser.close();
}

