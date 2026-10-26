import {chromium} from '@playwright/test';
import assert from 'node:assert/strict';
const browser=await chromium.launch({channel:'msedge',headless:true});
const page=await browser.newPage({viewport:{width:1200,height:900}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
const offset=()=>page.locator('#chart').evaluate(n=>n.scrollLeft);
try{
 await page.goto('http://localhost:5173/gantt03/');await page.getByRole('status').filter({hasText:'Saved'}).waitFor();
 const r=await page.locator('#chart').boundingBox(),labelWidth=await page.locator('.node').first().evaluate(n=>n.getBoundingClientRect().width),left=r.x+labelWidth,y=r.y+50;
 const initial=await offset();assert.ok(initial>0);
 for(const x of [r.x+r.width-3,1199,left+3]){await page.mouse.move(x,y);await page.waitForTimeout(650);assert.equal(await offset(),initial,'Edge hover must not scroll');}
 await page.mouse.move((left+r.x+r.width)/2,y);await page.mouse.wheel(520,0);await page.waitForFunction(old=>document.querySelector('#chart').scrollLeft>old,initial);const after=await offset();await page.mouse.wheel(-520,0);await page.waitForFunction(old=>document.querySelector('#chart').scrollLeft<old,after);
 const today=await page.evaluate(()=>{const d=new Date();return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;});
 const mock={id:'00000000-0000-4000-8000-000000000001',parent_id:null,title:'Edge drag preview',position:0,text_color:'#000000',color:'#ff0000',notes:'',links:'',bars:[{start_date:today,end_date:today,color:'#ff0000'}]};
 await page.route('**/rest/v1/gantt03_nodes?*',route=>route.request().method()==='GET'?route.fulfill({json:[mock]}):route.continue());
 let writes=0;page.on('request',request=>{if(request.url().includes('/rest/v1/')&&request.method()!=='GET')writes++;});
 await page.reload();await page.getByRole('status').filter({hasText:'Saved'}).waitFor();
 for(const x of [r.x+r.width-4,left+3]){
  const source=await page.locator('.cell.bar').first().boundingBox(),before=await offset();await page.mouse.move(source.x+20,source.y+10);await page.mouse.down();await page.mouse.move(x,source.y+10,{steps:10});await page.waitForTimeout(650);assert.equal(await offset(),before,'Dragging at an edge must not scroll');await page.keyboard.press('Escape');await page.mouse.up();
 }
 assert.equal(writes,0);assert.deepEqual(errors,[]);console.log('Passed no automatic scrolling at either edge while hovering or dragging; manual horizontal scrolling remains available.');
}finally{await browser.close();}
