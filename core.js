/* Shared grading and validation rules. No browser dependency. */
var CheckCore = (() => {
  const SUBJECTS = ['สุขศึกษา', 'พลศึกษา'];
  const STATUSES = { present: 'มา', leave: 'ลา', late: 'สาย', absent: 'ขาด', skip: 'หนี' };
  const bands = [[80,4],[75,3.5],[70,3],[65,2.5],[60,2],[55,1.5],[50,1],[0,0]];
  const id = () => globalThis.crypto?.randomUUID?.() || 'id-'+Date.now().toString(36)+'-'+Math.random().toString(36).slice(2);
  const day = (d = new Date()) => new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Bangkok',year:'numeric',month:'2-digit',day:'2-digit'}).format(d);
  const blank = v => v === '' || v === null || v === undefined;
  const number = v => blank(v) ? 0 : Number(v);
  const courseKey = (room, subject) => room + '|' + subject;
  function initial() { const termId=id(); return {schema:1,terms:[{id:termId,year:new Date().getFullYear()+543,semester:1}],subjects:[],rooms:[],students:[],tasks:[],scores:{},exams:{},sessions:[],schedule:[],courseSettings:{},settings:{teacher:'คุณครู',school:'',bands:bands.map(x=>[...x])},audit:[]}; }
  function subjects(d,termId) {
    if(Array.isArray(d.subjects))return d.subjects.filter(s=>!termId||s.termId===termId);
    return d.terms.filter(t=>(!termId||t.id===termId)&&d.rooms.some(r=>r.termId===t.id)).flatMap(t=>SUBJECTS.map((name,i)=>({id:'legacy-'+t.id+'-'+i,name,termId:t.id,roomIds:d.rooms.filter(r=>r.termId===t.id).map(r=>r.id)})));
  }
  function subjectRooms(d,name,termId) {const ids=new Set(subjects(d,termId).filter(s=>s.name===name).flatMap(s=>s.roomIds));return d.rooms.filter(r=>ids.has(r.id)&&!r.archived&&(!termId||r.termId===termId));}
  function courseExists(d,rid,name){const r=d.rooms.find(r=>r.id===rid);return !!r&&subjects(d,r.termId).some(s=>s.name===name&&s.roomIds.includes(rid));}
  function materializeSubjects(d){if(!Array.isArray(d.subjects))d.subjects=subjects(d).map(s=>({...s,roomIds:[...s.roomIds]}));return d.subjects;}
  function settings(d,room,subject) { return d.courseSettings[courseKey(room,subject)] || {midMax:20,finalMax:40}; }
  function tasks(d,room,subject) {return d.tasks.filter(t=>!t.deleted && t.roomId===room && t.subject===subject);}
  function createGradeTasks(d,roomId,subject,name,max) {
    const source=d.rooms.find(r=>r.id===roomId&&!r.archived);
    if(!source)throw Error('ห้องนี้ไม่พร้อมใช้งาน');
    name=String(name||'').trim();max=Number(max);
    if(!courseExists(d,roomId,subject)||!name||name.length>160||!Number.isFinite(max)||max<=0)throw Error('ตรวจชื่องาน วิชา และคะแนนเต็ม');
    const added=subjectRooms(d,subject,source.termId).filter(r=>r.grade===source.grade).map(r=>({id:id(),roomId:r.id,subject,name,max,deleted:false}));
    d.tasks.push(...added);
    return added;
  }
  function activeStudents(d,room) { return d.students.filter(s=>s.roomId===room&&!s.archived); }
  function complete(s) {return s.roster.length>0 && s.roster.every(id=>Object.hasOwn(STATUSES,s.statuses[id]));}
  function attendance(d,student,subject) {
    const sessions=d.sessions.filter(s=>s.subject===subject&&s.roomId===student.roomId&&s.complete&&complete(s)&&s.roster.includes(student.id));
    const attended=sessions.filter(s=>['present','leave','late'].includes(s.statuses[student.id])).length;
    return {total:sessions.length,attended,percent:sessions.length?attended/sessions.length*100:null,score:sessions.length?attended/sessions.length*10:0};
  }
  function result(d,student,subject) {
    const ts=tasks(d,student.roomId,subject),max=ts.reduce((n,t)=>n+t.max,0),raw=ts.reduce((n,t)=>n+number(d.scores[t.id]?.[student.id]),0);
    const work=max?raw/max*60:0,att=attendance(d,student,subject),cfg=settings(d,student.roomId,subject),exam=d.exams[courseKey(student.roomId,subject)]?.[student.id]||{};
    const mid=number(exam.mid)/cfg.midMax*10,final=number(exam.final)/cfg.finalMax*20,total=work+att.score+mid+final;
    const grade=att.percent===null?'—':att.percent<80?'มส.':(d.settings.bands.find(([cut])=>total+1e-9>=cut)?.[1]??0);
    const missing=ts.filter(t=>blank(d.scores[t.id]?.[student.id])).length+['mid','final'].filter(k=>blank(exam[k])).length;
    return {work,att,mid,final,total,grade,missing,raw,max};
  }
  function scoreValue(value,max) {if(blank(value)) return null; const n=Number(value);if(!Number.isFinite(n)||n<0||n>max)throw Error('คะแนนต้องอยู่ระหว่าง 0 ถึง '+max);return n;}
  function validate(d) {
    const fail=msg=>{throw Error('ไฟล์ข้อมูลไม่ถูกต้อง: '+msg);};
    if(!d||d.schema!==1)fail('รุ่นข้อมูลไม่รองรับ');
    for(const k of ['terms','rooms','students','tasks','sessions','schedule','audit'])if(!Array.isArray(d[k]))fail(k);
    for(const k of ['scores','exams','courseSettings','settings'])if(!d[k]||typeof d[k]!=='object'||Array.isArray(d[k]))fail(k);
    if(!d.terms.length)fail('ไม่มีภาคเรียน');
    const sets={};for(const k of ['terms','rooms','students','tasks','sessions','schedule']){sets[k]=new Set();for(const x of d[k]){if(!x||typeof x.id!=='string'||!/^[A-Za-z0-9_-]{1,100}$/.test(x.id)||['__proto__','constructor','prototype'].includes(x.id)||sets[k].has(x.id))fail('รหัสซ้ำ/ไม่ถูกต้อง '+k);sets[k].add(x.id);}}
    if(d.subjects!==undefined){
      if(!Array.isArray(d.subjects))fail('วิชา');
      const names=new Set(),ids=new Set();
      for(const s of d.subjects){if(!s||typeof s.id!=='string'||ids.has(s.id)||!sets.terms.has(s.termId)||typeof s.name!=='string'||!s.name.trim()||s.name.length>100||s.name.includes('|')||!Array.isArray(s.roomIds)||new Set(s.roomIds).size!==s.roomIds.length||s.roomIds.some(rid=>!d.rooms.some(r=>r.id===rid&&r.termId===s.termId)))fail('วิชาและห้องที่เรียน');const key=s.termId+'|'+s.name;if(names.has(key))fail('ชื่อวิชาซ้ำ');names.add(key);ids.add(s.id);}
    }
    const studentById=new Map(d.students.map(x=>[x.id,x])), taskById=new Map(d.tasks.map(x=>[x.id,x]));
    if(d.terms.some(t=>!Number.isInteger(t.year)||t.year<2400||![1,2,3].includes(t.semester)))fail('ภาคเรียน');
    for(const r of d.rooms)if(!sets.terms.has(r.termId)||typeof r.name!=='string'||!r.name.trim()||!Number.isInteger(r.grade)||r.grade<1||r.grade>6)fail('ห้องเรียน');
    for(const s of d.students)if(s.number!==undefined&&(!Number.isSafeInteger(s.number)||s.number<1)||!sets.rooms.has(s.roomId)||typeof s.name!=='string'||!s.name.trim()||typeof s.code!=='string'||!s.code.trim())fail('นักเรียน');
    const codes=new Set();for(const s of d.students.filter(s=>!s.archived)){const k=s.roomId+'|'+s.code;if(codes.has(k))fail('เลขประจำตัวซ้ำในห้อง');codes.add(k);}
    for(const t of d.tasks)if(!sets.rooms.has(t.roomId)||!courseExists(d,t.roomId,t.subject)||typeof t.name!=='string'||!t.name.trim()||!Number.isFinite(t.max)||t.max<=0)fail('รายการคะแนน');
    for(const [tid,rows] of Object.entries(d.scores)){if(!sets.tasks.has(tid)||!rows||typeof rows!=='object')fail('คะแนนงาน');const t=taskById.get(tid);for(const [sid,v] of Object.entries(rows)){if(studentById.get(sid)?.roomId!==t.roomId)fail('เจ้าของคะแนน');scoreValue(v,t.max);}}
    for(const s of d.sessions){if(!sets.rooms.has(s.roomId)||!courseExists(d,s.roomId,s.subject)||!/^[0-9]{4}-[0-9]{2}-[0-9]{2}$/.test(s.date)||!Number.isInteger(s.period)||s.period<1||s.period>20||!Array.isArray(s.roster)||!s.statuses||typeof s.statuses!=='object'||new Set(s.roster).size!==s.roster.length)fail('คาบเรียน');for(const sid of s.roster)if(studentById.get(sid)?.roomId!==s.roomId)fail('รายชื่อในคาบ');for(const [sid,v] of Object.entries(s.statuses))if(!s.roster.includes(sid)||!Object.hasOwn(STATUSES,v))fail('สถานะ');if(s.complete&&!complete(s))fail('คาบไม่ครบแต่ระบุว่าเสร็จแล้ว');}
    const sessions=new Set();for(const s of d.sessions){const k=[s.roomId,s.subject,s.date,s.period].join('|');if(sessions.has(k))fail('คาบซ้ำ');sessions.add(k);}
    for(const x of d.schedule)if(!sets.rooms.has(x.roomId)||!courseExists(d,x.roomId,x.subject)||!Number.isInteger(x.day)||x.day<0||x.day>6||!Number.isInteger(x.period)||x.period<1||x.period>20)fail('ตารางสอน');
    for(const [k,c] of Object.entries(d.courseSettings)){if(!d.rooms.some(r=>subjects(d,r.termId).some(sub=>sub.roomIds.includes(r.id)&&courseKey(r.id,sub.name)===k))||!Number.isFinite(c.midMax)||c.midMax<=0||!Number.isFinite(c.finalMax)||c.finalMax<=0)fail('คะแนนเต็มสอบ');}
    for(const [k,rows] of Object.entries(d.exams)){const r=d.rooms.find(r=>subjects(d,r.termId).some(sub=>sub.roomIds.includes(r.id)&&courseKey(r.id,sub.name)===k));if(!r||!rows||typeof rows!=='object')fail('คะแนนสอบ');const cfg=d.courseSettings[k]||{midMax:20,finalMax:40};for(const [sid,e]of Object.entries(rows)){if(studentById.get(sid)?.roomId!==r.id||!e||typeof e!=='object')fail('เจ้าของคะแนนสอบ');scoreValue(e.mid,cfg.midMax);scoreValue(e.final,cfg.finalMax);}}
    if(!Array.isArray(d.settings.bands)||d.settings.bands.length!==8||d.settings.bands.some((b,i)=>!Array.isArray(b)||!Number.isFinite(b[0])||b[0]<0||b[0]>100||b[1]!==bands[i][1]||(i>0&&b[0]>=d.settings.bands[i-1][0]))||d.settings.bands[7][0]!==0)fail('เกณฑ์เกรด');
    if(typeof d.settings.teacher!=='string'||typeof d.settings.school!=='string')fail('ข้อมูลครู');
    return d;
  }
  function cloneTerm(d,source,year,semester) {const term={id:id(),year,semester};d.terms.push(term);const map={};for(const r of [...d.rooms].filter(r=>r.termId===source&&!r.archived)){const rid=id();map[r.id]=rid;d.rooms.push({...r,id:rid,termId:term.id});for(const s of [...d.students].filter(s=>s.roomId===r.id&&!s.archived))d.students.push({...s,id:id(),roomId:rid});}if(Array.isArray(d.subjects))for(const sub of subjects(d,source))d.subjects.push({...sub,id:id(),termId:term.id,roomIds:sub.roomIds.filter(rid=>map[rid]).map(rid=>map[rid])});for(const sc of [...d.schedule].filter(x=>map[x.roomId]))d.schedule.push({...sc,id:id(),roomId:map[sc.roomId]});return term.id;}
  function reportRows(d) {const rows=[['ปีการศึกษา','ภาคเรียน','ห้อง','วิชา','เลขประจำตัว','ชื่อ–นามสกุล','ระหว่างเรียน (60)','เข้าเรียน (10)','กลางภาค (10)','ปลายภาค (20)','รวม (100)','เวลาเรียน (%)','เกรด','ค้างคะแนน']];for(const room of d.rooms){const term=d.terms.find(t=>t.id===room.termId);for(const sub of subjects(d,room.termId).filter(x=>x.roomIds.includes(room.id)).map(x=>x.name))for(const s of d.students.filter(s=>s.roomId===room.id)){const r=result(d,s,sub);rows.push([term.year,term.semester,room.name,sub,s.code,s.name,...[r.work,r.att.score,r.mid,r.final,r.total].map(n=>Math.round(n*100)/100),r.att.percent===null?'':Math.round(r.att.percent*100)/100,r.grade,r.missing]);}}return rows;}
  return {subjects,subjectRooms,courseExists,materializeSubjects,SUBJECTS,STATUSES,bands,id,day,blank,number,courseKey,initial,settings,tasks,createGradeTasks,activeStudents,complete,attendance,result,scoreValue,validate,cloneTerm,reportRows};
})();
if(typeof module!=='undefined')module.exports=CheckCore;
