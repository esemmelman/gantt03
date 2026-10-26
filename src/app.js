import './style.css';
import * as api from './api.js';
import {children,level,height,visible,projectRoot,projectVisible,archivedRoots,actions,iso,addDays} from './model.js';
import {nodeDrop,dayOffset,cellTooltip,nodeDayOffset,rangesOf as barRanges,colorsOn as barColors,colorFill} from './interactions.js';
import {installGridInteractions} from './grid-events.js';
import {actionDiff} from './history.js';
import {createNodeDetails} from './node-details.js';
const $=s=>document.querySelector(s), el=(tag,text)=>{const n=document.createElement(tag);if(text!==undefined)n.textContent=text;return n;};
let nodes=[],selected=null,collapsed=new Set(JSON.parse(localStorage.getItem('gantt03-collapsed')||'[]')),busy=false,editing=null,draft=null,activeCell=null,focusedRoot=null,focusTimer=null;
const undoStack=[];let undoRequested=false,undoing=false;
const start=$('#range-start');start.value=iso(new Date());
function status(message,error=false){$('#status').textContent=message;$('#status').classList.toggle('error',error);}
function remember(){localStorage.setItem('gantt03-collapsed',JSON.stringify([...collapsed]));}
async function refresh(){try{nodes=await api.load();render();status('Saved · Supabase');}catch(e){status(e.message,true);}}
async function mutate(fn){
 if(busy)return;busy=true;status('Saving…');
 try{const before=await api.snapshot();api.beginRecording();await fn();const scope=api.endRecording(),after=await api.snapshot(),action=actionDiff(before,after,scope);if(action.changes.length||action.settings_before!==null){undoStack.push(action);if(undoStack.length>30)undoStack.shift();}nodes=after.nodes;render();status('Saved · Supabase');}
 catch(e){api.endRecording();status(e.message,true);throw e;}
 finally{busy=false;if(undoRequested){undoRequested=false;await undoLast();}}
}
async function undoLast(){
 if(busy){if(!undoing)undoRequested=true;return;}undoRequested=false;const action=undoStack.at(-1);if(!action){status('Nothing to undo');return;}busy=true;undoing=true;status('Undoing…');
 try{await api.undoAction(action);undoStack.pop();await refresh();status('Undone · Supabase');}catch(e){status(e.message,true);}finally{busy=false;undoing=false;}
}
function dateCount(){return $('#days').value==='through-aug-2027'?Math.max(1,dayOffset('2027-08-31',start.value)+1):Number($('#days').value);}
const historyDays=90;
function dates(){return Array.from({length:historyDays+dateCount()},(_,i)=>addDays(start.value,i-historyDays));}
function showStartDate(){const width=$('#chart th[data-day]')?.getBoundingClientRect().width||52;$('#chart').scrollLeft=historyDays*width;}
function select(id){selected=id;document.querySelectorAll('.node[data-id]').forEach(n=>n.classList.toggle('selected',n.dataset.id===id));}
function focusProject(id){clearTimeout(focusTimer);select(id);const root=projectRoot(nodes,id);if(!root||root===focusedRoot)return false;focusedRoot=root;render();$('#chart').scrollTop=0;return true;}
function selectCell(id,day){activeCell={id,day};select(id);document.querySelectorAll('.cell').forEach(cell=>{const active=cell.dataset.nodeId===id&&cell.dataset.day===day;cell.classList.toggle('cell-selected',active);cell.setAttribute('aria-selected',String(active));});}
function jumpToSchedule(node){
 const today=iso(new Date()),offset=nodeDayOffset(node,today);if(offset===null)return;const day=addDays(today,offset),loaded=dates();
 if(day<loaded[0]||day>loaded.at(-1)){start.value=day;render();}
 selectCell(node.id,day);const chart=$('#chart'),cell=chart.querySelector(`.cell[data-node-id="${node.id}"][data-day="${day}"]`);if(!cell)return;
 const width=cell.getBoundingClientRect().width,labelWidth=chart.querySelector('.node').getBoundingClientRect().width;
 chart.scrollLeft=Math.max(0,dayOffset(day,dates()[0])*width-Math.max(0,(chart.clientWidth-labelWidth-width)/2));cell.focus({preventScroll:true});
}
function chartRows(){return projectVisible(nodes,collapsed,focusedRoot).filter(node=>node.depth<=Number($('#task-level').value));}
function render(){if(focusedRoot){if(selected&&nodes.some(n=>n.id===selected))focusedRoot=projectRoot(nodes,selected);if(!visible(nodes,new Set()).some(n=>n.id===focusedRoot))focusedRoot=null;}const parents=visible(nodes,new Set()).filter(n=>children(nodes,n.id).some(child=>!child.archived)),anyCollapsed=parents.some(n=>collapsed.has(n.id));const needsExpand=Boolean(focusedRoot)||anyCollapsed;$('#expand-toggle').textContent=needsExpand?'Expand All':'Collapse All';$('#expand-toggle').setAttribute('aria-expanded',String(!needsExpand));const table=el('table'),head=el('thead'),days=dates();
 for(let row=0;row<2;row++){const tr=el('tr'),blank=el('th');blank.className='node head';blank.setAttribute('aria-label',row?'Dates':'Nodes');tr.append(blank);for(const day of days){const d=new Date(day+'T12:00:00'),th=el('th',row?day.slice(5):['S','M','T','W','T','F','S'][d.getDay()]);th.className=(d.getDay()%6===0?'weekend':'weekday')+(day===iso(new Date())?' today':'');th.dataset.day=day;th.setAttribute('aria-label',cellTooltip(day,undefined,iso(new Date())));th.setAttribute('aria-describedby','day-tooltip');tr.append(th);}head.append(tr);}table.append(head);
 const rows=chartRows();let siblingAnchor=null;if(draft?.action==='Add sibling'){const index=rows.findIndex(n=>n.id===draft.node.id);if(index>=0){let last=index;while(last+1<rows.length&&rows[last+1].depth>rows[index].depth)last++;siblingAnchor=rows[last].id;}}const body=el('tbody');for(const node of rows){const tr=el('tr'),td=el('td'),hasChildren=children(nodes,node.id).some(child=>!child.archived);td.className='node'+(hasChildren?' parent':'')+(selected===node.id?' selected':'');td.dataset.id=node.id;td.draggable=true;td.tabIndex=0;td.style.paddingLeft=`${5+(node.depth-1)*25}px`;td.style.color=node.text_color;td.title=`${node.title} · Level ${node.depth}${node.notes?' · Has notes':''}`;
 if(hasChildren){const toggle=el('button',collapsed.has(node.id)?'›':'⌄');toggle.className='toggle';toggle.setAttribute('aria-label',`${collapsed.has(node.id)?'Expand':'Collapse'} ${node.title}`);toggle.setAttribute('aria-expanded',String(!collapsed.has(node.id)));toggle.onclick=e=>{e.stopPropagation();collapsed.has(node.id)?collapsed.delete(node.id):collapsed.add(node.id);remember();render();};td.append(toggle);}else if(node.depth<3){const space=el('span','');space.style.display='inline-block';space.style.width='22px';td.append(space);}
 const offset=nodeDayOffset(node,iso(new Date()));if(offset!==null){const count=el('button',String(offset));count.type='button';count.className='node-offset';count.setAttribute('aria-label',`Go to colored cell, ${offset} days from today`);count.onclick=e=>{e.stopPropagation();jumpToSchedule(node);};td.append(count);}const label=el('span',node.title);label.className='node-label';if(!node.parent_id){label.onpointerenter=e=>{if(e.pointerType==='touch'||e.buttons||busy||draft||document.querySelector('dialog[open]')||!$('#menu').hidden)return;clearTimeout(focusTimer);focusTimer=setTimeout(()=>{if(label.matches(':hover')&&!busy&&!draft&&!document.querySelector('dialog[open]')&&$('#menu').hidden)focusProject(node.id);},200);};label.onpointerleave=()=>clearTimeout(focusTimer);}td.append(label);td.onclick=()=>{select(node.id);openEditor('Edit',node);};td.oncontextmenu=e=>{e.preventDefault();select(node.id);openMenu(node,e.clientX,e.clientY);};td.onkeydown=e=>{if(e.target!==td)return;if(e.key==='ContextMenu'||(e.shiftKey&&e.key==='F10')){e.preventDefault();const r=td.getBoundingClientRect();select(node.id);openMenu(node,r.left+30,r.bottom);}if(e.key==='Enter'){select(node.id);openEditor('Edit',node);}};tr.append(td);
 for(const day of days){const cell=el('td');const d=new Date(day+'T12:00:00');cell.className='cell'+(d.getDay()%6===0?' weekend-cell':'');cell.dataset.day=day;cell.dataset.nodeId=node.id;cell.classList.toggle('cell-selected',activeCell?.id===node.id&&activeCell?.day===day);cell.setAttribute('aria-selected',String(activeCell?.id===node.id&&activeCell?.day===day));cell.tabIndex=0;cell.setAttribute('aria-label',`${node.title}, ${day}`);const colors=barColors(node,day);if(colors.length){cell.classList.add('bar');cell.style.setProperty('--bar',colorFill(colors));}cell.setAttribute('aria-describedby','day-tooltip');const fill=el('button');fill.className='fill-handle';fill.type='button';fill.setAttribute('aria-label','Paint from this cell');fill.onclick=e=>{e.stopPropagation();selectCell(node.id,day);};cell.append(fill);cell.onclick=()=>selectCell(node.id,day);cell.ondblclick=e=>{if(!e.target.closest('.fill-handle')){selectCell(node.id,day);openEditor('Edit',node,day);}};tr.append(cell);}if(draft?.action==='Add parent'&&draft.node.id===node.id)body.append(draftRow(days.length,node.depth));body.append(tr);if(draft?.action==='Add child'&&draft.node.id===node.id)body.append(draftRow(days.length,node.depth+1));if(node.id===siblingAnchor)body.append(draftRow(days.length,level(nodes,draft.node)));}if(draft?.action==='Add root')body.append(draftRow(days.length,1));table.append(body);$('#chart').replaceChildren(table);if(!nodes.length&&!draft){const empty=el('p','No nodes yet. Use Add root to begin.');empty.className='empty';$('#chart').append(empty);}}
function openMenu(node,x,y){const menu=$('#menu');menu.replaceChildren();for(const action of actions(nodes,node)){const button=el('button',action);button.setAttribute('role','menuitem');button.onclick=()=>{menu.hidden=true;if(action==='Delete')deleteNode(node);else if(action==='Edit')openEditor(action,node);else if(action==='Notes')nodeDetails.openNotes(node);else if(action==='Comments')nodeDetails.openComments(node);else if(action==='Archive')archiveNode(node);else startDraft(action,node);};menu.append(button);}menu.hidden=false;const r=menu.getBoundingClientRect();menu.style.left=`${Math.max(0,Math.min(x,innerWidth-r.width-8))}px`;menu.style.top=`${Math.max(0,Math.min(y,innerHeight-r.height-8))}px`;menu.firstChild.focus();}
document.addEventListener('pointerdown',e=>{clearTimeout(focusTimer);if(!$('#menu').contains(e.target))$('#menu').hidden=true;});document.addEventListener('keydown',e=>{if(e.key==='Escape'&&!$('#menu').hidden){e.preventDefault();$('#menu').hidden=true;}const m=$('#menu');if(!m.hidden&&['ArrowDown','ArrowUp'].includes(e.key)){e.preventDefault();const a=[...m.children],i=a.indexOf(document.activeElement);a[(i+(e.key==='ArrowDown'?1:a.length-1))%a.length].focus();}});
function startDraft(action,node=null){
 if(busy)return;if(draft){status('Finish or cancel the new row first.',true);$('#draft-name')?.focus();return;}
 if(action==='Add parent'&&level(nodes,node)+height(nodes,node)>4){showPanel('Four-level limit',c=>c.append(el('p','Adding a parent would move a descendant beyond level four.')));return;}
 if(action==='Add child'&&level(nodes,node)>=4)return;
 draft={action,node,title:''};if(node)collapsed.delete(action==='Add child'?node.id:node.parent_id);remember();render();$('#draft-name').focus();$('#draft-name').scrollIntoView({block:'nearest',inline:'nearest'});
}
function draftRow(dayCount,depth){
 const tr=el('tr'),td=el('td');tr.className='draft-row';td.className='node draft-node';td.style.paddingLeft=`${5+(depth-1)*25}px`;
 const name=el('input');name.id='draft-name';name.placeholder='New '+(draft.action==='Add parent'?'parent':draft.action==='Add child'?'child':draft.action==='Add sibling'?'sibling':'root');name.setAttribute('aria-label','New node name');name.maxLength=300;name.value=draft.title;name.disabled=busy;name.oninput=()=>{draft.title=name.value;};name.onkeydown=e=>{e.stopPropagation();if(e.key==='Enter'){e.preventDefault();saveDraft(false);}if(e.key==='Escape'){draft=null;render();}};
 const save=el('button','✓');save.setAttribute('aria-label','Save new row');save.onclick=()=>saveDraft(false);
 const cancel=el('button','×');cancel.setAttribute('aria-label','Cancel new row');cancel.onclick=()=>{if(busy)return;draft=null;render();};
 for(const b of [save,cancel]){b.className='draft-action';b.disabled=busy;}
 td.append(name,save,cancel);tr.append(td);const rest=el('td');rest.colSpan=dayCount;rest.className='draft-hint';rest.textContent='Type a name · Enter or ✓ to save · Click the saved node to edit';tr.append(rest);return tr;
}
async function saveDraft(details){
 if(!draft||busy)return;const pending=draft,title=pending.title.trim();if(!title){status('Enter a name for the new row.',true);$('#draft-name').focus();return;}
 let id;try{await mutate(async()=>{if(pending.action==='Add parent'){id=await api.addParent(pending.node.id,title);}else{const parent_id=pending.action==='Add sibling'?pending.node.parent_id:pending.action==='Add child'?pending.node.id:null;const siblings=children(nodes,parent_id);let position=pending.action==='Add child'?Math.min(0,...siblings.map(n=>n.position))-1:Math.max(0,...siblings.map(n=>n.position))+1;if(pending.action==='Add sibling'){const next=siblings[siblings.findIndex(n=>n.id===pending.node.id)+1];position=next?(pending.node.position+next.position)/2:pending.node.position+1;}const [created]=await api.create({title,parent_id,position});id=created.id;}draft=null;selected=id;collapsed.delete(id);remember();});if(details){const node=nodes.find(n=>n.id===id);if(node)openEditor('Edit',node);}}catch{render();$('#draft-name')?.focus();}
}
function addRange(bar={}){
 const row=el('div');row.className='bar-range';
 for(const [name,label,type,value] of [['start_date','Start','date',bar.start_date||''],['end_date','End','date',bar.end_date||bar.start_date||''],['color','Color','color',bar.color||'#ef8080']]){const l=el('label',label),input=el('input');input.type=type;input.dataset.field=name;input.value=value;input.required=true;l.append(input);row.append(l);}
 const remove=el('button','×');remove.type='button';remove.setAttribute('aria-label','Remove color range');remove.onclick=()=>row.remove();row.append(remove);$('#bar-ranges').append(row);return row;
}
$('#add-range').onclick=()=>addRange({start_date:iso(new Date()),end_date:iso(new Date())});
function moveChoices(node){
 const choices=new Map([[1,[null]],[2,[]],[3,[]],[4,[]]]);
 for(const parent of visible(nodes,new Set())){try{nodeDrop(nodes,node,parent,'inside');choices.get(level(nodes,parent)+1)?.push(parent);}catch{}}
 return choices;
}
function fillParents(){
 const depth=Number($('#node-level').value),choices=moveChoices(editing.node).get(depth)||[],parentSelect=$('#node-parent');parentSelect.replaceChildren();
 for(const parent of choices){const option=el('option');option.value=parent?.id||'';
  if(parent){const path=[];let current=parent;while(current){path.unshift(current.title);current=nodes.find(n=>n.id===current.parent_id);}option.textContent=path.join(' › ');}else option.textContent='No parent (root)';
  parentSelect.append(option);
 }
 if(choices.some(p=>(p?.id||'')===(editing.node.parent_id||'')))parentSelect.value=editing.node.parent_id||'';
 $('#node-level-hint').textContent=`This node will be level ${depth}. Children move with it; all branches stay within four levels.`;
}
$('#node-level').onchange=fillParents;
function openEditor(action,node,day=null){
 if(busy)return;select(node.id);editing={action,node};const form=$('#form');form.reset();$('#form-error').textContent='';$('#dialog-title').textContent='Edit node';$('#dialog-context').textContent=`${node.title} · Level ${level(nodes,node)}`;
 for(const name of ['title','text_color','links'])form.elements.namedItem(name).value=node[name]||'';
 const choices=moveChoices(node);$('#node-level').replaceChildren();for(let depth=1;depth<=4;depth++){const option=el('option',`Level ${depth}${choices.get(depth).length?'':' (unavailable)'}`);option.value=String(depth);option.disabled=!choices.get(depth).length;$('#node-level').append(option);}$('#node-level').value=String(level(nodes,node));fillParents();
 $('#bar-ranges').replaceChildren();for(const bar of barRanges(node))addRange(bar);
 if(day&&!barColors(node,day).length)addRange({start_date:day,end_date:day});
 $('#editor').showModal();form.elements.title.focus();
}
$('#cancel').onclick=()=>$('#editor').close();
$('#editor').addEventListener('cancel',e=>{if(busy)e.preventDefault();});
$('#form').onsubmit=async e=>{
 e.preventDefault();const form=e.currentTarget,data=Object.fromEntries(new FormData(form));data.title=data.title.trim();if(!data.title){$('#form-error').textContent='Enter a name.';return;}
 data.bars=[...document.querySelectorAll('.bar-range')].map(row=>Object.fromEntries([...row.querySelectorAll('input')].map(input=>[input.dataset.field,input.value])));
 if(data.bars.some(b=>!b.start_date||!b.end_date||b.end_date<b.start_date)){$('#form-error').textContent='Each color range needs an end date on or after its start date.';return;}
 data.start_date=data.bars[0]?.start_date||null;data.end_date=data.bars[0]?.end_date||null;data.color=data.bars[0]?.color||'#ef8080';
 $('#save').disabled=true;$('#cancel').disabled=true;try{const parentId=data.parent_id||null;if(parentId!==editing.node.parent_id){const parent=nodes.find(n=>n.id===parentId);if(parentId&&!parent)throw Error('The selected parent no longer exists.');Object.assign(data,nodeDrop(nodes,editing.node,parent||null,'inside'));}else delete data.parent_id;await mutate(async()=>{await api.update(editing.node.id,data);if('parent_id' in data){let parent=nodes.find(n=>n.id===data.parent_id);while(parent){collapsed.delete(parent.id);parent=nodes.find(n=>n.id===parent.parent_id);}remember();}selected=editing.node.id;});$('#editor').close();}catch(e){$('#form-error').textContent=e.message;}finally{$('#save').disabled=false;$('#cancel').disabled=false;}
};
async function archiveNode(node){try{await mutate(async()=>{await api.update(node.id,{archived:true});selected=null;activeCell=null;});}catch{}}
function fillArchive(content){
 content.replaceChildren();const archived=archivedRoots(nodes);
 if(!archived.length){content.append(el('p','No archived nodes. Right-click a node and choose Archive to move its branch here.'));return;}
 for(const node of archived){const entry=el('section'),path=[];let current=node;while(current){path.unshift(current.title);current=nodes.find(n=>n.id===current.parent_id);}entry.className='archive-entry';entry.append(el('span',path.join(' › ')));
  const restore=el('button','Restore');restore.setAttribute('aria-label',`Restore ${node.title}`);restore.onclick=async()=>{restore.disabled=true;try{await mutate(async()=>{await api.update(node.id,{archived:false});let parent=nodes.find(n=>n.id===node.parent_id);while(parent){collapsed.delete(parent.id);parent=nodes.find(n=>n.id===parent.parent_id);}remember();selected=node.id;});fillArchive(content);}catch(e){content.append(el('p',e.message));restore.disabled=false;}};entry.append(restore);content.append(entry);
 }
}
$('#task-level').onchange=()=>{collapsed.clear();remember();render();$('#chart').scrollTop=0;};
$('#archive').onclick=()=>showPanel('Archive',fillArchive);
function deleteNode(node){const count=(function descendants(id){return children(nodes,id).reduce((s,n)=>s+1+descendants(n.id),0);})(node.id);showPanel('Delete node',content=>{content.append(el('p',`Delete “${node.title}”${count?` and its ${count} descendant${count===1?'':'s'}`:''}?`));const button=el('button','Delete');button.onclick=async()=>{button.disabled=true;try{await mutate(()=>api.remove(node.id));if(selected===node.id)selected=null;$('#panel').close();}catch(e){content.append(el('p',e.message));button.disabled=false;}};content.append(button);});}
function showPanel(title,fill){$('#panel-title').textContent=title;$('#panel-content').replaceChildren();fill($('#panel-content'));$('#panel').showModal();}
$('#panel-close').onclick=()=>$('#panel').close();
function selectedNode(){const node=nodes.find(n=>n.id===selected);if(!node)showPanel('Select a node',c=>c.append(el('p','Click a node name first.')));return node;}
$('#notes').onclick=()=>{const n=selectedNode();if(n)nodeDetails.openNotes(n);};
function appendLinks(content,text){for(const line of text.split('\n').filter(l=>l.trim())){try{const url=new URL(line.trim());if(!['http:','https:'].includes(url.protocol))throw Error();const a=el('a',line);a.href=url.href;a.target='_blank';a.rel='noopener noreferrer';content.append(a,el('br'));}catch{content.append(el('p',line));}}}
$('#links').onclick=()=>{const n=selectedNode();if(n)showPanel(`Links · ${n.title}`,c=>{if(n.links)appendLinks(c,n.links);else c.append(el('p','No links yet.'));const b=el('button','Edit links');b.onclick=()=>{$('#panel').close();openEditor('Edit',n);$('#form').elements.links.focus();};c.append(b);});};
$('#general').onclick=async()=>{try{const [settings]=await api.request('gantt03_settings?id=eq.1');showPanel('General Links',c=>{appendLinks(c,settings.general_links);const label=el('label','URLs, one per line'),text=el('textarea');text.rows=7;text.value=settings.general_links;label.append(text);c.append(label);const save=el('button','Save links');save.onclick=async()=>{save.disabled=true;try{await mutate(()=>api.request('gantt03_settings?id=eq.1','PATCH',{general_links:text.value}));$('#panel').close();}catch(e){c.append(el('p',e.message));save.disabled=false;}};c.append(save);});}catch(e){status(e.message,true);}};
function calendar(detail){showPanel(detail?'Calendar Detail':'Calendar',c=>{const end=addDays(start.value,dateCount()-1),scheduled=visible(nodes,new Set()).flatMap(n=>barRanges(n).map(bar=>({...n,...bar}))).filter(n=>n.start_date&&n.start_date<=end&&(n.end_date||n.start_date)>=start.value).sort((a,b)=>a.start_date.localeCompare(b.start_date));c.append(el('p',`${start.value} — ${end}`));if(!scheduled.length)c.append(el('p','No scheduled nodes in this date range.'));for(const n of scheduled){const section=el('section'),b=el('button',`${n.start_date}${n.end_date&&n.end_date!==n.start_date?' — '+n.end_date:''} · ${n.title}`);b.className='calendar-event';b.style.borderLeft='8px solid '+(/^#[0-9a-f]{6}$/i.test(n.color)?n.color:'#ef8080');b.onclick=()=>{$('#panel').close();openEditor('Edit',n);};section.append(b);if(detail){const path=[];let p=n;while(p){path.unshift(p.title);p=nodes.find(x=>x.id===p.parent_id);}section.append(el('p',path.join(' › ')),el('p',n.notes||'No notes'));appendLinks(section,n.links);}c.append(section);}});}
$('#calendar').onclick=()=>calendar(false);$('#detail').onclick=()=>calendar(true);
$('#expand-toggle').onclick=()=>{clearTimeout(focusTimer);const wasFocused=Boolean(focusedRoot);focusedRoot=null;const parents=visible(nodes,new Set()).filter(n=>children(nodes,n.id).some(child=>!child.archived));if(wasFocused||parents.some(n=>collapsed.has(n.id)))collapsed.clear();else collapsed=new Set(parents.map(n=>n.id));remember();render();$('#chart').scrollTop=0;};
$('#add').onclick=()=>startDraft('Add root');$('#refresh').onclick=refresh;start.onchange=()=>{if(start.value){render();showStartDate();}};$('#days').onchange=()=>{render();showStartDate();};$('#today').onclick=()=>{start.value=iso(new Date());render();showStartDate();};$('#previous').onclick=()=>{start.value=addDays(start.value,-30);render();showStartDate();};$('#next').onclick=()=>{start.value=addDays(start.value,30);render();showStartDate();};
const nodeDetails=createNodeDetails({mutate,isBusy:()=>busy,status});
installGridInteractions({getNodes:()=>nodes,getVisible:chartRows,isBusy:()=>busy,
 saveColors:changes=>mutate(()=>api.updateColors(changes)),
 moveNode:(id,values)=>mutate(async()=>{await api.update(id,values);selected=id;collapsed.delete(values.parent_id);remember();}),selectCell,status,undo:undoLast});
await refresh();
showStartDate();

let displayedDay=iso(new Date());setInterval(()=>{const today=iso(new Date());if(today!==displayedDay){displayedDay=today;render();}},60000);
