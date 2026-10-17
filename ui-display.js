/* Pure display helpers for the subject icons and report charts. */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.DisplayUI=api;})(typeof globalThis!=='undefined'?globalThis:this,function(){
 function subject(name){
  const text=String(name).toLowerCase();
  if(/พลศึกษา|กีฬา|physical|sport/.test(text))return {icon:'physical',tone:'blue'};
  if(/สุขศึกษา|สุขภาพ|health/.test(text))return {icon:'wellness',tone:'pink'};
  if(/คอมพิวเตอร์|เทคโนโลยี|computer|coding|คณิต|math/.test(text))return {icon:'scores',tone:'neutral'};
  if(/ศิลปะ|ดนตรี|art|music/.test(text))return {icon:'lessons',tone:'neutral'};
  return {icon:'guide',tone:'neutral'};
 }
 function daily(schedule,sessions){
  const key=s=>[s.roomId,s.subject,s.period].join('|'),completed=sessions.filter(s=>s.complete),keys=new Set(completed.map(key)),planned=new Set(schedule.map(key));
  const checked=[...planned].filter(k=>keys.has(k)).length,counts={present:0,absent:0,leave:0,late:0,skip:0};
  completed.forEach(s=>s.roster.forEach(id=>{const status=s.statuses[id];if(Object.hasOwn(counts,status))counts[status]++;}));
  return {planned:planned.size,checked,pending:planned.size-checked,percent:planned.size?Math.round(checked/planned.size*100):null,counts};
 }
 function distribution(values,max){
  const entered=values.filter(v=>v!==null&&v!==undefined&&v!==''&&Number.isFinite(Number(v))).map(Number);
  const bins=Array(5).fill(0);
  if(max>0)for(const value of entered)bins[Math.min(4,Math.max(0,Math.ceil(value/max*5)-1))]++;
  return {bins,count:entered.length,average:entered.length?entered.reduce((a,b)=>a+b,0)/entered.length:null,highest:entered.length?Math.max(...entered):null,lowest:entered.length?Math.min(...entered):null};
 }
 function attendanceChoices(status){
  return [{key:'present',label:'มา',status:'present',selected:status==='present'},{key:'absent',label:'ขาด',status:'absent',selected:status==='absent'},{key:'leave',label:'ลา',status:'leave',selected:status==='leave'},{key:'other',label:'อื่นๆ',status:status==='skip'?'skip':'late',selected:['late','skip'].includes(status)}];
 }
 return {subject,distribution,daily,attendanceChoices};
});
