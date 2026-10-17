/* Local Excel / CSV reader. SheetJS is vendored so imports work offline. */
var StudentImport = (() => {
  const clean = value => String(value ?? '').trim();
  const header = value => clean(value).toLowerCase().replace(/[\s\-–—_]/g, '');
  function classroom(value){const text=clean(value).replace(/\s/g,'').replace(/^ม\.?/,'');const match=text.match(/^([1-6])(?:\/(\d+))?$/);if(!match||match[2]&&Number(match[2])<1)throw Error('ชั้นต้องระบุห้อง เช่น ม.2/1');return {name:'ม.'+Number(match[1])+(match[2]?'/'+Number(match[2]):''),grade:Number(match[1])};}
  function read(bytes, filename, XLSX) {
    if (bytes.byteLength > 5 * 1024 * 1024) throw Error('ไฟล์ต้องมีขนาดไม่เกิน 5 MB');
    if (!/\.(xlsx|csv)$/i.test(filename)) throw Error('กรุณาเลือกไฟล์ .xlsx หรือ .csv');
    const csv = /\.csv$/i.test(filename);
    let input = bytes;
    if (csv) {
      try { input = new TextDecoder('utf-8', {fatal:true}).decode(bytes).replace(/^\uFEFF/, ''); }
      catch { throw Error('กรุณาบันทึก CSV เป็น UTF-8 เพื่ออ่านชื่อภาษาไทย'); }
    }
    return XLSX.read(input, {type:csv?'string':'array', raw:true, cellText:true, cellFormula:true, sheetRows:2002});
  }
  function preview(workbook, sheetName, existing, XLSX, roomName='') {
    const sheet = workbook.Sheets[sheetName];
    if (!sheet || !sheet['!ref']) throw Error('ชีตนี้ไม่มีรายชื่อ');
    const range = XLSX.utils.decode_range(sheet['!fullref'] || sheet['!ref']);
    if (range.e.r > 2000 || range.e.c > 99) throw Error('รองรับไม่เกิน 2,000 แถวและ 100 คอลัมน์ต่อชีต');
    const cell = (r,c) => sheet[XLSX.utils.encode_cell({r,c})];
    const value = c => clean(c?.w ?? c?.v);
    const codeNames = ['เลขที่','number','no','ลำดับ'];
    const classNames = ['ชั้น','ชั้นห้อง','ห้อง','class','classroom'];
    const nameNames = ['ชื่อสกุล','ชื่อนามสกุล','ชื่อเต็ม','name','fullname'];
    let codeCol = -1, nameCol = -1, classCol = -1;
    for (let c=0; c<=range.e.c; c++) {
      const h = header(value(cell(0,c)));
      if (codeNames.includes(h)) { if(codeCol!==-1) throw Error('มีหัวคอลัมน์เลขที่ซ้ำ'); codeCol=c; }
      if (classNames.includes(h)) { if(classCol!==-1) throw Error('มีหัวคอลัมน์ชั้นซ้ำ'); classCol=c; }
      if (nameNames.includes(h)) { if(nameCol!==-1) throw Error('มีหัวคอลัมน์ชื่อซ้ำ'); nameCol=c; }
    }
    if(codeCol<0 || nameCol<0 || classCol<0) throw Error('แถวแรกต้องมีหัวคอลัมน์ “เลขที่”, “ชื่อ–นามสกุล” และ “ชั้น” ตามไฟล์ตัวอย่าง');
    const used = new Set(existing.map(s=>{try{return classroom(s.className).name+'|'+s.code;}catch{return s.className+'|'+s.code;}})), seen = new Map(), rows = [];
    for(let r=1;r<=range.e.r;r++) {
      const cc=cell(r,codeCol), nc=cell(r,nameCol), gc=cell(r,classCol), code=value(cc), name=value(nc), className=value(gc);
      if(!code&&!name&&!className&&!cc?.f&&!nc?.f&&!gc?.f) continue;
      const errors=[];
      if(!code) errors.push('ไม่มีเลขที่');
      if(!name) errors.push('ไม่มีชื่อ–นามสกุล');
      if(!/^[1-9]\d*$/.test(code)||!Number.isSafeInteger(Number(code))) errors.push('เลขที่ต้องเป็นจำนวนเต็มตั้งแต่ 1');
      if(!className) errors.push('ไม่มีชั้น');
      let parsedClass=null;try{parsedClass=classroom(className);}catch(e){errors.push(e.message);}
      if(cc?.f||nc?.f||gc?.f) errors.push('กรุณาวางเป็นค่าแทนสูตร');
      if(cc?.t==='e'||nc?.t==='e'||gc?.t==='e') errors.push('เซลล์มีข้อผิดพลาด');
      if(cc?.t==='n'&&(!Number.isSafeInteger(cc.v)||cc.v<0||cc.v>=1e15)) errors.push('เลขที่ต้องเก็บเป็นข้อความ');
      if(code.length>100||name.length>300) errors.push('ข้อมูลยาวเกินกำหนด');
      const key=(parsedClass?.name||className)+'|'+code;
      if(code&&used.has(key)) errors.push('เลขที่นี้มีในห้องแล้ว');
      if(code&&seen.has(key)) {
        errors.push('เลขที่ซ้ำกับแถว '+seen.get(key).line);
        seen.get(key).errors.push('เลขที่ซ้ำกับแถว '+(r+1));
      }
      const row={line:r+1,code,number:Number(code),name,className:parsedClass?.name||className,grade:parsedClass?.grade,errors};
      if(code&&!seen.has(key)) seen.set(key,row);
      rows.push(row);
    }
    if(!rows.length) throw Error('ไม่มีรายชื่อนักเรียนใต้หัวคอลัมน์');
    return rows;
  }
  return {read,preview,classroom};
})();
if(typeof module!=='undefined') module.exports=StudentImport;
