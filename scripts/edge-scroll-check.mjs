import {chromium} from '@playwright/test';
import assert from 'node:assert/strict';
const browser=await chromium.launch({channel:'msedge',headless:true});
const page=await browser.newPage({viewport:{width:1200,height:900}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
const offset=()=>page.locator('#chart').evaluate(n=>n.scrollLeft);
try{
 await page.goto('http://localhost:5173/gantt03/');await page.getByRole('status').filter({hasText:'Saved'}).waitFor();
 await page.locator('#chart').evaluate(n=>{n.scrollLeft=0;});
 const bounds=await page.locator('#chart').boundingBox(),labelWidth=await page.locator('.node').first().evaluate(n=>n.getBoundingClientRect().width),y=bounds.y+50,left=bounds.x+labelWidth;
 await page.mouse.move(1199,y);await page.waitForFunction(()=>document.querySelector('#chart').scrollLeft>200);const advanced=await offset();assert.ok(advanced>200);
 await page.mouse.move((left+bounds.x+bounds.width)/2,y);await page.waitForTimeout(100);const stopped=await offset();await page.waitForTimeout(400);assert.equal(await offset(),stopped);
 await page.mouse.move(left+3,y);await page.waitForFunction(()=>document.querySelector('#chart').scrollLeft===0);
 // Navigation controls and open dialogs must not trigger hover scrolling.
 await page.mouse.move(1199,15);await page.waitForTimeout(500);assert.equal(await offset(),0);
 await page.locator('.node[data-id]').first().click();await page.mouse.move(1199,y);await page.waitForTimeout(500);assert.equal(await offset(),0);await page.getByRole('button',{name:'Cancel',exact:true}).click();
 // Stop at the end, and scroll back from it without using the scrollbar.
 await page.locator('#chart').evaluate(n=>{n.scrollLeft=n.scrollWidth;});await page.mouse.move(left+3,y);await page.waitForTimeout(650);const back=await offset(),maximum=await page.locator('#chart').evaluate(n=>n.scrollWidth-n.clientWidth);assert.ok(back<maximum);
 await page.mouse.move(1199,y);await page.waitForFunction(()=>{const n=document.querySelector('#chart');return n.scrollLeft>=n.scrollWidth-n.clientWidth-1;});await page.waitForTimeout(300);assert.equal(await offset(),maximum);
 // Exercise dragging at an edge using mock data, then cancel without writing any data.
 const today=await page.evaluate(()=>{const d=new Date();return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;});
 const mock={id:'00000000-0000-4000-8000-000000000001',parent_id:null,title:'Edge drag preview',position:0,text_color:'#000000',color:'#ff0000',notes:'',links:'',bars:[{start_date:today,end_date:today,color:'#ff0000'}]};
 await page.route('**/rest/v1/gantt03_nodes?*',r=>r.request().method()==='GET'?r.fulfill({json:[mock]}):r.continue());
 let writes=0;page.on('request',r=>{if(r.url().includes('/rest/v1/')&&r.method()!=='GET')writes++;});
 await page.reload();await page.getByRole('status').filter({hasText:'Saved'}).waitFor();const source=await page.locator('.cell.bar').first().boundingBox(),grid=await page.locator('#chart').boundingBox();
 await page.mouse.move(source.x+20,source.y+10);await page.mouse.down();await page.mouse.move(grid.x+grid.width-4,source.y+10,{steps:10});await page.waitForFunction(()=>document.querySelector('#chart').scrollLeft>100);await page.keyboard.press('Escape');await page.mouse.up();assert.equal(writes,0);assert.equal(await page.locator('.color-dragging').count(),0);
 assert.deepEqual(errors,[]);console.log('Passed edge hover scrolling in both directions, stopping away from edges, modal/navigation exclusion, boundaries, and color-drag edge scrolling/cancellation.');
}finally{await browser.close();}
