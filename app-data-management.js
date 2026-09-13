/* app-data-management.js — حذف كل البيانات التشغيلية + النسخ الاحتياطي واستعادته. */
async function deleteAllOperationalData(){if(!confirm("سيتم حذف العملاء والأجهزة وأوامر الشغل وقطع الغيار وحركات المخزن والمصاريف وحركات الحسابات والخزنة. الإعدادات والمراكز والقرى لن تتأثر. هل تريد المتابعة؟"))return;if(!confirm("تأكيد نهائي جدًا: حذف كل البيانات التشغيلية؟"))return;[K.c,K.d,K.r,K.p,K.m,K.e,K.tr,K.wtx].forEach(k=>put(k,[]));if(window.ImageStore?.clearAll)await window.ImageStore.clearAll();alert("تم حذف كل البيانات التشغيلية. سيتم تحديث الصفحة.");location.reload()}

// النسخة الاحتياطية: تصدير كل بيانات النظام (localStorage) + كل الصور
// (IndexedDB عبر ImageStore) كملف JSON واحد، واسترجاعها لاحقًا.
// ملحوظة: الصور بقت مخزنة في IndexedDB (image-store.js) مش جوه سجلات
// localStorage، فلازم الباك أب يجيبها بنفسه ويحطها في نفس ملف الـ JSON
// عشان الملف يفضل نسخة واحدة كاملة زي ما كان قبل كده تمامًا.
//
// تذكير النسخة الاحتياطية (V11.49): بنسجّل تاريخ آخر نسخة ناجحة في
// wf_last_backup_at (localStorage) — يستخدمها backup-reminder.js
// (بانر في الرئيسية) وapp-notifications-bootstrap.js (تنبيه دوري)
// وصفحة الإعدادات (سطر معلومة) عشان يعرفوا فات قد إيه من آخر نسخة.
function daysSinceLastBackup(){
  let last=localStorage.getItem("wf_last_backup_at");
  if(!last)return null;
  let d=new Date(last);if(Number.isNaN(d.getTime()))return null;
  return Math.floor((Date.now()-d.getTime())/86400000);
}
function lastBackupInfoText(){
  let days=daysSinceLastBackup();
  if(days===null)return "⚠️ لسه معملتش أي نسخة احتياطية أبدًا.";
  if(days===0)return "✅ آخر نسخة احتياطية: النهاردة.";
  if(days===1)return "✅ آخر نسخة احتياطية: من يوم واحد.";
  return `${days>=14?"⚠️":"✅"} آخر نسخة احتياطية: من ${days} يوم.`;
}
function renderBackupInfo(){
  let el=document.getElementById("lastBackupInfo");if(!el)return;
  el.textContent=lastBackupInfoText();
}
document.addEventListener("DOMContentLoaded",renderBackupInfo);
async function backupAllData(){
  let data={};
  Object.values(K).forEach(k=>{data[k]=get(k,null)});
  data.wf_notif_enabled=localStorage.getItem("wf_notif_enabled");
  data.images=window.ImageStore?await window.ImageStore.exportAll():{};
  data._meta={exportedAt:new Date().toISOString(),app:"الورشة الفنية",version:1,schemaVersion:window.getSchemaVersion?window.getSchemaVersion():1};
  let blob=new Blob([JSON.stringify(data,null,2)],{type:"application/json"});
  let url=URL.createObjectURL(blob);
  let stamp=new Date().toISOString().slice(0,19).replace(/[:T]/g,"-");
  let a=document.createElement("a");
  a.href=url;a.download=`نسخة-احتياطية-الورشة-الفنية-${stamp}.json`;
  document.body.appendChild(a);a.click();a.remove();
  setTimeout(()=>URL.revokeObjectURL(url),2000);
  localStorage.setItem("wf_last_backup_at",data._meta.exportedAt);
  if(typeof renderBackupInfo==="function")renderBackupInfo();
  if(typeof renderBackupReminder==="function")renderBackupReminder();
}
async function restoreBackupFile(input){
  let file=input?.files?.[0];
  if(!file)return;
  if(!confirm('⚠️ استيراد نسخة احتياطية هيستبدل كل بيانات النظام الحالية (العملاء والأجهزة وأوامر الشغل والمخزن والخزنة والمهام والصور) بالبيانات اللي في الملف، ومينفعش يترجع بعد كده.\n\nهل أنت متأكد إنك عايز تكمل؟')){input.value="";return}
  let reader=new FileReader();
  reader.onload=async()=>{
    try{
      let data=JSON.parse(reader.result);
      if(!data||typeof data!=="object")throw new Error("bad");
      let keys=Object.values(K);
      let hasAny=keys.some(k=>k in data);
      if(!hasAny)throw new Error("empty");
      // لو الملف من نسخة أقدم من إضافة schemaVersion، نعتبره إصدار 1
      // ونسيب الترحيل العادي (migrations.js) يشتغل بعد كده زي أي بيانات قديمة.
      let backupSchema=data._meta?.schemaVersion||1;
      keys.forEach(k=>{if(k in data)put(k,data[k])});
      if("wf_notif_enabled" in data && data.wf_notif_enabled!=null)localStorage.setItem("wf_notif_enabled",data.wf_notif_enabled);
      // الاسترجاع معناه استبدال كامل لكل بيانات النظام (زي ما موضّح في رسالة
      // التأكيد فوق)، فلازم نمسح صور IndexedDB القديمة الأول قبل ما نستورد
      // صور الملف — وإلا صور من قبل الاسترجاع (بمراجع مختلفة عن اللي في
      // الملف) هتفضل موجودة يتيمة جنب صور النسخة المستوردة.
      if(window.ImageStore?.clearAll)await window.ImageStore.clearAll();
      if(data.images && window.ImageStore)await window.ImageStore.importAll(data.images);
      if(window.setSchemaVersion)window.setSchemaVersion(Math.min(backupSchema,window.CURRENT_SCHEMA_VERSION||backupSchema));
      // الملف اللي اترجع منه أصلًا هو نسخة احتياطية، فتاريخ تصديره (لو موجود)
      // بيبقى أدق تقدير لـ"آخر نسخة احتياطية معروفة" من نظافة العداد على طول.
      if(data._meta?.exportedAt)localStorage.setItem("wf_last_backup_at",data._meta.exportedAt);
      alert("✅ تم استرجاع النسخة الاحتياطية بنجاح. هيتم فتح الرئيسية الآن.");
      location.href="index.html";
    }catch(e){
      alert("تعذر قراءة الملف. تأكد إنه ملف نسخة احتياطية صحيح تم تصديره من نفس النظام.");
    }
    input.value="";
  };
  reader.readAsText(file);
}

// أمر شغل سريع من الرئيسية: عميل + جهاز + عطل، والباقي يتظبط من صفحة الأمر نفسها.
