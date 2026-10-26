import {chromium} from '@playwright/test';
import assert from 'node:assert/strict';
import * as api from '../src/api.js';
const browser=await chromium.launch({channel:'msedge',headless:true});
const page=await browser.newPage(),errors=[];let node;page.on('pageerror',e=>errors.push(e.message));
async function open(){await page.locator(`.node[data-id="${node.id}"]`).click({button:'right'});await page.getByRole('menuitem',{name:'Notes',exact:true}).click();await page.waitForFunction(()=>document.querySelector('#notes-status').textContent==='Changes save automatically');}
async function save(){await page.waitForFunction(()=>document.querySelector('#notes-status').textContent==='Saved automatically');}
try{
 [node]=await api.create({title:`Alignment QA ${Date.now()}`,parent_id:null,position:-999999,notes:'Alignment text',notes_html:'<p>Alignment text</p>'});
 await page.goto('http://localhost:5173/gantt03/');await page.getByRole('status').filter({hasText:'Saved'}).waitFor();await open();
 assert.equal(await page.locator('#notes-align').count(),1);await page.locator('#rich-notes').press('ControlOrMeta+A');
 for(const alignment of ['center','right','left']){
  await page.locator('#notes-align').click();await save();assert.equal((await page.locator('#notes-align').textContent()).toLowerCase(),`align: ${alignment}`);
  assert.equal(await page.locator('#rich-notes').evaluate(n=>getComputedStyle(n.firstElementChild).textAlign),alignment);
  const saved=await api.getNode(node.id);if(alignment!=='left')assert.match(saved.notes_html,new RegExp(`text-align: ${alignment}|align="${alignment}"`));
 }
 await page.locator('#notes-align').click();await save();await page.locator('#notes-close').click();await page.reload();await page.getByRole('status').filter({hasText:'Saved'}).waitFor();await open();
 assert.equal(await page.locator('#rich-notes').evaluate(n=>getComputedStyle(n.firstElementChild).textAlign),'center');
 // Keep only safe alignment when loading styled HTML.
 await page.locator('#notes-close').click();await api.update(node.id,{notes_html:'<p style="text-align:right;color:red;background-image:url(https://invalid.example/image)">Safe alignment</p>'});await open();
 assert.equal(await page.locator('#rich-notes p').getAttribute('style'),'text-align: right;');await page.locator('#notes-close').click();
 await open();await page.locator('#notes-add-grid').click();
 await page.locator('#rich-notes td[aria-label=B1]').fill('Column B top');await page.locator('#rich-notes td[aria-label=B20]').fill('Column B bottom');await page.locator('#rich-notes td[aria-label=B2]').click();
 await page.locator('#notes-align').click();await save();assert.equal(await page.locator('#notes-align').textContent(),'Align B: Center');
 const columnStyles=async index=>page.locator('#rich-notes table').evaluate((table,col)=>[...table.rows].map(row=>getComputedStyle(row.cells[col]).textAlign),index);
 assert.deepEqual(await columnStyles(1),Array(20).fill('center'));assert.deepEqual(await columnStyles(0),Array(20).fill('left'));
 await page.locator('#rich-notes td[aria-label=C1]').click();for(let i=0;i<2;i++){await page.locator('#notes-align').click();await save();}
 assert.deepEqual(await columnStyles(2),Array(20).fill('right'));assert.deepEqual(await columnStyles(1),Array(20).fill('center'));assert.deepEqual(await columnStyles(3),Array(20).fill('left'));
 await page.locator('#notes-close').click();await page.reload();await page.getByRole('status').filter({hasText:'Saved'}).waitFor();await open();
 assert.deepEqual(await columnStyles(1),Array(20).fill('center'));assert.deepEqual(await columnStyles(2),Array(20).fill('right'));assert.equal(await page.locator('#rich-notes td[aria-label=B20]').textContent(),'Column B bottom');
 assert.deepEqual(errors,[]);console.log('Passed single alignment button for paragraphs and individual grid columns, unaffected adjacent columns, autosave/reload persistence, and safe alignment-only styles.');
}finally{if(node)await api.remove(node.id);await browser.close();}
