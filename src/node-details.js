import DOMPurify from 'dompurify';
import * as api from './api.js';

const clean=html=>DOMPurify.sanitize(html,{ALLOWED_TAGS:['b','strong','i','em','u','s','p','div','br','ul','ol','li','blockquote','h2','h3','a','code','pre'],ALLOWED_ATTR:['href','title'],ALLOW_DATA_ATTR:false});
export function createNodeDetails({mutate,isBusy,status}){
 const $=id=>document.getElementById(id),notes=$('notes-dialog'),editor=$('rich-notes'),noteStatus=$('notes-status'),comments=$('comments-dialog');
 let noteId=null,expectedHtml='',savedEditorHtml='',timer=null,pending=null,loading=false,closing=false;
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
 function schedule(){if(loading)return;clearTimeout(timer);if(!dirty()){setNoteStatus('Saved automatically');return;}setNoteStatus('Unsaved changes…');timer=setTimeout(async()=>{if(await saveNow())if(dirty())schedule();},600);}
 editor.addEventListener('input',schedule);
 editor.addEventListener('paste',e=>{e.preventDefault();const html=e.clipboardData.getData('text/html'),text=e.clipboardData.getData('text/plain');if(html)document.execCommand('insertHTML',false,clean(html));else document.execCommand('insertText',false,text);schedule();});
 $('notes-toolbar').addEventListener('pointerdown',e=>{if(e.target.closest('button'))e.preventDefault();});
 $('notes-toolbar').addEventListener('click',e=>{const button=e.target.closest('[data-command]');if(!button||loading||closing)return;editor.focus();document.execCommand(button.dataset.command,false,button.dataset.value||null);schedule();});
 async function closeNotes(){
  if(closing||loading)return;closing=true;clearTimeout(timer);$('notes-close').disabled=true;editor.contentEditable='false';
  try{while(pending||dirty()){if(!await saveNow())return;}notes.close();noteId=null;}finally{closing=false;$('notes-close').disabled=false;editor.contentEditable='true';}
 }
 $('notes-close').onclick=closeNotes;$('notes-retry').onclick=async()=>{if(await saveNow())if(dirty())schedule();};
 $('notes-reload').onclick=async()=>{clearTimeout(timer);if(pending)await pending;try{const latest=await api.getNode(noteId);expectedHtml=latest.notes_html||'';if(expectedHtml)editor.innerHTML=clean(expectedHtml);else editor.textContent=latest.notes||'';savedEditorHtml=clean(editor.innerHTML);setNoteStatus('Saved notes reloaded');}catch(e){setNoteStatus(e.message,true);}};
 notes.addEventListener('cancel',e=>{e.preventDefault();closeNotes();});
 window.addEventListener('beforeunload',e=>{if(notes.open&&(pending||dirty())){e.preventDefault();e.returnValue='';}});
 async function openNotes(node){
  if(isBusy()||notes.open)return;loading=true;noteId=node.id;$('notes-title').textContent=`Notes · ${node.title}`;editor.replaceChildren();editor.contentEditable='false';$('notes-close').disabled=true;setNoteStatus('Loading…');notes.showModal();
  try{const latest=await api.getNode(node.id);expectedHtml=latest.notes_html||'';if(expectedHtml)editor.innerHTML=clean(expectedHtml);else editor.textContent=latest.notes||'';savedEditorHtml=clean(editor.innerHTML);setNoteStatus('Changes save automatically');editor.contentEditable='true';}
  catch(e){setNoteStatus(e.message,true);noteId=null;savedEditorHtml=clean(editor.innerHTML);}
  finally{loading=false;$('notes-close').disabled=false;editor.focus();}
 }
 function renderComments(items){
  const list=$('comments-list');list.replaceChildren();
  if(!items.length){const empty=document.createElement('p');empty.textContent='No comments yet.';empty.className='hint';list.append(empty);}
  for(const comment of items){const article=document.createElement('article'),time=document.createElement('time'),body=document.createElement('p');article.className='comment-entry';article.dataset.commentId=comment.id;time.dateTime=comment.created_at;time.textContent=new Date(comment.created_at).toLocaleString(undefined,{year:'numeric',month:'short',day:'numeric',hour:'numeric',minute:'2-digit',second:'2-digit',timeZoneName:'short'});body.textContent=comment.body;article.append(time,body);list.append(article);}
  list.scrollTop=list.scrollHeight;
 }
 async function openComments(node){
  if(isBusy()||comments.open)return;commentNode=node.id;commentId=null;commentDraft='';$('comments-title').textContent=`Comments · ${node.title}`;$('comment-body').value='';$('comments-error').textContent='';$('comments-list').textContent='Loading…';$('comment-add').disabled=true;comments.showModal();
  try{const latest=await api.getNode(node.id);renderComments(latest.comments||[]);$('comment-add').disabled=false;$('comment-body').focus();}catch(e){$('comments-error').textContent=e.message;}
 }
 $('comment-body').addEventListener('input',()=>{commentId=null;});
 $('comment-form').onsubmit=async e=>{
  e.preventDefault();if(posting)return;const body=$('comment-body').value.trim();if(!body)return;posting=true;$('comment-add').disabled=true;$('comments-close').disabled=true;$('comment-body').disabled=true;$('comments-error').textContent='';
  if(!commentId||commentDraft!==body){commentId=crypto.randomUUID();commentDraft=body;}
  try{await waitIdle();await mutate(()=>api.addComment(commentNode,commentId,body));const latest=await api.getNode(commentNode);renderComments(latest.comments||[]);$('comment-body').value='';commentId=null;commentDraft='';}catch(e){$('comments-error').textContent=e.message;}finally{posting=false;$('comment-add').disabled=false;$('comments-close').disabled=false;$('comment-body').disabled=false;$('comment-body').focus();}
 };
 $('comments-close').onclick=()=>{if(!posting)comments.close();};comments.addEventListener('cancel',e=>{if(posting)e.preventDefault();});
 return {openNotes,openComments};
}
