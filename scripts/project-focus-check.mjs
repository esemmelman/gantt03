import {chromium} from '@playwright/test';
import assert from 'node:assert/strict';
const browser=await chromium.launch({channel:'msedge',headless:true});
const page=await browser.newPage({viewport:{width:1200,height:900}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
const base={text_color:'#000000',color:'#ff0000',notes:'',notes_html:'',comments:[],links:'',archived:false,start_date:null,end_date:null};
const ids=Array.from({length:6},(_,i)=>`00000000-0000-4000-8000-00000000000${i+1}`);
const nodes=[
 {...base,id:ids[0],parent_id:null,title:'Project A',position:0,bars:[]},
 {...base,id:ids[1],parent_id:ids[0],title:'Task A',position:0,bars:[]},
 {...base,id:ids[2],parent_id:null,title:'Project B',position:1,bars:[]},
 {...base,id:ids[3],parent_id:ids[2],title:'Task B',position:0,bars:[{start_date:'2026-11-01',end_date:'2026-11-01',color:'#ffff00'}]},
 {...base,id:ids[4],parent_id:ids[3],title:'Subtask B',position:0,bars:[]},
 {...base,id:ids[5],parent_id:null,title:'Project C',position:2,bars:[]}
];
const row=index=>page.locator(`.node[data-id="${ids[index]}"]`);
async function focused(){await row(0).waitFor({state:'hidden'});assert.deepEqual(await page.locator('.node[data-id]').evaluateAll(rows=>rows.map(n=>n.dataset.id)),ids.slice(2,5));assert.equal(await page.locator('#chart').evaluate(n=>n.scrollTop),0);}
async function restore(){await page.locator('#expand-toggle').click();if(await page.locator('#expand-toggle').textContent()==='Expand All')await page.locator('#expand-toggle').click();assert.equal(await page.locator('.node[data-id]').count(),6);}
try{
 await page.clock.setFixedTime(new Date('2026-10-26T19:00:00Z'));await page.route('**/rest/v1/gantt03_nodes?*',route=>route.fulfill({json:nodes}));
 await page.goto('http://localhost:5173/gantt03/');await page.getByRole('status').filter({hasText:'Saved'}).waitFor();
 assert.equal(await page.locator('#range-start').inputValue(),'2026-10-26');
 const firstVisible=await page.locator('#chart').evaluate(chart=>{const left=chart.getBoundingClientRect().left+chart.querySelector('.node').getBoundingClientRect().width;return [...chart.querySelectorAll('thead tr:last-child [data-day]')].find(n=>n.getBoundingClientRect().right>left+2)?.dataset.day;});assert.equal(firstVisible,'2026-10-26');
 const source=await page.locator(`.cell[data-node-id="${ids[3]}"][data-day="2026-11-01"]`).boundingBox();await page.mouse.move(source.x+20,source.y+10);await page.mouse.down();await page.mouse.move(source.x+72,source.y+10,{steps:8});assert.equal(await page.locator('.node[data-id]').count(),6);await page.keyboard.press('Escape');await page.mouse.up();
 await row(4).locator('.node-label').hover();await page.waitForTimeout(300);assert.equal(await page.locator('.node[data-id]').count(),6);
 await row(4).click();assert.equal(await page.locator('.node[data-id]').count(),6);assert.equal(await page.locator('#editor').isVisible(),true);await page.getByRole('button',{name:'Cancel',exact:true}).click();
 await page.locator(`.cell[data-node-id="${ids[3]}"][data-day="2026-10-26"]`).click();assert.equal(await page.locator('.node[data-id]').count(),6);assert.equal(await page.locator('#editor').isVisible(),false);
 await row(3).locator('.node-offset').click();assert.equal(await page.locator('.node[data-id]').count(),6);assert.equal(await page.locator('.cell-selected').getAttribute('data-day'),'2026-11-01');
 await row(4).click({button:'right'});assert.equal(await page.locator('.node[data-id]').count(),6);assert.ok((await page.locator('#menu button').allTextContents()).includes('Notes'));await page.keyboard.press('Escape');
 await row(2).locator('.node-label').hover();await focused();assert.equal(await page.locator('#editor').isVisible(),false);await restore();
 // Task clicks and double-click editing work within a project focused by its name hover.
 await row(2).locator('.node-label').hover();await focused();await page.locator(`.cell[data-node-id="${ids[3]}"][data-day="2026-10-26"]`).dblclick();assert.equal(await page.locator('#editor').isVisible(),true);assert.equal(await page.locator('[name=title]').inputValue(),'Task B');await page.getByRole('button',{name:'Cancel',exact:true}).click();await restore();
 // Hovering the blank part of the project cell or its collapse button does not focus.
 await row(2).hover({position:{x:280,y:10}});await page.waitForTimeout(300);assert.equal(await page.locator('.node[data-id]').count(),6);
 await row(2).getByRole('button',{name:'Collapse Project B',exact:true}).click();assert.equal(await row(0).count(),1);await page.locator('#expand-toggle').click();assert.equal(await page.locator('.node[data-id]').count(),6);
 await page.reload();await page.getByRole('status').filter({hasText:'Saved'}).waitFor();assert.equal(await page.locator('.node[data-id]').count(),6);assert.equal(await page.locator('#range-start').inputValue(),'2026-10-26');assert.deepEqual(errors,[]);
 console.log('Passed today startup, project-name-only hover focus, task/cell/click/context actions without focus, top positioning, Collapse/Expand restoration, editing, and reload reset.');
}finally{await browser.close();}
