import {chromium} from '@playwright/test';
import assert from 'node:assert/strict';
import {addDays} from '../src/model.js';
const browser=await chromium.launch({channel:'msedge',headless:true});
const page=await browser.newPage({viewport:{width:1200,height:900}});
const scroll=()=>page.locator('#chart').evaluate(n=>n.scrollLeft);
const firstVisible=()=>page.locator('#chart').evaluate(chart=>{const left=chart.getBoundingClientRect().left+chart.querySelector('.node').getBoundingClientRect().width;return [...chart.querySelectorAll('thead tr:last-child [data-day]')].find(th=>th.getBoundingClientRect().right>left+2)?.dataset.day;});
try{
 await page.goto('http://localhost:5173/gantt03/');await page.getByRole('status').filter({hasText:'Saved'}).waitFor();
 const initial=await page.locator('#range-start').inputValue();assert.equal(await firstVisible(),initial);
 await page.locator('#previous').click();const anchor=addDays(initial,-30);assert.equal(await page.locator('#range-start').inputValue(),anchor);assert.equal(await firstVisible(),anchor);
 const before=await scroll();assert.ok(before>0,'Back must leave scrollable dates to the left');
 const r=await page.locator('#chart').boundingBox();await page.mouse.move(r.x+r.width/2,r.y+50);await page.mouse.wheel(-520,0);await page.waitForFunction(old=>document.querySelector('#chart').scrollLeft<old,before);assert.ok((await firstVisible())<anchor);
 const earlier=await scroll();await page.mouse.wheel(520,0);await page.waitForFunction(old=>document.querySelector('#chart').scrollLeft>old,earlier);
 // Drag the native scrollbar thumb itself when the browser exposes a scrollbar gutter.
 const metrics=await page.locator('#chart').evaluate(n=>({left:n.getBoundingClientRect().left,bottom:n.getBoundingClientRect().bottom,width:n.clientWidth,total:n.scrollWidth,offset:n.scrollLeft,gutter:n.offsetHeight-n.clientHeight}));
 if(metrics.gutter>3){const thumb=metrics.width*metrics.width/metrics.total,x=metrics.left+metrics.offset*metrics.width/metrics.total+thumb/2;await page.mouse.move(x,metrics.bottom-7);await page.mouse.down();await page.mouse.move(x-55,metrics.bottom-7,{steps:8});await page.mouse.up();assert.ok(await scroll()<metrics.offset,'Dragging the scrollbar left must reveal earlier dates');}
 await page.locator('#previous').click();assert.equal(await firstVisible(),addDays(initial,-60));assert.ok(await scroll()>0);
 await page.locator('#next').click();assert.equal(await firstVisible(),anchor);assert.ok(await scroll()>0);
 await page.locator('#today').click();assert.equal(await firstVisible(),await page.locator('#range-start').inputValue());assert.ok(await scroll()>0);
 console.log('Passed Back navigation with dates to its left, native horizontal wheel/scrollbar movement backward and forward, repeated Back/Next, and Today positioning.');
}finally{await browser.close();}
