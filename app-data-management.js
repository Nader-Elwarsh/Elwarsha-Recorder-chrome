/* app-data-management.js — حذف كل البيانات التشغيلية + النسخ الاحتياطي واستعادته. */
async function deleteAllOperationalData(){if(!confirm("سيتم حذف العملاء والأجهزة وأوامر الشغل وقطع الغيار وحركات المخزن والمصاريف وحركات الحسابات والخزنة. الإعدادات والمراكز والقرى لن تتأثر. هل تريد المتابعة؟"))return;if(!confirm("تأكيد نهائي جدًا: حذف كل البيانات التشغيلية؟"))return;const values={};[K.c,K.d,K.r,K.p,K.m,K.e,K.tr,K.wtx].forEach(k=>values[k]=[]);if(!commitStorage(values))return;if(window.ImageStore?.clearAll&&!await window.ImageStore.clearAll())return alert("تعذر تنظيف الصور والتسجيلات؛ لم يتم إكمال الحذف.");alert("تم حذف كل البيانات التشغيلية. سيتم تحديث الصفحة.");location.reload()}

function daysSinceLastBackup(){let last=localStorage.getItem("wf_last_backup_at");if(!last)return null;let d=new Date(last);if(Number.isNaN(d.getTime()))return null;return Math.floor((Date.now()-d.getTime())/86400000)}
function lastBackupInfoText(){let days=daysSinceLastBackup();if(days===null)return "⚠️ لسه معملتش أي نسخة احتياطية أبدًا.";if(days===0)return "✅ آخر نسخة احتياطية: النهاردة.";if(days===1)return "✅ آخر نسخة احتياطية: من يوم واحد.";return `${days>=14?"⚠️":"✅"} آخر نسخة احتياطية: من ${days} يوم.`}
function renderBackupInfo(){let el=document.getElementById("lastBackupInfo");if(el)el.textContent=lastBackupInfoText()}
document.addEventListener("DOMContentLoaded",renderBackupInfo);

async function snapshotAllData(){
  const data={};Object.values(K).forEach(k=>{data[k]=get(k,null)});
  data.wf_notif_enabled=localStorage.getItem("wf_notif_enabled");
  data.images=window.ImageStore?await window.ImageStore.exportAll():{};
  data._meta={exportedAt:new Date().toISOString(),app:"الورشة الفنية",version:1,schemaVersion:window.getSchemaVersion?window.getSchemaVersion():1};
  return data;
}
function downloadBackupData(data,prefix){
  try{
    const blob=new Blob([JSON.stringify(data,null,2)],{type:"application/json"}),url=URL.createObjectURL(blob),stamp=new Date().toISOString().slice(0,19).replace(/[:T]/g,"-");
    const a=document.createElement("a");a.href=url;a.download=`${prefix}-الورشة-الفنية-${stamp}.json`;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),2000);return true;
  }catch(e){console.error("[backup] تعذر إنشاء ملف النسخة",e);return false}
}
function backupSummary(data){const n=k=>Array.isArray(data[k])?data[k].length:0;return `العملاء: ${n(K.c)} — الأجهزة: ${n(K.d)} — أوامر الشغل: ${n(K.r)} — قطع المخزن: ${n(K.p)} — حركات المخزن: ${n(K.m)} — حركات الحسابات: ${n(K.wtx)} — الصور/التسجيلات: ${data.images&&typeof data.images==="object"?Object.keys(data.images).length:0}`}
function validateBackupData(data){
  if(!data||typeof data!=="object"||Array.isArray(data))throw new Error("bad");
  const keys=Object.values(K);if(!keys.some(k=>k in data))throw new Error("empty");
  for(const k of keys){if(!(k in data))continue;const v=data[k],isSettings=k===K.s;if(isSettings?(v===null||typeof v!=="object"||Array.isArray(v)):!Array.isArray(v))throw new Error(`invalid-${k}`)}
  if(data.images!==undefined&&(data.images===null||typeof data.images!=="object"||Array.isArray(data.images)))throw new Error("invalid-images");
  if(data._meta!==undefined&&(data._meta===null||typeof data._meta!=="object"||Array.isArray(data._meta)))throw new Error("invalid-meta");
}
async function backupAllData(){try{const data=await snapshotAllData();if(!downloadBackupData(data,"نسخة-احتياطية"))throw new Error("download");localStorage.setItem("wf_last_backup_at",data._meta.exportedAt);renderBackupInfo();if(typeof renderBackupReminder==="function")renderBackupReminder()}catch(e){console.error("[backup] فشل التصدير",e);alert("تعذر إنشاء النسخة الاحتياطية. تأكد من مساحة التخزين ثم حاول مرة أخرى.")}}

async function restoreBackupFile(input){
  const file=input?.files?.[0];if(!file)return;
  const reader=new FileReader();reader.onload=async()=>{
    let oldImages=null,oldData=null,safetyDownloaded=false;
    try{
      const data=JSON.parse(reader.result);validateBackupData(data);
      const backupSchema=data._meta?.schemaVersion||1;
      const summary=backupSummary(data);
      oldData=await snapshotAllData();oldImages=oldData.images;
      // ملف أمان مستقل يُنزّل قبل أي استبدال، ليظل متاحًا حتى لو حدث فشل غير متوقع.
      safetyDownloaded=downloadBackupData(oldData,"نسخة-أمان-قبل-الاسترجاع");
      if(!safetyDownloaded)throw new Error("safety-download");
      if(!confirm(`سيتم استبدال البيانات الحالية بالنسخة المختارة.\n\nمحتوى النسخة:\n${summary}\n\nتم تنزيل نسخة أمان تلقائية من الحالة الحالية قبل الاسترجاع. هل تريد المتابعة؟`)){input.value="";return}
      const staged={},keys=Object.values(K);keys.forEach(k=>{if(k in data)staged[k]=data[k]});if("wf_notif_enabled" in data&&data.wf_notif_enabled!=null)staged.wf_notif_enabled=data.wf_notif_enabled;
      if(window.ImageStore?.clearAll&&!await window.ImageStore.clearAll())throw new Error("clear-images");
      if(data.images&&window.ImageStore&&!await window.ImageStore.importAll(data.images))throw new Error("import-images");
      if(!commitStorage(staged))throw new Error("storage-failed");
      if(window.setSchemaVersion)window.setSchemaVersion(Math.min(backupSchema,window.CURRENT_SCHEMA_VERSION||backupSchema));
      if(data._meta?.exportedAt)localStorage.setItem("wf_last_backup_at",data._meta.exportedAt);
      alert("✅ تم استرجاع النسخة الاحتياطية بنجاح. هيتم فتح الرئيسية الآن.");location.href="index.html";
    }catch(e){
      console.error("[backup] فشل الاسترجاع",e);
      try{if(window.ImageStore?.clearAll&&oldImages){await window.ImageStore.clearAll();await window.ImageStore.importAll(oldImages)}}catch(restoreError){console.error("[backup] تعذر استعادة الصور القديمة",restoreError)}
      alert(safetyDownloaded?"تعذر استرجاع النسخة. تم إلغاء العملية وإعادة البيانات المحلية قدر الإمكان. ملف الأمان التلقائي موجود في التنزيلات.":"تعذر قراءة النسخة. لم يتم تغيير البيانات الحالية.");
    }
    input.value="";
  };reader.readAsText(file);
}

function dataIntegrityReport(){
  const issues=[],seen=new Set(),collections=[[K.c,"العملاء"],[K.d,"الأجهزة"],[K.r,"أوامر الشغل"],[K.p,"قطع المخزن"],[K.m,"حركات المخزن"],[K.wtx,"حركات الحسابات"]];
  for(const [key,label] of collections){for(const rec of arr(key)){if(!rec||typeof rec!=="object"){issues.push(`${label}: سجل غير صالح.`);continue}if(rec.id){const token=key+":"+rec.id;if(seen.has(token))issues.push(`${label}: رقم مكرر ${rec.id}.`);seen.add(token)}}}
  const customers=new Set(arr(K.c).map(x=>x?.id).filter(Boolean)),devices=new Set(arr(K.d).map(x=>x?.id).filter(Boolean)),parts=new Set(arr(K.p).map(x=>x?.id).filter(Boolean));
  arr(K.d).forEach(x=>{if(x?.customerId&&!customers.has(x.customerId))issues.push(`الجهاز ${x.id||"بدون رقم"}: مرتبط بعميل غير موجود.`)});
  arr(K.r).forEach(r=>{if(r?.customerId&&!customers.has(r.customerId))issues.push(`الأمر ${r.no||r.id||"بدون رقم"}: العميل غير موجود.`);if(r?.deviceId&&!devices.has(r.deviceId))issues.push(`الأمر ${r.no||r.id||"بدون رقم"}: الجهاز غير موجود.`);(r?.parts||[]).filter(x=>!x.external).forEach(x=>{if(x.partId&&!parts.has(x.partId))issues.push(`الأمر ${r.no||r.id||"بدون رقم"}: قطعة غير موجودة (${x.partId}).`)})});
  arr(K.p).forEach(p=>{if(!Number.isFinite(+p.qty)||+p.qty<0)issues.push(`قطعة ${p.name||p.id||"بدون اسم"}: كمية غير صالحة.`)});
  arr(K.m).forEach(m=>{if(!m?.partId||!parts.has(m.partId))issues.push(`حركة مخزن ${m.id||"بدون رقم"}: القطعة غير موجودة.`);if(!Number.isFinite(+m.qty)||+m.qty<=0)issues.push(`حركة مخزن ${m.id||"بدون رقم"}: كمية غير صالحة.`)});
  return {issues,counts:{customers:arr(K.c).length,devices:arr(K.d).length,requests:arr(K.r).length,parts:arr(K.p).length,moves:arr(K.m).length,wallets:arr(K.wtx).length}};
}
function runDataIntegrityCheck(){
  const host=document.getElementById("dataIntegrityResult");if(!host)return;
  const report=dataIntegrityReport(),c=report.counts;
  if(!report.issues.length){host.innerHTML=`<div class="hint">✅ لم يتم العثور على تعارضات واضحة. تم فحص ${c.customers} عميل، ${c.devices} جهاز، ${c.requests} أمر، ${c.parts} قطعة، و${c.moves} حركة مخزن.</div>`;return}
  host.innerHTML=`<div class="hint">⚠️ تم العثور على ${report.issues.length} ملاحظة. لم يتم تعديل أي بيانات.</div><ul>${report.issues.slice(0,50).map(x=>`<li>${esc(x)}</li>`).join("")}</ul>${report.issues.length>50?`<div class="hint">تم عرض أول 50 ملاحظة فقط.</div>`:""}`;
}

// أمر شغل سريع من الرئيسية: عميل + جهاز + عطل، والباقي يتظبط من صفحة الأمر نفسها.
