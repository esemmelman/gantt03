import {chromium} from '@playwright/test';
import assert from 'node:assert/strict';
import * as api from '../src/api.js';
const browser=await chromium.launch({channel:'msedge',headless:true});
const page=await browser.newPage({viewport:{width:1440,height:900}});
const errors=[];page.on('pageerror',e=>errors.push(e.message));
let root;
const suffix=Date.now();
try{
 await page.goto('http://localhost:5173/gantt03/');
 await page.getByRole('status').filter({hasText:'Saved'}).waitFor();
 assert.equal(await page.locator('tbody tr').count(),20);
 await page.locator('.node[data-id]').filter({hasText:'Brotherhood'}).click({button:'right'});
 assert.deepEqual(await page.locator('#menu button').allTextContents(),['Add parent','Add child','Edit','Delete']);
 await page.keyboard.press('Escape');
 await page.getByRole('button',{name:'Add root',exact:true}).click();
 await page.locator('[name=title]').fill(`QA ${suffix}`);
 await page.getByRole('button',{name:'Save',exact:true}).click();
 await page.locator('#editor').waitFor({state:'hidden'});
 root=(await api.load()).find(n=>n.title===`QA ${suffix}`);
 assert.ok(root);
 let target=root;
 for(let depth=2;depth<=4;depth++){
  await page.locator(`.node[data-id="${target.id}"]`).click({button:'right'});
  await page.getByRole('menuitem',{name:'Add child',exact:true}).click();
  await page.locator('[name=title]').fill(`QA level ${depth} ${suffix}`);
  await page.getByRole('button',{name:'Save',exact:true}).click();
  await page.locator('#editor').waitFor({state:'hidden'});
  target=(await api.load()).find(n=>n.title===`QA level ${depth} ${suffix}`);
 }
 await page.locator(`.node[data-id="${target.id}"]`).click({button:'right'});
 assert.deepEqual(await page.locator('#menu button').allTextContents(),['Edit','Delete']);
 await page.getByRole('menuitem',{name:'Edit',exact:true}).click();
 await page.locator('[name=start_date]').fill('2026-10-27');
 await page.locator('[name=end_date]').fill('2026-10-29');
 await page.locator('[name=notes]').fill('Persistence check');
 await page.getByRole('button',{name:'Save',exact:true}).click();
 await page.locator('#editor').waitFor({state:'hidden'});
 await page.reload();await page.getByRole('status').filter({hasText:'Saved'}).waitFor();
 const saved=(await api.load()).find(n=>n.id===target.id);assert.equal(saved.notes,'Persistence check');assert.equal(saved.end_date,'2026-10-29');
 await assert.rejects(()=>api.create({parent_id:target.id,title:'Illegal fifth level'}),/four levels/);
 await assert.rejects(()=>api.addParent(root.id,'Illegal wrapper'),/four levels/);
 assert.equal((await api.load()).filter(n=>n.title==='Illegal wrapper').length,0);
 await api.remove(target.id);
 const third=(await api.load()).find(n=>n.title===`QA level 3 ${suffix}`);
 await api.addParent(third.id,`QA wrapper ${suffix}`);
 const wrapper=(await api.load()).find(n=>n.title===`QA wrapper ${suffix}`);
 assert.equal((await api.load()).find(n=>n.id===third.id).parent_id,wrapper.id);
 await assert.rejects(()=>api.update(root.id,{parent_id:third.id}),/ancestor/);
 await page.getByRole('button',{name:'Collapse All',exact:true}).click();
 assert.equal(await page.locator('tbody tr').count(),4);
 await page.getByRole('button',{name:'Expand All',exact:true}).click();
 assert.ok(await page.locator('tbody tr').count()>4);
 assert.deepEqual(errors,[]);
 console.log('Browser and live Supabase checks passed: menu, four levels, CRUD, dates, persistence, atomic wrapping, cycle rejection, collapse.');
}finally{
 if(root)await api.remove(root.id);
 await page.goto('http://localhost:5173/gantt03/');await page.getByRole('status').filter({hasText:'Saved'}).waitFor();
 await page.screenshot({path:'preview.png',fullPage:true});
 await browser.close();
}

