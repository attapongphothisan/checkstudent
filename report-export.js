/* Offline report exports. Uses the same grading rules as the app. */
var CheckReports = (() => {
 'use strict';
 const round=n=>Math.round(n*100)/100;
 const display=v=>v===null||v===undefined||v===''?'—':String(v);
 function build(d,{roomId,subject,month,kind='attendance'}){
  const C=CheckCore,r=d.rooms.find(r=>r.id===roomId),term=d.terms.find(t=>t.id===r?.termId);
  if(!r||!C.courseExists(d,roomId,subject))throw Error('เลือกห้องเรียนและวิชาก่อนส่งออก');
  if(kind==='attendance'&&!/^\d{4}-(0[1-9]|1[0-2])$/.test(month||''))throw Error('เลือกเดือนที่ต้องการส่งออก');
  const students=d.students.filter(s=>s.roomId===roomId);
  if(!students.length)throw Error('ห้องนี้ยังไม่มีนักเรียนสำหรับส่งออก');
  const sessions=d.sessions.filter(s=>s.roomId===roomId&&s.subject===subject&&s.complete&&C.complete(s)&&(kind!=='attendance'||s.date.startsWith(month))).sort((a,b)=>a.date.localeCompare(b.date)||a.period-b.period);
  const attendanceHeaders=['เลขที่','รหัสนักเรียน','ชื่อ – สกุล','มา','ขาด','ลา','สาย','หนี','เข้าเรียน','คาบทั้งหมด','เวลาเรียน (%)','สถานะรายชื่อ'];
  const attendanceRows=students.map((st,i)=>{const counts={present:0,absent:0,leave:0,late:0,skip:0};sessions.filter(s=>s.roster.includes(st.id)).forEach(s=>counts[s.statuses[st.id]]++);const att=C.attendance({...d,sessions},st,subject);return [st.number??i+1,st.code,st.name,counts.present,counts.absent,counts.leave,counts.late,counts.skip,att.attended,att.total,att.percent===null?'':round(att.percent),st.archived?'ย้ายออก':'เรียนอยู่'];});
  const scoreHeaders=['เลขที่','รหัสนักเรียน','ชื่อ – สกุล','งาน / 60','เข้าเรียน / 10','กลางภาค / 10','ปลายภาค / 20','รวม / 100','เวลาเรียน (%)','เกรด','ช่องคะแนนว่าง','สถานะรายชื่อ'];
  const scoreRows=students.map((st,i)=>{const v=C.result(d,st,subject);return [st.number??i+1,st.code,st.name,...[v.work,v.att.score,v.mid,v.final,v.total].map(round),v.att.percent===null?'':round(v.att.percent),v.grade,v.missing,st.archived?'ย้ายออก':'เรียนอยู่'];});
  const ts=C.tasks(d,roomId,subject),cfg=C.settings(d,roomId,subject),exams=d.exams[C.courseKey(roomId,subject)]||{};
  const detailsHeaders=['เลขที่','รหัสนักเรียน','ชื่อ – สกุล',...ts.map(t=>t.name+' / '+t.max),'กลางภาค / '+cfg.midMax,'ปลายภาค / '+cfg.finalMax];
  const detailsRows=students.map((st,i)=>[st.number??i+1,st.code,st.name,...ts.map(t=>d.scores[t.id]?.[st.id]??''),exams[st.id]?.mid??'',exams[st.id]?.final??'']);
  const byId=new Map(students.map(s=>[s.id,s]));
  const logRows=sessions.flatMap(s=>s.roster.map(id=>{const st=byId.get(id);return [s.date,s.period,st?.code||'',st?.name||'',C.STATUSES[s.statuses[id]],s.note||''];}));
  const period=kind==='attendance'?new Intl.DateTimeFormat('th-TH',{month:'long',year:'numeric'}).format(new Date(month+'-01T12:00:00')):`ภาคเรียน ${term.semester} ปีการศึกษา ${term.year}`;
  const title=kind==='attendance'?'รายงานเวลาเรียนรายเดือน':'รายงานคะแนนและเกรดภาคเรียน';
  const note=kind==='attendance'?'เฉพาะคาบที่เช็กครบและบันทึกแล้ว · มา/ลา/สาย นับเข้าเรียน · ร้อยละเวลาเรียนเฉพาะเดือนที่เลือก':'เฉพาะคาบที่เช็กครบและบันทึกแล้ว · มา/ลา/สาย นับเข้าเรียน · เวลาเรียนต่ำกว่า 80% เป็น มส. · คะแนนว่างคิดเป็น 0';
  return {title,period,room:r.name,subject,teacher:d.settings.teacher,school:d.settings.school,term,kind,month,sessions:sessions.length,students:students.length,note,headers:kind==='attendance'?attendanceHeaders:scoreHeaders,rows:kind==='attendance'?attendanceRows:scoreRows,sheets:[{name:kind==='attendance'?'เวลาเรียนรายเดือน':'คะแนนและเกรด',headers:kind==='attendance'?attendanceHeaders:scoreHeaders,rows:kind==='attendance'?attendanceRows:scoreRows},...(kind==='scores'?[{name:'คะแนนงานและสอบ',headers:detailsHeaders,rows:detailsRows},{name:'เวลาเรียนทั้งภาค',headers:attendanceHeaders,rows:attendanceRows}]:[]),{name:'เช็กชื่อรายคาบ',headers:['วันที่','คาบ','รหัสนักเรียน','ชื่อ – สกุล','สถานะ','บันทึกการสอน'],rows:logRows}]};
 }
 function filename(report,ext){return `${report.kind==='attendance'?'เวลาเรียน':'คะแนนภาคเรียน'}-${report.room}-${report.subject}-${report.kind==='attendance'?report.month:report.term.year+'-'+report.term.semester}.${ext}`.replace(/[\\/:*?"<>|]/g,'-');}
 function workbook(report,X){
  if(!X?.utils)throw Error('ยังโหลดเครื่องมือ Excel ไม่สำเร็จ กรุณาเปิดแอปใหม่');
  const book=X.utils.book_new();book.Props={Title:report.title,Author:report.teacher,Subject:report.subject};
  report.sheets.forEach(sheet=>{
   const rows=[[report.title],[report.school||'โรงเรียน: ยังไม่ได้ระบุ'],[`ครู ${report.teacher} · ห้อง ${report.room} · ${report.subject}`],[`${report.period} · ภาคเรียน ${report.term.semester} ปีการศึกษา ${report.term.year}`],[report.note],[],sheet.headers,...sheet.rows];
   const ws=X.utils.aoa_to_sheet(rows);ws['!cols']=sheet.headers.map((h,i)=>({wch:i===2||h==='ชื่อ – สกุล'?28:h==='บันทึกการสอน'?48:h.length>20?24:Math.max(13,h.length+2)}));
   ws['!merges']=[0,1,2,3,4].map(row=>({s:{r:row,c:0},e:{r:row,c:sheet.headers.length-1}}));
   ws['!autofilter']={ref:X.utils.encode_range({s:{r:6,c:0},e:{r:6+sheet.rows.length,c:sheet.headers.length-1}})};
   Object.values(ws).forEach(cell=>{if(cell&&cell.t==='n')cell.z='0.##';});
   X.utils.book_append_sheet(book,ws,sheet.name);
  });return book;
 }
 function download(blob,name){const a=document.createElement('a'),url=URL.createObjectURL(blob);a.href=url;a.download=name;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),60000);}
 function excel(report){const book=workbook(report,globalThis.XLSX);const bytes=XLSX.write(book,{bookType:'xlsx',type:'array',compression:true});download(new Blob([bytes],{type:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'}),filename(report,'xlsx'));}
 function lines(ctx,value,width){const parts=[];let line='';for(const char of (typeof Intl.Segmenter==='function'?[...new Intl.Segmenter('th',{granularity:'grapheme'}).segment(display(value))].map(x=>x.segment):Array.from(display(value)))){if(ctx.measureText(line+char).width>width&&line){parts.push(line);line=char;}else line+=char;}parts.push(line);return parts;}
 function canvasPages(report){
  const width=1123,height=794,margin=38,tableWidth=width-margin*2,pages=[];
  const ratios=report.kind==='attendance'?[.04,.09,.23,.045,.045,.045,.045,.045,.065,.065,.095,.09]:[.04,.09,.23,.06,.07,.07,.07,.075,.085,.055,.075,.08];
  const sum=ratios.reduce((a,b)=>a+b),cols=ratios.map(n=>n/sum*tableWidth);
  let canvas,ctx,y,page;
  const font=(size,bold=false)=>{ctx.font=`${bold?'600':'400'} ${size}px -apple-system, BlinkMacSystemFont, Tahoma, sans-serif`;};
  const drawRow=(values,header=false)=>{
   font(header?12:13,header);const wrapped=values.map((v,i)=>lines(ctx,v,cols[i]-12));const h=Math.max(header?48:32,...wrapped.map(a=>a.length*18+14));
   let x=margin;ctx.fillStyle=header?'#dfeaff':page.row%2?'#f3f7fc':'#ffffff';ctx.fillRect(x,y,tableWidth,h);
   wrapped.forEach((a,i)=>{ctx.strokeStyle='#d4deec';ctx.lineWidth=.7;ctx.strokeRect(x,y,cols[i],h);ctx.fillStyle=header?'#163561':'#17243e';a.forEach((line,j)=>ctx.fillText(line,x+6,y+20+j*18));x+=cols[i];});y+=h;if(!header)page.row++;
  };
  const fresh=()=>{canvas=document.createElement('canvas');canvas.width=width*2;canvas.height=height*2;ctx=canvas.getContext('2d');if(!ctx)throw Error('อุปกรณ์นี้ไม่รองรับการสร้าง PDF');ctx.scale(2,2);ctx.fillStyle='#fff';ctx.fillRect(0,0,width,height);ctx.fillStyle='#17365f';font(23,true);ctx.fillText(report.title,margin,49);font(14);const metadata=lines(ctx,`${report.school||'โรงเรียน: ยังไม่ได้ระบุ'} · ครู ${report.teacher}`,tableWidth);metadata.forEach((line,i)=>ctx.fillText(line,margin,76+i*20));const metaEnd=76+(metadata.length-1)*20;ctx.fillText(`ห้อง ${report.room} · ${report.subject} · ${report.period}`,margin,metaEnd+24);font(11);ctx.fillText(`ภาคเรียน ${report.term.semester} ปีการศึกษา ${report.term.year} · นักเรียน ${report.students} คน · คาบที่บันทึก ${report.sessions} คาบ`,margin,metaEnd+46);y=metaEnd+67;page={canvas,row:0};pages.push(page);drawRow(report.headers.map(h=>h==='สถานะรายชื่อ'?'สถานะ':h),true);};
  fresh();report.rows.forEach(row=>{font(13);const h=Math.max(32,...row.map((v,i)=>lines(ctx,v,cols[i]-12).length*18+14));if(y+h>height-75)fresh();drawRow(row);});
  pages.forEach((p,i)=>{ctx=p.canvas.getContext('2d');ctx.setTransform(2,0,0,2,0,0);font(11);ctx.fillStyle='#50617c';ctx.fillText(report.note,margin,height-40);ctx.fillText(`หน้า ${i+1} / ${pages.length}`,width-115,height-20);});
  return pages.map(p=>p.canvas);
 }
 // Image-backed PDF preserves Thai shaping from the browser and works offline.
 function pdfBlob(canvases){
  const encoder=new TextEncoder(),chunks=[],offsets=[0];let length=0;
  const add=value=>{const b=typeof value==='string'?encoder.encode(value):value;chunks.push(b);length+=b.length;};
  const object=(id,content)=>{offsets[id]=length;add(`${id} 0 obj\n`);add(content);add('\nendobj\n');};
  add('%PDF-1.4\n');object(1,'<< /Type /Catalog /Pages 2 0 R >>');object(2,`<< /Type /Pages /Count ${canvases.length} /Kids [${canvases.map((_,i)=>`${3+i*3} 0 R`).join(' ')}] >>`);
  canvases.forEach((canvas,i)=>{const p=3+i*3,img=p+1,content=p+2;const bytes=Uint8Array.from(atob(canvas.toDataURL('image/jpeg',.94).split(',')[1]),c=>c.charCodeAt(0));object(p,`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 841.89 595.28] /Resources << /XObject << /Im${i} ${img} 0 R >> >> /Contents ${content} 0 R >>`);offsets[img]=length;add(`${img} 0 obj\n<< /Type /XObject /Subtype /Image /Width ${canvas.width} /Height ${canvas.height} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${bytes.length} >>\nstream\n`);add(bytes);add('\nendstream\nendobj\n');const command=`q 841.89 0 0 595.28 0 0 cm /Im${i} Do Q\n`;object(content,`<< /Length ${encoder.encode(command).length} >>\nstream\n${command}endstream`);});
  const xref=length;add(`xref\n0 ${offsets.length}\n0000000000 65535 f \n`);offsets.slice(1).forEach(n=>add(`${String(n).padStart(10,'0')} 00000 n \n`));add(`trailer\n<< /Size ${offsets.length} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`);return new Blob(chunks,{type:'application/pdf'});
 }
 async function pdf(report){if(document.fonts?.ready)await document.fonts.ready;download(pdfBlob(canvasPages(report)),filename(report,'pdf'));}
 return {build,filename,workbook,excel,pdf,canvasPages,pdfBlob};
})();
if(typeof module!=='undefined')module.exports=CheckReports;
