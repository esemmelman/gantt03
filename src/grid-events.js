import {iso} from './model.js';
import {cellTooltip,colorsOn,colorFill,rangesOf,paintRange,nodeDrop} from './interactions.js';

export function installGridInteractions({getNodes,getVisible,isBusy,saveColors,moveNode,select,status}){
 const chart=document.querySelector('#chart'),menu=document.querySelector('#menu'),tip=document.querySelector('#day-tooltip'),rootDrop=document.querySelector('#root-drop');
 let gesture=null,nodeDrag=null,suppressClick=false,scrollFrame=0;
 const node=id=>getNodes().find(n=>n.id===id);
 const dayCell=target=>target?.closest?.('.cell[data-day]');
 const hideTip=()=>{tip.hidden=true;};
 function tooltip(e){const cell=e.target.closest?.('[data-day]');if(!cell||gesture?.active||nodeDrag){hideTip();return;}
  const value=cellTooltip(cell.dataset.day,node(cell.dataset.nodeId)?.title,iso(new Date()));cell.title=value;tip.textContent=value;tip.hidden=false;
  const bounds=tip.getBoundingClientRect();tip.style.left=`${Math.max(4,Math.min(innerWidth-bounds.width-4,e.clientX+12))}px`;tip.style.top=`${Math.max(4,Math.min(innerHeight-bounds.height-4,e.clientY+15))}px`;
 }
 chart.addEventListener('pointermove',tooltip);chart.addEventListener('pointerover',tooltip);chart.addEventListener('pointerleave',hideTip);chart.addEventListener('scroll',hideTip);
 function showMenu(cell,e){
  if(isBusy())return;e.preventDefault();hideTip();select(cell.dataset.nodeId);menu.replaceChildren();
  for(const [label,color] of [['Red','#ff0000'],['Blue','#0000ff'],['Green','#008000'],['Clear',null]]){
   const button=document.createElement('button');button.textContent=label;button.setAttribute('role','menuitem');button.style.borderLeft=`6px solid ${color||'#ddd'}`;
   button.onclick=async()=>{menu.hidden=true;const n=node(cell.dataset.nodeId);if(n)await persist([{id:n.id,expected_bars:rangesOf(n),bars:paintRange(rangesOf(n),cell.dataset.day,cell.dataset.day,color?[color]:[])}]);};menu.append(button);
  }
  menu.hidden=false;const rect=menu.getBoundingClientRect();menu.style.left=`${Math.max(0,Math.min(e.clientX,innerWidth-rect.width-8))}px`;menu.style.top=`${Math.max(0,Math.min(e.clientY,innerHeight-rect.height-8))}px`;menu.firstChild.focus();
 }
 chart.addEventListener('contextmenu',e=>{const cell=dayCell(e.target);if(cell)showMenu(cell,e);});
 chart.addEventListener('keydown',e=>{const cell=dayCell(e.target);if(cell&&(e.key==='ContextMenu'||(e.shiftKey&&e.key==='F10'))){const r=cell.getBoundingClientRect();showMenu(cell,{preventDefault:()=>e.preventDefault(),clientX:r.left+10,clientY:r.bottom});}});
 async function persist(changes){if(!changes.length)return;try{await saveColors(changes);}catch(e){status(e.message,true);}}
 function edits(g){
  if(!g.target)return [];
  const source=node(g.id),dest=node(g.target.id);if(!source||!dest)return [];
  if(g.mode==='move'){
   if(source.id===dest.id&&g.day===g.target.day)return [];
   const cleared=paintRange(rangesOf(source),g.day,g.day,[]);
   if(source.id===dest.id)return [{id:source.id,expected_bars:rangesOf(source),bars:paintRange(cleared,g.target.day,g.target.day,g.colors)}];
   return [{id:source.id,expected_bars:rangesOf(source),bars:cleared},{id:dest.id,expected_bars:rangesOf(dest),bars:paintRange(rangesOf(dest),g.target.day,g.target.day,g.colors)}];
  }
  const rows=getVisible(),a=rows.findIndex(n=>n.id===source.id),b=rows.findIndex(n=>n.id===dest.id),start=g.day<g.target.day?g.day:g.target.day,end=g.day>g.target.day?g.day:g.target.day;
  return rows.slice(Math.min(a,b),Math.max(a,b)+1).map(n=>({id:n.id,expected_bars:rangesOf(n),bars:paintRange(rangesOf(n),start,end,g.colors)}));
 }
 function preview(g){
  const changed=new Map(edits(g).map(n=>[n.id,n])),rows=new Map(getNodes().map(n=>[n.id,n]));
  for(const cell of chart.querySelectorAll('.cell[data-day]')){
   const original=rows.get(cell.dataset.nodeId),updated=changed.get(original?.id),colors=colorsOn(updated||original,cell.dataset.day);
   cell.classList.toggle('bar',colors.length>0);cell.style.setProperty('--bar',colors.length?colorFill(colors):'transparent');
   cell.classList.toggle('paint-preview',Boolean(updated)&&JSON.stringify(colors)!==JSON.stringify(colorsOn(original,cell.dataset.day)));
  }
 }
 function endPreview(){chart.classList.remove('color-dragging');chart.querySelectorAll('.paint-preview').forEach(c=>c.classList.remove('paint-preview'));}
 function targetAt(x,y){const cell=dayCell(document.elementFromPoint(x,y));return cell?{id:cell.dataset.nodeId,day:cell.dataset.day}:null;}
 function updateTarget(g){g.target=targetAt(g.x,g.y);const key=JSON.stringify(g.target);if(key!==g.previewKey){g.previewKey=key;preview(g);}}
 function autoScroll(){
  if(!gesture?.active)return;const g=gesture,r=chart.getBoundingClientRect(),labelWidth=chart.querySelector('.node')?.getBoundingClientRect().width||320;
  if(g.y>=r.top&&g.y<=r.bottom){if(g.x>r.right-35)chart.scrollLeft+=14;else if(g.x<r.left+labelWidth+25)chart.scrollLeft-=14;}
  if(g.x>=r.left&&g.x<=r.right){if(g.y>r.bottom-25)chart.scrollTop+=10;else if(g.y<r.top+90)chart.scrollTop-=10;}
  updateTarget(g);scrollFrame=requestAnimationFrame(autoScroll);
 }
 chart.addEventListener('pointerdown',e=>{
  hideTip();
  const cell=dayCell(e.target);if(e.button!==0||!cell||isBusy()||nodeDrag)return;const n=node(cell.dataset.nodeId),colors=colorsOn(n,cell.dataset.day);if(!colors.length)return;
  gesture={id:n.id,day:cell.dataset.day,colors,mode:e.altKey?'paint':e.shiftKey?'move':document.querySelector('#color-drag-mode').value,startX:e.clientX,startY:e.clientY,x:e.clientX,y:e.clientY,pointerId:e.pointerId,active:false};
 });
 document.addEventListener('pointermove',e=>{
  const g=gesture;if(!g||e.pointerId!==g.pointerId)return;g.x=e.clientX;g.y=e.clientY;
  if(!g.active&&Math.hypot(g.x-g.startX,g.y-g.startY)<5)return;
  if(!g.active){g.active=true;hideTip();menu.hidden=true;chart.classList.add('color-dragging');chart.setPointerCapture(e.pointerId);scrollFrame=requestAnimationFrame(autoScroll);}
  e.preventDefault();updateTarget(g);
 },{passive:false});
 chart.addEventListener('click',e=>{if(suppressClick){e.preventDefault();e.stopImmediatePropagation();suppressClick=false;}},true);
 function finish(e,cancel=false){
  const g=gesture;if(!g||e.pointerId!==g.pointerId)return;gesture=null;cancelAnimationFrame(scrollFrame);
  if(!g.active)return;if(chart.hasPointerCapture(e.pointerId))chart.releasePointerCapture(e.pointerId);endPreview();suppressClick=true;setTimeout(()=>{suppressClick=false;},250);
  if(cancel||!g.target){preview({target:null});return;}const changes=edits(g);preview({target:null});persist(changes);
 }
 document.addEventListener('pointerup',e=>finish(e));document.addEventListener('pointercancel',e=>finish(e,true));
 document.addEventListener('keydown',e=>{if(e.key==='Escape'&&gesture){finish({pointerId:gesture.pointerId},true);}});
 window.addEventListener('blur',()=>{if(gesture)finish({pointerId:gesture.pointerId},true);});

 // Native node dragging carries the entire branch with it.
 function resetDrop(){chart.querySelectorAll('.drop-before,.drop-after,.drop-inside,.drop-invalid').forEach(n=>n.classList.remove('drop-before','drop-after','drop-inside','drop-invalid'));rootDrop.classList.remove('drop-inside','drop-invalid');}
 function placement(e,target){const r=target.getBoundingClientRect(),fraction=(e.clientY-r.top)/r.height;return fraction<.28?'before':fraction>.72?'after':'inside';}
 chart.addEventListener('dragstart',e=>{
  const td=e.target.closest('.node[data-id]');if(!td||e.target.closest('button,input')||isBusy()||document.querySelector('.draft-row')){e.preventDefault();return;}
  nodeDrag=td.dataset.id;hideTip();e.dataTransfer.effectAllowed='move';e.dataTransfer.setData('text/plain',nodeDrag);td.classList.add('drag-source');
 });
 function dragOver(e){if(!nodeDrag)return;const target=e.target.closest('.node[data-id]'),isRoot=e.currentTarget===rootDrop;if(!target&&!isRoot)return;
  e.preventDefault();resetDrop();const mark=isRoot?rootDrop:target,place=isRoot?'inside':placement(e,target);
  try{nodeDrop(getNodes(),node(nodeDrag),target?node(target.dataset.id):null,place);mark.classList.add('drop-'+place);e.dataTransfer.dropEffect='move';status(isRoot?'Move to root level':`${place==='inside'?'Move under':place==='before'?'Move before':'Move after'} ${node(target.dataset.id).title}`);}catch(err){mark.classList.add('drop-invalid');e.dataTransfer.dropEffect='none';status(err.message,true);}
 }
 async function drop(e){if(!nodeDrag)return;const target=e.target.closest('.node[data-id]'),isRoot=e.currentTarget===rootDrop;if(!target&&!isRoot)return;e.preventDefault();const id=nodeDrag;nodeDrag=null;resetDrop();chart.querySelectorAll('.drag-source').forEach(n=>n.classList.remove('drag-source'));
  try{const values=nodeDrop(getNodes(),node(id),target?node(target.dataset.id):null,isRoot?'inside':placement(e,target));await moveNode(id,values);}catch(err){status(err.message,true);}
 }
 chart.addEventListener('dragover',dragOver);chart.addEventListener('drop',drop);rootDrop.addEventListener('dragover',dragOver);rootDrop.addEventListener('drop',drop);
 document.addEventListener('dragend',()=>{nodeDrag=null;resetDrop();chart.querySelectorAll('.drag-source').forEach(n=>n.classList.remove('drag-source'));});
}
