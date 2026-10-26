import {iso} from './model.js';
import {cellTooltip,colorsOn,colorFill,rangesOf,paintRange,nodeDrop} from './interactions.js';

export function installGridInteractions({getNodes,getVisible,isBusy,saveColors,moveNode,selectCell,status,undo}){
 const chart=document.querySelector('#chart'),menu=document.querySelector('#menu'),tip=document.querySelector('#day-tooltip');
 let gesture=null,nodeDrag=null,suppressClick=false;
 const node=id=>getNodes().find(n=>n.id===id);
 const dayCell=target=>target?.closest?.('.cell[data-day]');
 const hideTip=()=>{tip.hidden=true;};
 let cornerKey=null,dismissedCorner=null,releasedAt=null;
 function hideCorner(dismiss=false){if(dismiss)dismissedCorner=cornerKey;cornerKey=null;chart.querySelectorAll('.corner-hot').forEach(cell=>cell.classList.remove('corner-hot'));}
 function hoverCorner(e){
  if(releasedAt){if(Math.hypot(e.clientX-releasedAt.x,e.clientY-releasedAt.y)<3)return;releasedAt=null;}
  if(gesture?.active||nodeDrag)return;const cell=dayCell(e.target);if(!cell){hideCorner();dismissedCorner=null;return;}
  const r=cell.getBoundingClientRect(),key=cell.dataset.nodeId+':'+cell.dataset.day;
  const near=e.target.closest('.fill-handle')||(e.clientX>=r.right-12&&e.clientX<=r.right+5&&e.clientY>=r.bottom-12&&e.clientY<=r.bottom+5);
  if(!near){hideCorner();dismissedCorner=null;return;}if(dismissedCorner===key)return;
  if(cornerKey!==key){hideCorner();cornerKey=key;cell.classList.add('corner-hot');}
 }
 chart.addEventListener('pointermove',hoverCorner);chart.addEventListener('pointerover',hoverCorner);chart.addEventListener('pointerleave',()=>{if(!gesture?.active)hideCorner();dismissedCorner=null;});
 chart.addEventListener('scroll',()=>{if(!gesture?.active)hideCorner();});
 function tooltip(e){const cell=e.target.closest?.('[data-day]');if(!cell||e.target.closest('.fill-handle')||gesture?.active||nodeDrag){hideTip();return;}
  const value=cellTooltip(cell.dataset.day,node(cell.dataset.nodeId)?.title,iso(new Date()));tip.textContent=value;tip.hidden=false;
  const bounds=tip.getBoundingClientRect();tip.style.left=`${Math.max(4,Math.min(innerWidth-bounds.width-4,e.clientX+12))}px`;tip.style.top=`${Math.max(4,Math.min(innerHeight-bounds.height-4,e.clientY+15))}px`;
 }
 chart.addEventListener('pointermove',tooltip);chart.addEventListener('pointerover',tooltip);chart.addEventListener('pointerleave',hideTip);chart.addEventListener('scroll',hideTip);
 function showMenu(cell,e){
  if(isBusy())return;e.preventDefault();hideTip();selectCell(cell.dataset.nodeId,cell.dataset.day);menu.replaceChildren();
  for(const [label,color] of [['Red','#ff0000'],['Yellow','#ffff00'],['Green','#008000'],['Clear',null]]){
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
 function endPreview(){chart.classList.remove('color-dragging','painting');chart.querySelectorAll('.paint-preview').forEach(c=>c.classList.remove('paint-preview'));}
 function targetAt(x,y){const cell=dayCell(document.elementFromPoint(x,y));return cell?{id:cell.dataset.nodeId,day:cell.dataset.day}:null;}
 function updateTarget(g){g.target=targetAt(g.x,g.y);const key=JSON.stringify(g.target);if(key!==g.previewKey){g.previewKey=key;preview(g);}}
 chart.addEventListener('scroll',()=>{if(gesture?.active)updateTarget(gesture);});
 chart.addEventListener('pointerdown',e=>{
  hideTip();
  const cell=dayCell(e.target);if(e.button!==0||!cell||isBusy()||nodeDrag)return;selectCell(cell.dataset.nodeId,cell.dataset.day);const n=node(cell.dataset.nodeId),colors=colorsOn(n,cell.dataset.day);if(!colors.length&&!e.target.closest('.fill-handle'))return;
  gesture={id:n.id,day:cell.dataset.day,colors,mode:e.target.closest('.fill-handle')?'paint':'move',startX:e.clientX,startY:e.clientY,x:e.clientX,y:e.clientY,pointerId:e.pointerId,active:false};
 });
 document.addEventListener('pointermove',e=>{
  const g=gesture;if(!g||e.pointerId!==g.pointerId)return;g.x=e.clientX;g.y=e.clientY;
  if(!g.active&&Math.hypot(g.x-g.startX,g.y-g.startY)<5)return;
  if(!g.active){g.active=true;hideTip();menu.hidden=true;chart.classList.add('color-dragging');chart.classList.toggle('painting',g.mode==='paint');chart.setPointerCapture(e.pointerId);}
  e.preventDefault();updateTarget(g);
 },{passive:false});
 chart.addEventListener('click',e=>{if(suppressClick){e.preventDefault();e.stopImmediatePropagation();suppressClick=false;}},true);
 function finish(e,cancel=false){
  releasedAt=Number.isFinite(e.clientX)?{x:e.clientX,y:e.clientY}:gesture?{x:gesture.x,y:gesture.y}:null;
  hideCorner(true);
  const g=gesture;if(!g||e.pointerId!==g.pointerId)return;gesture=null;
  if(!g.active)return;if(chart.hasPointerCapture(e.pointerId))chart.releasePointerCapture(e.pointerId);endPreview();suppressClick=true;setTimeout(()=>{suppressClick=false;},250);
  if(cancel||!g.target){preview({target:null});return;}const changes=edits(g);preview({target:null});persist(changes);
 }
 document.addEventListener('pointerup',e=>finish(e));document.addEventListener('pointercancel',e=>finish(e,true));
 document.addEventListener('keydown',e=>{
  if(e.key!=='Escape')return;
  if(gesture){e.preventDefault();finish({pointerId:gesture.pointerId},true);return;}
  if(nodeDrag){e.preventDefault();nodeDrag=null;resetDrop();hideCorner(true);return;}
  if(e.defaultPrevented||document.querySelector('dialog[open]')||e.target.closest('input,textarea,select,[contenteditable=true]'))return;
  e.preventDefault();hideCorner(true);hideTip();undo();
 });
 window.addEventListener('blur',()=>{if(gesture)finish({pointerId:gesture.pointerId},true);});

 // Native node dragging carries the entire branch with it.
 function resetDrop(){chart.querySelectorAll('.drop-before,.drop-after,.drop-inside,.drop-invalid').forEach(n=>n.classList.remove('drop-before','drop-after','drop-inside','drop-invalid'));}
 function placement(e,target){const r=target.getBoundingClientRect(),fraction=(e.clientY-r.top)/r.height;return fraction<.28?'before':fraction>.72?'after':'inside';}
 chart.addEventListener('dragstart',e=>{
  const td=e.target.closest('.node[data-id]');if(!td||e.target.closest('button,input')||isBusy()||document.querySelector('.draft-row')){e.preventDefault();return;}
  nodeDrag=td.dataset.id;hideTip();e.dataTransfer.effectAllowed='move';e.dataTransfer.setData('text/plain',nodeDrag);td.classList.add('drag-source');
 });
 function dragOver(e){if(!nodeDrag)return;const target=e.target.closest('.node[data-id]');if(!target)return;
  e.preventDefault();resetDrop();const place=placement(e,target);
  try{nodeDrop(getNodes(),node(nodeDrag),node(target.dataset.id),place);target.classList.add('drop-'+place);e.dataTransfer.dropEffect='move';status(`${place==='inside'?'Move under':place==='before'?'Move before':'Move after'} ${node(target.dataset.id).title}`);}catch(err){target.classList.add('drop-invalid');e.dataTransfer.dropEffect='none';status(err.message,true);}
 }
 async function drop(e){if(!nodeDrag)return;const target=e.target.closest('.node[data-id]');if(!target)return;e.preventDefault();const id=nodeDrag;nodeDrag=null;resetDrop();chart.querySelectorAll('.drag-source').forEach(n=>n.classList.remove('drag-source'));
  try{const values=nodeDrop(getNodes(),node(id),node(target.dataset.id),placement(e,target));await moveNode(id,values);}catch(err){status(err.message,true);}
 }
 chart.addEventListener('dragover',dragOver);chart.addEventListener('drop',drop);
 document.addEventListener('dragend',()=>{nodeDrag=null;resetDrop();chart.querySelectorAll('.drag-source').forEach(n=>n.classList.remove('drag-source'));});
}
