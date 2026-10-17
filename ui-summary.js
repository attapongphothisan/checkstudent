/* Display-only task statistics. Never writes grades or attendance records. */
function CheckSummary(students,tasks,scores) {
  const blank=v=>v===undefined||v===null||v==='';
  const active=tasks.filter(t=>Number(t.max)>0);
  const items=active.map(t=>{
    const values=students.map(s=>scores[t.id]?.[s.id]).filter(v=>!blank(v)).map(Number);
    return {...t,submitted:values.length,average:values.length?values.reduce((a,b)=>a+b,0)/values.length:null};
  });
  let earned=0,possible=0;const distribution=[0,0,0,0];
  for(const student of students) {
    const submitted=active.filter(t=>!blank(scores[t.id]?.[student.id]));
    if(!submitted.length)continue;
    const sum=submitted.reduce((n,t)=>n+Number(scores[t.id][student.id]),0);
    const max=submitted.reduce((n,t)=>n+Number(t.max),0);
    earned+=sum;possible+=max;
    const percent=sum/max*100;distribution[percent>=80?0:percent>=70?1:percent>=60?2:3]++;
  }
  return {tasks:items,earned,possible,percent:possible?earned/possible*100:null,distribution};
}
if(typeof module!=='undefined')module.exports=CheckSummary;
