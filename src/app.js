import './style.css';
import * as api from './api.js';
import {children,level,height,visible,actions,iso,addDays} from './model.js';
import {cellTooltip,rangesOf as barRanges,colorsOn as barColors,colorFill} from './interactions.js';
import {installGridInteractions} from './grid-events.js';
const $=s=>document.querySelector(s), el=(tag,text)=>{const n=document.createElement(tag);if(text!==undefined)n.textContent=text;return n;};
let nodes=[],selected=null,collapsed=new Set(JSON.parse(localStorage.getItem('gantt03-collapsed')||'[]')),busy=false,editing=null,draft=null;
const start=$('#range-start');start.value=addDays(iso(new Date()),-1);
function status(message,error=false){$('#status').textContent=message;$('#status').classList.toggle('error',error);}
function remember(){localStorage.setItem('gantt03-collapsed',JSON.stringify([...collapsed]));}
async function refresh(){try{nodes=await api.load();render();status('Saved · Supabase');}catch(e){status(e.message,true);}}
async function mutate(fn){if(busy)return;busy=true;status('Saving…');try{await fn();await refresh();}catch(e){status(e.message,true);throw e;}finally{busy=false;}}
function dates(){return Array.from({length:Number($('#days').value)},(_,i)=>addDays(start.value,i));}
function select(id){selected=id;document.querySelectorAll('.node[data-id]').forEach(n=>n.classList.toggle('selected',n.dataset.id===id));}
function render(){const parents=nodes.filter(n=>children(nodes,n.id).length),anyCollapsed=parents.some(n=>collapsed.has(n.id));$('#expand-toggle').textContent=anyCollapsed?'Expand All':'Collapse All';$('#expand-toggle').setAttribute('aria-expanded',String(!anyCollapsed));const table=el('table'),head=el('thead'),days=dates();
 for(let row=0;row<2;row++){const tr=el('tr'),blank=el('th');blank.className='node head';blank.setAttribute('aria-label',row?'Dates':'Nodes');tr.append(blank);for(const day of days){const d=new Date(day+'T12:00:00'),th=el('th',row?day.slice(5):['S','M','T','W','T','F','S'][d.getDay()]);th.className=(d.getDay()%6===0?'weekend':'weekday')+(day===iso(new Date())?' today':'');th.dataset.day=day;th.setAttribute('aria-label',cellTooltip(day,undefined,iso(new Date())));th.setAttribute('aria-describedby','day-tooltip');tr.append(th);}head.append(tr);}table.append(head);
 const body=el('tbody');for(const node of visible(nodes,collapsed)){const tr=el('tr'),td=el('td'),hasChildren=children(nodes,node.id).length>0;td.className='node'+(hasChildren?' parent':'')+(selected===node.id?' selected':'');td.dataset.id=node.id;td.draggable=true;td.tabIndex=0;td.style.paddingLeft=`${5+(node.depth-1)*25}px`;td.style.color=node.text_color;td.title=`${node.title} · Level ${node.depth}${node.notes?' · Has notes':''}`;
 if(hasChildren){const toggle=el('button',collapsed.has(node.id)?'[+]':'[-]');toggle.className='toggle';toggle.setAttribute('aria-label',`${collapsed.has(node.id)?'Expand':'Collapse'} ${node.title}`);toggle.setAttribute('aria-expanded',String(!collapsed.has(node.id)));toggle.onclick=e=>{e.stopPropagation();collapsed.has(node.id)?collapsed.delete(node.id):collapsed.add(node.id);remember();render();};td.append(toggle);}else if(node.depth<3){const space=el('span','');space.style.display='inline-block';space.style.width='22px';td.append(space);}
 const detail=el('button','▤');detail.className='node-detail';detail.setAttribute('aria-label',`Details for ${node.title}`);detail.onclick=e=>{e.stopPropagation();select(node.id);openEditor('Edit',node);};td.append(detail,document.createTextNode(node.title));td.onclick=()=>select(node.id);td.ondblclick=()=>openEditor('Edit',node);td.oncontextmenu=e=>{e.preventDefault();select(node.id);openMenu(node,e.clientX,e.clientY);};td.onkeydown=e=>{if(e.target!==td)return;if(e.key==='ContextMenu'||(e.shiftKey&&e.key==='F10')){e.preventDefault();const r=td.getBoundingClientRect();select(node.id);openMenu(node,r.left+30,r.bottom);}if(e.key==='Enter'){select(node.id);openEditor('Edit',node);}};tr.append(td);
 for(const day of days){const cell=el('td');const d=new Date(day+'T12:00:00');cell.className='cell'+(d.getDay()%6===0?' weekend-cell':'');cell.dataset.day=day;cell.dataset.nodeId=node.id;cell.tabIndex=0;cell.setAttribute('aria-label',`${node.title}, ${day}`);const colors=barColors(node,day);if(colors.length){cell.classList.add('bar');cell.style.setProperty('--bar',colorFill(colors));}cell.setAttribute('aria-describedby','day-tooltip');const fill=el('button','+');fill.className='fill-handle';fill.type='button';fill.setAttribute('aria-label','Paint from this cell');fill.onclick=e=>{e.stopPropagation();};cell.append(fill);cell.onclick=()=>{select(node.id);openEditor('Edit',node,day);};tr.append(cell);}if(draft?.action==='Add parent'&&draft.node.id===node.id)body.append(draftRow(days.length,node.depth));body.append(tr);if(draft?.action==='Add child'&&draft.node.id===node.id)body.append(draftRow(days.length,node.depth+1));}if(draft?.action==='Add root')body.append(draftRow(days.length,1));table.append(body);$('#chart').replaceChildren(table);if(!nodes.length&&!draft){const empty=el('p','No nodes yet. Use Add root to begin.');empty.className='empty';$('#chart').append(empty);}}
function openMenu(node,x,y){const menu=$('#menu');menu.replaceChildren();for(const action of actions(nodes,node)){const button=el('button',action);button.setAttribute('role','menuitem');button.onclick=()=>{menu.hidden=true;if(action==='Delete')deleteNode(node);else if(action==='Edit')openEditor(action,node);else startDraft(action,node);};menu.append(button);}menu.hidden=false;const r=menu.getBoundingClientRect();menu.style.left=`${Math.max(0,Math.min(x,innerWidth-r.width-8))}px`;menu.style.top=`${Math.max(0,Math.min(y,innerHeight-r.height-8))}px`;menu.firstChild.focus();}
document.addEventListener('pointerdown',e=>{if(!$('#menu').contains(e.target))$('#menu').hidden=true;});document.addEventListener('keydown',e=>{if(e.key==='Escape')$('#menu').hidden=true;const m=$('#menu');if(!m.hidden&&['ArrowDown','ArrowUp'].includes(e.key)){e.preventDefault();const a=[...m.children],i=a.indexOf(document.activeElement);a[(i+(e.key==='ArrowDown'?1:a.length-1))%a.length].focus();}});
function startDraft(action,node=null){
 if(busy)return;if(draft){status('Finish or cancel the new row first.',true);$('#draft-name')?.focus();return;}
 if(action==='Add parent'&&level(nodes,node)+height(nodes,node)>4){showPanel('Four-level limit',c=>c.append(el('p','Adding a parent would move a descendant beyond level four.')));return;}
 if(action==='Add child'&&level(nodes,node)>=4)return;
 draft={action,node,title:''};if(node)collapsed.delete(action==='Add child'?node.id:node.parent_id);remember();render();$('#draft-name').focus();$('#draft-name').scrollIntoView({block:'nearest',inline:'nearest'});
}
function draftRow(dayCount,depth){
 const tr=el('tr'),td=el('td');tr.className='draft-row';td.className='node draft-node';td.style.paddingLeft=`${5+(depth-1)*25}px`;
 const name=el('input');name.id='draft-name';name.placeholder='New '+(draft.action==='Add parent'?'parent':draft.action==='Add child'?'child':'root');name.setAttribute('aria-label','New node name');name.maxLength=300;name.value=draft.title;name.disabled=busy;name.oninput=()=>{draft.title=name.value;};name.onkeydown=e=>{e.stopPropagation();if(e.key==='Enter'){e.preventDefault();saveDraft(false);}if(e.key==='Escape'){draft=null;render();}};
 const save=el('button','✓');save.setAttribute('aria-label','Save new row');save.onclick=()=>saveDraft(false);
 const detail=el('button','▤');detail.setAttribute('aria-label','Save new row and open details');detail.onclick=()=>saveDraft(true);
 const cancel=el('button','×');cancel.setAttribute('aria-label','Cancel new row');cancel.onclick=()=>{if(busy)return;draft=null;render();};
 for(const b of [save,detail,cancel]){b.className='draft-action';b.disabled=busy;}
 td.append(name,save,detail,cancel);tr.append(td);const rest=el('td');rest.colSpan=dayCount;rest.className='draft-hint';rest.textContent='Type a name · Enter or ✓ to save · ▤ for dates, colors and notes';tr.append(rest);return tr;
}
async function saveDraft(details){
 if(!draft||busy)return;const pending=draft,title=pending.title.trim();if(!title){status('Enter a name for the new row.',true);$('#draft-name').focus();return;}
 let id;try{await mutate(async()=>{if(pending.action==='Add parent'){id=await api.addParent(pending.node.id,title);}else{const parent_id=pending.action==='Add child'?pending.node.id:null;const siblings=children(nodes,parent_id);const position=pending.action==='Add child'?Math.min(0,...siblings.map(n=>n.position))-1:Math.max(0,...siblings.map(n=>n.position))+1;const [created]=await api.create({title,parent_id,position});id=created.id;}draft=null;selected=id;collapsed.delete(id);remember();});if(details){const node=nodes.find(n=>n.id===id);if(node)openEditor('Edit',node);}}catch{render();$('#draft-name')?.focus();}
}
function addRange(bar={}){
 const row=el('div');row.className='bar-range';
 for(const [name,label,type,value] of [['start_date','Start','date',bar.start_date||''],['end_date','End','date',bar.end_date||bar.start_date||''],['color','Color','color',bar.color||'#ef8080']]){const l=el('label',label),input=el('input');input.type=type;input.dataset.field=name;input.value=value;input.required=true;l.append(input);row.append(l);}
 const remove=el('button','×');remove.type='button';remove.setAttribute('aria-label','Remove color range');remove.onclick=()=>row.remove();row.append(remove);$('#bar-ranges').append(row);return row;
}
$('#add-range').onclick=()=>addRange({start_date:iso(new Date()),end_date:iso(new Date())});
function openEditor(action,node,day=null){
 if(busy)return;editing={action,node};const form=$('#form');form.reset();$('#form-error').textContent='';$('#dialog-title').textContent='Edit node';$('#dialog-context').textContent=`${node.title} · Level ${level(nodes,node)}`;
 for(const name of ['title','text_color','notes','links'])form.elements.namedItem(name).value=node[name]||'';
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
 $('#save').disabled=true;$('#cancel').disabled=true;try{await mutate(()=>api.update(editing.node.id,data));$('#editor').close();}catch(e){$('#form-error').textContent=e.message;}finally{$('#save').disabled=false;$('#cancel').disabled=false;}
};
function deleteNode(node){const count=(function descendants(id){return children(nodes,id).reduce((s,n)=>s+1+descendants(n.id),0);})(node.id);showPanel('Delete node',content=>{content.append(el('p',`Delete “${node.title}”${count?` and its ${count} descendant${count===1?'':'s'}`:''}?`));const button=el('button','Delete');button.onclick=async()=>{button.disabled=true;try{await mutate(()=>api.remove(node.id));if(selected===node.id)selected=null;$('#panel').close();}catch(e){content.append(el('p',e.message));button.disabled=false;}};content.append(button);});}
function showPanel(title,fill){$('#panel-title').textContent=title;$('#panel-content').replaceChildren();fill($('#panel-content'));$('#panel').showModal();}
$('#panel-close').onclick=()=>$('#panel').close();
function selectedNode(){const node=nodes.find(n=>n.id===selected);if(!node)showPanel('Select a node',c=>c.append(el('p','Click a node name first.')));return node;}
$('#notes').onclick=()=>{const n=selectedNode();if(n){openEditor('Edit',n);$('#form').elements.notes.focus();}};
function appendLinks(content,text){for(const line of text.split('\n').filter(l=>l.trim())){try{const url=new URL(line.trim());if(!['http:','https:'].includes(url.protocol))throw Error();const a=el('a',line);a.href=url.href;a.target='_blank';a.rel='noopener noreferrer';content.append(a,el('br'));}catch{content.append(el('p',line));}}}
$('#links').onclick=()=>{const n=selectedNode();if(n)showPanel(`Links · ${n.title}`,c=>{if(n.links)appendLinks(c,n.links);else c.append(el('p','No links yet.'));const b=el('button','Edit links');b.onclick=()=>{$('#panel').close();openEditor('Edit',n);$('#form').elements.links.focus();};c.append(b);});};
$('#general').onclick=async()=>{try{const [settings]=await api.request('gantt03_settings?id=eq.1');showPanel('General Links',c=>{appendLinks(c,settings.general_links);const label=el('label','URLs, one per line'),text=el('textarea');text.rows=7;text.value=settings.general_links;label.append(text);c.append(label);const save=el('button','Save links');save.onclick=async()=>{save.disabled=true;try{await mutate(()=>api.request('gantt03_settings?id=eq.1','PATCH',{general_links:text.value}));$('#panel').close();}catch(e){c.append(el('p',e.message));save.disabled=false;}};c.append(save);});}catch(e){status(e.message,true);}};
function calendar(detail){showPanel(detail?'Calendar Detail':'Calendar',c=>{const end=addDays(start.value,Number($('#days').value)-1),scheduled=nodes.flatMap(n=>barRanges(n).map(bar=>({...n,...bar}))).filter(n=>n.start_date&&n.start_date<=end&&(n.end_date||n.start_date)>=start.value).sort((a,b)=>a.start_date.localeCompare(b.start_date));c.append(el('p',`${start.value} — ${end}`));if(!scheduled.length)c.append(el('p','No scheduled nodes in this date range.'));for(const n of scheduled){const section=el('section'),b=el('button',`${n.start_date}${n.end_date&&n.end_date!==n.start_date?' — '+n.end_date:''} · ${n.title}`);b.className='calendar-event';b.style.borderLeft='8px solid '+(/^#[0-9a-f]{6}$/i.test(n.color)?n.color:'#ef8080');b.onclick=()=>{$('#panel').close();openEditor('Edit',n);};section.append(b);if(detail){const path=[];let p=n;while(p){path.unshift(p.title);p=nodes.find(x=>x.id===p.parent_id);}section.append(el('p',path.join(' › ')),el('p',n.notes||'No notes'));appendLinks(section,n.links);}c.append(section);}});}
$('#calendar').onclick=()=>calendar(false);$('#detail').onclick=()=>calendar(true);
$('#expand-toggle').onclick=()=>{const parents=nodes.filter(n=>children(nodes,n.id).length);if(parents.some(n=>collapsed.has(n.id)))collapsed.clear();else collapsed=new Set(parents.map(n=>n.id));remember();render();};
$('#add').onclick=()=>startDraft('Add root');$('#refresh').onclick=refresh;start.onchange=()=>{if(start.value)render();};$('#days').onchange=render;$('#today').onclick=()=>{start.value=addDays(iso(new Date()),-1);render();$('#chart').scrollLeft=0;};$('#previous').onclick=()=>{start.value=addDays(start.value,-30);render();};$('#next').onclick=()=>{start.value=addDays(start.value,30);render();};
installGridInteractions({getNodes:()=>nodes,getVisible:()=>visible(nodes,collapsed),isBusy:()=>busy,
 saveColors:changes=>mutate(()=>api.updateColors(changes)),
 moveNode:(id,values)=>mutate(async()=>{await api.update(id,values);selected=id;collapsed.delete(values.parent_id);remember();}),select,status});
await refresh();
