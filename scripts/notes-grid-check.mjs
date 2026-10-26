import {chromium} from '@playwright/test';
import assert from 'node:assert/strict';
import * as api from '../src/api.js';
const browser=await chromium.launch({channel:'msedge',headless:true});
const page=await browser.newPage({viewport:{width:1440,height:1000}}),errors=[];
page.on('pageerror',e=>errors.push(e.message));let node;
async function openNotes(){await page.locator(`.node[data-id="${node.id}"]`).click({button:'right'});await page.getByRole('menuitem',{name:'Notes',exact:true}).click();await page.waitForFunction(()=>document.querySelector('#notes-status').textContent==='Changes save automatically');}
try{
 [node]=await api.create({title:`Grid QA ${Date.now()}`,parent_id:null,position:-999999,notes:'Keep these notes'});
 await page.goto('http://localhost:5173/gantt03/');await page.getByRole('status').filter({hasText:'Saved'}).waitFor();await openNotes();
 await page.getByRole('button',{name:'Insert 20 × 8 grid',exact:true}).click();
 assert.equal(await page.locator('#rich-notes table tr').count(),20);assert.equal(await page.locator('#rich-notes table td').count(),160);
 assert.ok((await page.locator('#rich-notes').textContent()).includes('Keep these notes'));
 const first=page.locator('#rich-notes td[aria-label=A1]'),second=page.locator('#rich-notes td[aria-label=B1]'),last=page.locator('#rich-notes td[aria-label=H20]');
 await first.fill('First cell');await page.keyboard.press('Tab');await page.keyboard.type('Second cell');assert.equal(await second.textContent(),'Second cell');
 await last.fill('Last cell');await page.locator('#notes-close').click();await page.locator('#notes-dialog').waitFor({state:'hidden'});
 let saved=await api.getNode(node.id);assert.match(saved.notes_html,/First cell/);assert.match(saved.notes_html,/Last cell/);assert.match(saved.notes_html,/<table/);
 await page.reload();await page.getByRole('status').filter({hasText:'Saved'}).waitFor();await openNotes();
 assert.equal(await page.locator('#rich-notes table tr').count(),20);assert.equal(await page.locator('#rich-notes table tr').first().locator('td').count(),8);assert.equal(await page.locator('#rich-notes td[aria-label=H20]').textContent(),'Last cell');
 await page.locator('#rich-notes td[aria-label=H20]').fill('Updated last cell');await page.waitForFunction(()=>document.querySelector('#notes-status').textContent==='Saved automatically');saved=await api.getNode(node.id);assert.match(saved.notes_html,/Updated last cell/);
 await page.screenshot({path:process.env.TEMP+'/gantt03-notes-grid.png'});
 await page.locator('#notes-close').click();await page.keyboard.press('Escape');await page.waitForFunction(()=>document.querySelector('#status').textContent==='Undone · Supabase');assert.match((await api.getNode(node.id)).notes_html,/>Last cell</);
 assert.deepEqual(errors,[]);console.log('Passed 20×8 editable Notes grid, preservation of text, Tab navigation, autosave/close flush, reload persistence, and undo.');
}finally{if(node)await api.remove(node.id);await browser.close();}
