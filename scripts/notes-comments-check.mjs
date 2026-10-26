import {chromium} from '@playwright/test';
import assert from 'node:assert/strict';
import * as api from '../src/api.js';
const browser=await chromium.launch({channel:'msedge',headless:true});
const page=await browser.newPage({viewport:{width:1440,height:1000}}),ids=[],errors=[],suffix=Date.now();
page.on('pageerror',e=>errors.push(e.message));
const name=n=>page.locator(`.node[data-id="${n.id}"]`);
const node=async n=>api.getNode(n.id);
async function menu(n,action){await name(n).click({button:'right'});assert.ok((await page.locator('#menu button').allTextContents()).includes('Notes'));assert.ok((await page.locator('#menu button').allTextContents()).includes('Comments'));await page.getByRole('menuitem',{name:action,exact:true}).click();}
async function notesReady(){await page.waitForFunction(()=>document.querySelector('#rich-notes').contentEditable==='true'&&document.querySelector('#notes-status').textContent!=='Loading…');}
async function autosaved(){await page.waitForFunction(()=>document.querySelector('#notes-status').textContent==='Saved automatically');}
async function undo(){await page.keyboard.press('Escape');await page.waitForFunction(()=>document.querySelector('#status').textContent==='Undone · Supabase');}
try{
 let parent=null;for(let level=1;level<=4;level++){const [n]=await api.create({title:`Notes QA level ${level} ${suffix}`,parent_id:parent,position:-99999});ids.push(n.id);parent=n.id;}
 const root=await api.getNode(ids[0]),leaf=await api.getNode(ids[3]);await api.update(root.id,{notes:'Existing plain notes'});
 await page.goto('http://localhost:5173/gantt03/');await page.getByRole('status').filter({hasText:'Saved'}).waitFor();await page.locator('#days').selectOption('30');
 assert.equal(await page.locator('.node-detail').count(),0);assert.equal(await page.locator('button').filter({hasText:'▤'}).count(),0);
 await name(root).click();assert.equal(await page.locator('#editor').isVisible(),true);assert.equal(await page.locator('#form [name=title]').inputValue(),root.title);await page.getByRole('button',{name:'Cancel',exact:true}).click();
 await menu(root,'Notes');await notesReady();assert.equal(await page.locator('#rich-notes').textContent(),'Existing plain notes');
 await page.locator('#rich-notes').fill('Formatted note');await page.locator('#rich-notes').press('ControlOrMeta+A');await page.locator('#notes-toolbar').getByRole('button',{name:'Bold',exact:true}).click();await autosaved();assert.match((await node(root)).notes_html,/<(b|strong)>Formatted note<\/(b|strong)>/);
 await page.getByRole('button',{name:'Close',exact:true}).filter({visible:true}).click();
 await menu(root,'Notes');await notesReady();assert.equal(await page.locator('#rich-notes b,#rich-notes strong').textContent(),'Formatted note');
 // Close immediately after typing: the latest edit must be flushed automatically.
 await page.locator('#rich-notes').fill('Last keystrokes before closing');await page.locator('#notes-close').click();await page.locator('#notes-dialog').waitFor({state:'hidden'});assert.equal((await node(root)).notes,'Last keystrokes before closing');
 await undo();assert.match((await node(root)).notes_html,/Formatted note/);
 // Unsafe HTML is sanitized before display; legacy plain text remains supported.
 await api.update(root.id,{notes_html:'<b>Safe text</b><img src=x onerror="window.BAD=1"><script>window.BAD=2</script>'});
 await menu(root,'Notes');await notesReady();assert.equal(await page.locator('#rich-notes img,#rich-notes script').count(),0);assert.equal(await page.evaluate(()=>window.BAD),undefined);await page.locator('#notes-close').click();
 await menu(leaf,'Comments');await page.locator('#comment-add').waitFor({state:'visible'});await page.waitForFunction(()=>!document.querySelector('#comment-add').disabled);
 for(const body of ['First comment','Second comment']){await page.locator('#comment-body').fill(body);await page.locator('#comment-add').click();await page.waitForFunction(()=>!document.querySelector('#comment-add').disabled);}
 assert.equal(await page.locator('.comment-entry').count(),2);const saved=(await node(leaf)).comments;assert.equal(saved.length,2);assert.ok(saved.every(c=>Number.isFinite(Date.parse(c.created_at))));assert.notEqual(saved[0].id,saved[1].id);
 await page.locator('#comments-close').click();await undo();assert.equal((await node(leaf)).comments.length,1);
 const first=crypto.randomUUID(),second=crypto.randomUUID();await Promise.all([api.addComment(leaf.id,first,'Concurrent one'),api.addComment(leaf.id,second,'Concurrent two')]);await api.addComment(leaf.id,first,'Concurrent one');assert.equal((await node(leaf)).comments.length,3);
 await page.reload();await page.getByRole('status').filter({hasText:'Saved'}).waitFor();await page.locator('#days').selectOption('30');await menu(leaf,'Comments');await page.waitForFunction(()=>!document.querySelector('#comment-add').disabled);assert.equal(await page.locator('.comment-entry').count(),3);assert.equal(await page.locator('.comment-entry time[datetime]').count(),3);await page.locator('#comments-close').click();
 // Delete/undo also restores rich notes and the entire comment history.
 await menu(root,'Delete');await page.locator('#panel-content').getByRole('button',{name:'Delete',exact:true}).click();await page.locator('#panel').waitFor({state:'hidden'});await undo();assert.equal((await node(leaf)).comments.length,3);assert.match((await node(root)).notes_html,/Safe text/);
 assert.deepEqual(errors,[]);console.log('Passed click-to-edit/no icons; all-level Notes/Comments menus; rich formatting autosave/reload/close flush; safe rendering; timestamped append and concurrent/idempotent comments; undo notes/comments/deleted subtree.');
}finally{for(const id of ids)await api.remove(id);await browser.close();}
