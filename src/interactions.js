import {addDays,children,height,level} from './model.js';

const utcDay=value=>{const [y,m,d]=value.split('-').map(Number);return Date.UTC(y,m-1,d)/86400000;};
export const dayOffset=(day,today)=>utcDay(day)-utcDay(today);
const shortMonth=new Intl.DateTimeFormat('en-US',{month:'short'}),shortWeekday=new Intl.DateTimeFormat('en-US',{weekday:'short'});
export function cellTooltip(day,name,today){
 const date=new Date(day+'T12:00:00');
 const month=shortMonth.format(date);
 const weekday=shortWeekday.format(date);
 return [name,`${month}. ${date.getDate()} ${weekday}`,String(dayOffset(day,today))].filter(value=>value!==undefined&&value!=='').join(' · ');
}
export const rangesOf=node=>Array.isArray(node.bars)?node.bars:(node.start_date?[{start_date:node.start_date,end_date:node.end_date||node.start_date,color:node.color}]:[]);
export function nodeDayOffset(node,today){
 const ranges=rangesOf(node).filter(b=>b.start_date),upcoming=[],past=[];
 for(const bar of ranges){const end=bar.end_date||bar.start_date;if(bar.start_date<=today&&end>=today)return 0;if(bar.start_date>today)upcoming.push(bar.start_date);else past.push(end);}
 const date=upcoming.sort()[0]||past.sort().at(-1);
 return date?dayOffset(date,today):null;
}
export function colorsOn(node,day){return [...new Set(rangesOf(node).filter(b=>day>=b.start_date&&day<=(b.end_date||b.start_date)).map(b=>/^#[0-9a-f]{6}$/i.test(b.color)?b.color:'#ef8080'))];}
export function colorFill(colors){return colors.length===1?colors[0]:`linear-gradient(to bottom,${colors.map((c,i)=>`${c} ${i*100/colors.length}% ${(i+1)*100/colors.length}%`).join(',')})`;}

// Split intersecting ranges so painting/clearing never erases neighboring dates.
export function paintRange(bars,start,end,colors){
 const result=[];
 for(const bar of bars){const last=bar.end_date||bar.start_date;if(last<start||bar.start_date>end){result.push({...bar});continue;}
  if(bar.start_date<start)result.push({...bar,end_date:addDays(start,-1)});
  if(last>end)result.push({...bar,start_date:addDays(end,1)});
 }
 for(const color of colors)result.push({start_date:start,end_date:end,color});
 // Merge adjacent runs with the same color to keep repeated paints compact.
 result.sort((a,b)=>a.color.localeCompare(b.color)||a.start_date.localeCompare(b.start_date));
 const merged=[];
 for(const bar of result){const last=merged.at(-1);if(last&&last.color===bar.color&&bar.start_date<=addDays(last.end_date,1)){last.end_date=last.end_date>bar.end_date?last.end_date:bar.end_date;}else merged.push({...bar});}
 return merged.sort((a,b)=>a.start_date.localeCompare(b.start_date)||a.color.localeCompare(b.color));
}

// Top/bottom edges reorder siblings; the middle nests the whole branch.
export function nodeDrop(nodes,source,target,placement){
 if(!source)throw Error('The dragged node no longer exists. Refresh the chart.');
 if(target?.id===source.id)throw Error('Drop on another node.');
 const parent_id=target?(placement==='inside'?target.id:target.parent_id):null;
 let ancestor=nodes.find(n=>n.id===parent_id);
 while(ancestor){if(ancestor.id===source.id)throw Error('A node cannot be moved into its own branch.');ancestor=nodes.find(n=>n.id===ancestor.parent_id);}
 const parent=nodes.find(n=>n.id===parent_id),depth=parent?level(nodes,parent)+1:1;
 if(depth+height(nodes,source)-1>4)throw Error('This move would exceed four levels.');
 const siblings=children(nodes,parent_id).filter(n=>n.id!==source.id);
 let index=placement==='inside'||!target?siblings.length:siblings.findIndex(n=>n.id===target.id)+(placement==='after'?1:0);
 const before=siblings[index-1],after=siblings[index];
 const position=before&&after?(before.position+after.position)/2:before?before.position+1:after?after.position-1:0;
 return {parent_id,position};
}
