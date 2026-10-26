import DOMPurify from 'dompurify';
import * as api from './api.js';

DOMPurify.addHook('uponSanitizeAttribute',(node,data)=>{
 if(data.attrName==='style'){const alignment=node.style?.textAlign;if(['left','center','right'].includes(alignment))data.attrValue=`text-align: ${alignment};`;else data.keepAttr=false;}
 if(data.attrName==='align'&&!['left','center','right'].includes(data.attrValue))data.keepAttr=false;
});
const clean=html=>DOMPurify.sanitize(html,{ALLOWED_TAGS:['b','strong','i','em','u','s','p','div','br','ul','ol','li','blockquote','h2','h3','a','code','pre','table','thead','tbody','tr','td','th'],ALLOWED_ATTR:['href','title','aria-label','style','align'],ALLOW_DATA_ATTR:false});
export function createNodeDetails({mutate,isBusy,status}){
 const $=id=>document.getElementById(id),notes=$('notes-dialog'),editor=$('rich-notes'),noteStatus=$('notes-status'),comments=$('comments-dialog');
 let noteId=null,expectedHtml='',savedEditorHtml='',timer=null,pending=null,loading=false,closing=false,clearing=false;
 let commentNode=null,posting=false,commentId=null,commentDraft='';
 const dirty=()=>clean(editor.innerHTML)!==savedEditorHtml;
 function setNoteStatus(message,error=false){noteStatus.textContent=message;noteStatus.classList.toggle('error',error);$('notes-retry').hidden=!error;$('notes-reload').hidden=!error;}
 async function waitIdle(){while(isBusy())await new Promise(resolve=>setTimeout(resolve,60));}
 async function saveNow(){
  if(pending)return pending;if(loading||!noteId||!dirty())return true;
  const id=noteId,html=clean(editor.innerHTML),text=editor.innerText;
  setNoteStatus('Saving…');
  pending=(async()=>{try{await waitIdle();await mutate(()=>api.saveNotes(id,expectedHtml,html,text));expectedHtml=html;savedEditorHtml=html;setNoteStatus(dirty()?'Unsaved changes…':'Saved automatically');return true;}catch(e){setNoteStatus(e.message,true);return false;}finally{pending=null;}})();
  return pending;
 }
 function fitNotes(){notes.classList.toggle('has-notes-grid',Boolean(editor.querySelector('table')));}
 function schedule(){if(loading)return;fitNotes();clearTimeout(timer);if(!dirty()){setNoteStatus('Saved automatically');return;}setNoteStatus('Unsaved changes…');timer=setTimeout(async()=>{if(await saveNow())if(dirty())schedule();},600);}
 editor.addEventListener('input',schedule);
 editor.addEventListener('paste',e=>{e.preventDefault();const html=e.clipboardData.getData('text/html'),text=e.clipboardData.getData('text/plain');if(html)document.execCommand('insertHTML',false,clean(html));else document.execCommand('insertText',false,text);schedule();});
 $('notes-toolbar').addEventListener('pointerdown',e=>{if(e.target.closest('button'))e.preventDefault();});
 $('notes-toolbar').addEventListener('click',e=>{const button=e.target.closest('[data-command]');if(!button||loading||closing||clearing)return;editor.focus();document.execCommand(button.dataset.command,false,button.dataset.value||null);schedule();});
 function alignment(){
  const selection=window.getSelection(),anchor=selection?.anchorNode;let element=anchor?.nodeType===Node.ELEMENT_NODE?anchor:anchor?.parentElement;
  if(!element||!editor.contains(element))return 'left';
  if(element===editor)element=editor.children[selection.anchorOffset]||editor.firstElementChild||editor;
  const value=getComputedStyle(element).textAlign;return value==='center'?'center':value==='right'||value==='end'?'right':'left';
 }
 function noteCell(){const anchor=window.getSelection()?.anchorNode,element=anchor?.nodeType===Node.ELEMENT_NODE?anchor:anchor?.parentElement,cell=element?.closest('td,th');return cell&&editor.contains(cell)?cell:null;}
 function updateAlignment(){const current=alignment(),next={left:'center',center:'right',right:'left'}[current],button=$('notes-align'),cell=noteCell(),column=cell?String.fromCharCode(65+cell.cellIndex):null;button.textContent=`Align${column?' '+column:''}: ${current[0].toUpperCase()+current.slice(1)}`;button.setAttribute('aria-label',`${column?'Column '+column+' alignment':'Alignment'}: ${current}. Click to align ${next}`);}
 $('notes-align').onclick=()=>{
  if(loading||closing||clearing)return;editor.focus();const next={left:'center',center:'right',right:'left'}[alignment()],cell=noteCell();
  if(cell){
   const table=cell.closest('table'),column=cell.cellIndex;
   for(const row of table.rows){const target=row.cells[column];if(!target)continue;target.style.textAlign=next;target.removeAttribute('align');
    for(const block of target.querySelectorAll('p,div,h2,h3,li,ul,ol,blockquote,pre')){if(block.closest('table')===table){block.style.textAlign=next;block.removeAttribute('align');}}
   }
  }else document.execCommand(`justify${next[0].toUpperCase()+next.slice(1)}`,false,null);
  updateAlignment();schedule();
 };
 document.addEventListener('selectionchange',()=>{if(notes.open)updateAlignment();});
 $('notes-clear').onclick=async()=>{
  if(loading||closing||clearing||!noteId)return;clearing=true;$('notes-clear').disabled=true;$('notes-close').disabled=true;editor.contentEditable='false';clearTimeout(timer);
  try{
   // Flush pending edits first so undo can restore the entire note, including recent typing.
   while(pending||dirty()){if(!await saveNow())return;}
   editor.replaceChildren();fitNotes();await saveNow();
  }finally{clearing=false;$('notes-clear').disabled=false;$('notes-close').disabled=false;editor.contentEditable='true';editor.focus();}
 };
 $('notes-add-grid').onclick=()=>{
  if(loading||closing||clearing)return;editor.focus();const selection=window.getSelection();
  if(!selection.anchorNode||!editor.contains(selection.anchorNode)){const range=document.createRange();range.selectNodeContents(editor);range.collapse(false);selection.removeAllRanges();selection.addRange(range);}
  const table=document.createElement('table'),body=document.createElement('tbody'),insertion=crypto.randomUUID();table.setAttribute('aria-label','Notes grid, 20 rows and 8 columns');table.dataset.gridInsertion=insertion;
  for(let row=0;row<20;row++){const tr=document.createElement('tr');for(let col=0;col<8;col++){const td=document.createElement('td');td.setAttribute('aria-label',`${String.fromCharCode(65+col)}${row+1}`);td.append(document.createElement('br'));tr.append(td);}body.append(tr);}table.append(body);
  document.execCommand('insertHTML',false,table.outerHTML+'<p><br></p>');
  const inserted=editor.querySelector(`[data-grid-insertion="${insertion}"]`),cell=inserted?.querySelector('td');inserted?.removeAttribute('data-grid-insertion');schedule();if(cell){const range=document.createRange();range.selectNodeContents(cell);range.collapse(true);selection.removeAllRanges();selection.addRange(range);cell.scrollIntoView({block:'nearest',inline:'nearest'});}
 };
 editor.addEventListener('keydown',e=>{
  if(e.key!=='Tab')return;const anchor=window.getSelection()?.anchorNode,element=anchor?.nodeType===Node.ELEMENT_NODE?anchor:anchor?.parentElement,cell=element?.closest('td,th');if(!cell||!editor.contains(cell))return;
  const cells=[...cell.closest('table').querySelectorAll('td,th')],next=cells[cells.indexOf(cell)+(e.shiftKey?-1:1)];if(!next)return;
  e.preventDefault();const range=document.createRange();range.selectNodeContents(next);range.collapse(true);const selection=window.getSelection();selection.removeAllRanges();selection.addRange(range);
 });
 async function closeNotes(){
  if(closing||loading||clearing)return;closing=true;clearTimeout(timer);$('notes-close').disabled=true;editor.contentEditable='false';
  try{while(pending||dirty()){if(!await saveNow())return;}notes.close();noteId=null;}finally{closing=false;$('notes-close').disabled=false;editor.contentEditable='true';}
 }
 $('notes-close').onclick=closeNotes;$('notes-retry').onclick=async()=>{if(await saveNow())if(dirty())schedule();};
 $('notes-reload').onclick=async()=>{clearTimeout(timer);if(pending)await pending;try{const latest=await api.getNode(noteId);expectedHtml=latest.notes_html||'';if(expectedHtml)editor.innerHTML=clean(expectedHtml);else editor.textContent=latest.notes||'';savedEditorHtml=clean(editor.innerHTML);fitNotes();setNoteStatus('Saved notes reloaded');}catch(e){setNoteStatus(e.message,true);}};
 notes.addEventListener('cancel',e=>{e.preventDefault();closeNotes();});
 window.addEventListener('beforeunload',e=>{if(notes.open&&(pending||dirty())){e.preventDefault();e.returnValue='';}});
 async function openNotes(node){
  if(isBusy()||notes.open)return;loading=true;notes.classList.remove('has-notes-grid');noteId=node.id;$('notes-title').textContent=`Notes · ${node.title}`;editor.replaceChildren();editor.contentEditable='false';$('notes-close').disabled=true;setNoteStatus('Loading…');notes.showModal();
  try{const latest=await api.getNode(node.id);expectedHtml=latest.notes_html||'';if(expectedHtml)editor.innerHTML=clean(expectedHtml);else editor.textContent=latest.notes||'';savedEditorHtml=clean(editor.innerHTML);fitNotes();setNoteStatus('Changes save automatically');editor.contentEditable='true';}
  catch(e){setNoteStatus(e.message,true);noteId=null;savedEditorHtml=clean(editor.innerHTML);}
  finally{loading=false;$('notes-close').disabled=false;editor.focus();}
 }
 function renderComments(items,{newest=false}={}){
  const list=$('comments-list');list.replaceChildren();
  if(!items.length){const empty=document.createElement('p');empty.textContent='No comments yet.';empty.className='hint';list.append(empty);}
  for(const comment of [...items].sort((a,b)=>Date.parse(a.created_at)-Date.parse(b.created_at))){const article=document.createElement('article'),time=document.createElement('time'),body=document.createElement('p');article.className='comment-entry';article.dataset.commentId=comment.id;time.dateTime=comment.created_at;time.textContent=new Date(comment.created_at).toLocaleString(undefined,{year:'numeric',month:'short',day:'numeric',hour:'numeric',minute:'2-digit',second:'2-digit',timeZoneName:'short'});body.textContent=comment.body;article.append(time,body);list.append(article);}
  list.scrollTop=newest?list.scrollHeight:0;
 }
 async function openComments(node){
  if(isBusy()||comments.open)return;commentNode=node.id;commentId=null;commentDraft='';$('comments-title').textContent=`Comments · ${node.title}`;$('comment-body').value='';$('comments-error').textContent='';$('comments-list').textContent='Loading…';$('comment-add').disabled=true;comments.showModal();
  try{const latest=await api.getNode(node.id);renderComments(latest.comments||[]);$('comment-add').disabled=false;$('comment-body').focus();}catch(e){$('comments-error').textContent=e.message;}
 }
 $('comment-body').addEventListener('input',()=>{commentId=null;});
 $('comment-form').onsubmit=async e=>{
  e.preventDefault();if(posting)return;const body=$('comment-body').value.trim();if(!body)return;posting=true;$('comment-add').disabled=true;$('comments-close').disabled=true;$('comment-body').disabled=true;$('comments-error').textContent='';
  if(!commentId||commentDraft!==body){commentId=crypto.randomUUID();commentDraft=body;}
  try{await waitIdle();await mutate(()=>api.addComment(commentNode,commentId,body));const latest=await api.getNode(commentNode);renderComments(latest.comments||[],{newest:true});$('comment-body').value='';commentId=null;commentDraft='';}catch(e){$('comments-error').textContent=e.message;}finally{posting=false;$('comment-add').disabled=false;$('comments-close').disabled=false;$('comment-body').disabled=false;$('comment-body').focus();}
 };
 $('comments-close').onclick=()=>{if(!posting)comments.close();};comments.addEventListener('cancel',e=>{if(posting)e.preventDefault();});
 return {openNotes,openComments};
}
