/* Bound to the teacher's own spreadsheet. Run setup() once before deployment. */
function setup() {
  var p=PropertiesService.getScriptProperties();
  var ss=SpreadsheetApp.getActiveSpreadsheet();
  if(!ss)throw new Error('เปิด Apps Script จาก Google Sheets ของครูก่อน');
  p.setProperty('SHEET_ID',ss.getId());
  if(!p.getProperty('PAIR_KEY'))p.setProperty('PAIR_KEY',Utilities.getUuid().replace(/-/g,'')+Utilities.getUuid().replace(/-/g,''));
  console.log('รหัสเชื่อมต่อ (เก็บเป็นส่วนตัว): '+p.getProperty('PAIR_KEY'));
}
function doGet(){return ContentService.createTextOutput('เช็คเอง: ใช้แอปเพื่อซิงก์ข้อมูล').setMimeType(ContentService.MimeType.TEXT);}
function response_(value){return ContentService.createTextOutput(JSON.stringify(value)).setMimeType(ContentService.MimeType.JSON);}
function doPost(e){
  var lock=LockService.getScriptLock();
  try{
    if(!e||!e.postData||e.postData.contents.length>30000000)throw new Error('คำขอไม่ถูกต้อง');
    var req=JSON.parse(e.postData.contents),props=PropertiesService.getScriptProperties(),expected=props.getProperty('PAIR_KEY');
    if(!expected||!secureEqual_(String(req.key||''),expected))return response_({ok:false,error:'รหัสเชื่อมต่อไม่ถูกต้อง'});
    lock.waitLock(25000);
    var ss=SpreadsheetApp.openById(props.getProperty('SHEET_ID'));
    var meta=JSON.parse(props.getProperty('HEAD')||'{"revision":0,"slot":"B","count":0,"commitId":""}');
    if(req.action==='read')return response_({ok:true,protocol:2,revision:meta.revision,commitId:meta.commitId,data:meta.revision?readSnapshot_(ss,meta):null});
    if(req.action!=='push')throw new Error('ไม่รู้จักคำขอ');
    if(typeof req.commitId!=='string'||!/^[A-Za-z0-9_-]{1,100}$/.test(req.commitId))throw new Error('รหัสรายการไม่ถูกต้อง');
    if(req.commitId===meta.commitId)return response_({ok:true,revision:meta.revision,commitId:meta.commitId});
    if(req.baseRevision!==meta.revision)return response_({ok:false,code:'CONFLICT',revision:meta.revision});
    CheckCore.validate(req.data);
    var raw=JSON.stringify(req.data),encoded=Utilities.base64Encode(Utilities.gzip(Utilities.newBlob(raw,'application/json','data.json')).getBytes());
    var chunks=[];for(var i=0;i<encoded.length;i+=35000)chunks.push([encoded.slice(i,i+35000)]);
    var slot=meta.slot==='A'?'B':'A',name='_CHECKENG_'+slot,storage=ss.getSheetByName(name)||ss.insertSheet(name);
    storage.clearContents();storage.getRange(1,1,chunks.length,1).setValues(chunks);SpreadsheetApp.flush();
    var next={revision:meta.revision+1,slot:slot,count:chunks.length,commitId:req.commitId,hash:hash_(encoded)};
    // Pointer changes only after the entire new snapshot is durably written.
    props.setProperty('HEAD',JSON.stringify(next));
    var warning='';try{writeReports_(ss,req.data);}catch(err){warning=String(err.message||err);}
    return response_({ok:true,revision:next.revision,commitId:next.commitId,reportWarning:warning});
  }catch(err){return response_({ok:false,error:String(err.message||err)});}
  finally{if(lock.hasLock())lock.releaseLock();}
}
function secureEqual_(a,b){if(a.length!==b.length)return false;var diff=0;for(var i=0;i<a.length;i++)diff|=a.charCodeAt(i)^b.charCodeAt(i);return diff===0;}
function hash_(s){return Utilities.base64Encode(Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256,s,Utilities.Charset.UTF_8));}
function readSnapshot_(ss,meta){var sh=ss.getSheetByName('_CHECKENG_'+meta.slot);if(!sh)throw new Error('ไม่พบไฟล์สำรองใน Sheets');var encoded=sh.getRange(1,1,meta.count,1).getValues().map(function(r){return r[0];}).join('');if(hash_(encoded)!==meta.hash)throw new Error('ข้อมูลสำรองไม่ครบ กรุณาตรวจ Sheets');var data=JSON.parse(Utilities.ungzip(Utilities.newBlob(Utilities.base64Decode(encoded),"application/gzip","data.json.gz")).getDataAsString('UTF-8'));return CheckCore.validate(data);}
function writeTable_(ss,name,rows){var sheet=ss.getSheetByName(name)||ss.insertSheet(name);sheet.clearContents();var safe=rows.map(function(row){return row.map(function(v){if(typeof v==='string'&&/^[=+@\-\t\r]/.test(v))return "'"+v;return v;});});var width=rows[0].length;if(sheet.getMaxRows()<rows.length)sheet.insertRowsAfter(sheet.getMaxRows(),rows.length-sheet.getMaxRows());if(sheet.getMaxColumns()<width)sheet.insertColumnsAfter(sheet.getMaxColumns(),width-sheet.getMaxColumns());sheet.getRange(1,1,rows.length,width).setNumberFormat('@').setValues(safe);sheet.setFrozenRows(1);sheet.getRange(1,1,1,width).setBackground('#0869e9').setFontColor('#ffffff').setFontWeight('bold');}
function writeReports_(ss,d){
  writeTable_(ss,'เช็คเอง_คะแนน',CheckCore.reportRows(d));
  var attendance=[['ปีการศึกษา','ภาคเรียน','วันที่','คาบ','ห้อง','วิชา','เลขประจำตัว','ชื่อ–นามสกุล','สถานะ','นับเวลาเรียน','สอนเรื่อง']],tasks=[['ปีการศึกษา','ภาคเรียน','ห้อง','วิชา','งาน','คะแนนเต็ม','เลขประจำตัว','ชื่อ–นามสกุล','คะแนน','กรอกแล้ว']];
  d.sessions.forEach(function(s){var room=d.rooms.find(function(r){return r.id===s.roomId;}),term=d.terms.find(function(t){return t.id===room.termId;});s.roster.forEach(function(id){var st=d.students.find(function(x){return x.id===id;});attendance.push([term.year,term.semester,s.date,s.period,room.name,s.subject,st.code,st.name,CheckCore.STATUSES[s.statuses[id]]||'ยังไม่เช็ก',s.complete?'ใช่':'ฉบับร่าง',s.note||'']);});});
  d.tasks.filter(function(t){return !t.deleted;}).forEach(function(t){var room=d.rooms.find(function(r){return r.id===t.roomId;}),term=d.terms.find(function(x){return x.id===room.termId;});d.students.filter(function(st){return st.roomId===room.id;}).forEach(function(st){var v=(d.scores[t.id]||{})[st.id];tasks.push([term.year,term.semester,room.name,t.subject,t.name,t.max,st.code,st.name,CheckCore.number(v),CheckCore.blank(v)?'ยังไม่กรอก':'กรอกแล้ว']);});});
  writeTable_(ss,'เช็คเอง_เวลาเรียน',attendance);writeTable_(ss,'เช็คเอง_งาน',tasks);
  ['A','B'].forEach(function(slot){var sh=ss.getSheetByName('_CHECKENG_'+slot);if(sh)sh.hideSheet();});
}
