import {chromium} from '@playwright/test';
import assert from 'node:assert/strict';
const browser=await chromium.launch({channel:'msedge',headless:true});
const page=await browser.newPage({viewport:{width:1200,height:900}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
async function showAll(){await page.locator('#expand-toggle').click();if(await page.locator('#expand-toggle').textContent()==='Expand All')await page.locator('#expand-toggle').click();}
try{
 await page.clock.setFixedTime(new Date('2026-10-26T19:00:00Z'));
 const base={parent_id:null,text_color:'#000000',color:'#ff0000',notes:'',links:'',archived:false};
 const dates=['2026-10-29','2026-10-26','2026-03-01','2028-01-05'];
 const nodes=dates.map((day,i)=>({...base,id:`00000000-0000-4000-8000-00000000000${i+1}`,title:`Jump task ${i+1}`,position:i,bars:[{start_date:day,end_date:day,color:'#ff0000'}]}));
 await page.route('**/rest/v1/gantt03_nodes?*',route=>route.fulfill({json:nodes}));
 await page.goto('http://localhost:5173/gantt03/');await page.getByRole('status').filter({hasText:'Saved'}).waitFor();
 for(let i=0;i<nodes.length;i++){
  await showAll();await page.locator('#today').click();await page.locator(`.node[data-id="${nodes[i].id}"] .node-offset`).click();
  assert.equal(await page.locator('#editor').isVisible(),false);const target=page.locator(`.cell[data-node-id="${nodes[i].id}"][data-day="${dates[i]}"]`);
  assert.equal(await target.evaluate(n=>n.classList.contains('bar')&&n.classList.contains('cell-selected')),true);
  const grid=await page.locator('#chart').boundingBox(),label=await page.locator('.node').first().evaluate(n=>n.getBoundingClientRect().width),r=await target.boundingBox();assert.ok(r.x>=grid.x+label-1);assert.ok(r.x+r.width<=grid.x+grid.width+1);
 }
 await showAll();await page.locator('#days').selectOption('30');await page.locator('#today').click();await page.locator(`.node[data-id="${nodes[3].id}"] .node-offset`).focus();await page.keyboard.press('Enter');assert.equal(await page.locator('.cell-selected').getAttribute('data-day'),dates[3]);assert.equal(await page.locator('#editor').isVisible(),false);
 await showAll();await page.locator(`.node[data-id="${nodes[0].id}"]`).click();assert.equal(await page.locator('#editor').isVisible(),true);assert.deepEqual(errors,[]);
 console.log('Passed integer-click jumps for future, zero-day, past, out-of-range dates, keyboard activation, selected colored-cell visibility, and unchanged node click-to-edit.');
}finally{await browser.close();}
