/* app-data-management.js — حذف كل البيانات التشغيلية + النسخ الاحتياطي واستعادته. */
let backupBusy=false,destructiveBusy=false;
function captureLocalDataState(){const raw={};Object.values(K).forEach(k=>raw[k]=localStorage.getItem(k));return{raw,notif:localStorage.getItem("wf_notif_enabled"),schema:localStorage.getItem("wf_schema_version"),lastBackup:localStorage.getItem("wf_last_backup_at")}}
function restoreLocalDataState(state){if(!state)return;for(const [k,v] of Object.entries(state.raw||{})){try{if(v===null)localStorage.removeItem(k);else localStorage.setItem(k,v)}catch(e){console.error("[backup] تعذر إعادة مفتاح",k,e)}}for(const [k,v] of [["wf_notif_enabled",state.notif],["wf_schema_version",state.schema],["wf_last_backup_at",state.lastBackup]]){try{if(v===null)localStorage.removeItem(k);else localStorage.setItem(k,v)}catch(e){console.error("[backup] تعذر إعادة الإعداد",k,e)}}}
async function deleteAllOperationalData(){if(destructiveBusy)return;destructiveBusy=true;try{if(!confirm("سيتم حذف العملاء والأجهزة وأوامر الشغل وقطع الغيار وحركات المخزن والمصاريف وحركات الحسابات والخزنة. الإعدادات والمراكز والقرى لن تتأثر. هل تريد المتابعة؟"))return;if(!confirm("تأكيد نهائي جدًا: حذف كل البيانات التشغيلية؟"))return;const state=captureLocalDataState(),oldImages=window.ImageStore?.exportAll?await window.ImageStore.exportAll():{};try{if(window.ImageStore?.clearAll&&!await window.ImageStore.clearAll())throw new Error("clear-images");const values={};[K.c,K.d,K.r,K.p,K.m,K.e,K.tr,K.wtx].forEach(k=>values[k]=[]);if(!commitStorage(values))throw new Error("storage-failed");alert("تم حذف كل البيانات التشغيلية. سيتم تحديث الصفحة.");location.reload()}catch(e){restoreLocalDataState(state);try{if(window.ImageStore?.clearAll){await window.ImageStore.clearAll();if(window.ImageStore?.importAll)await window.ImageStore.importAll(oldImages)}}catch(imageError){console.error("[backup] تعذر إعادة الصور بعد فشل الحذف",imageError)}alert("تعذر إكمال الحذف. تم إلغاء العملية وإعادة البيانات السابقة قدر الإمكان.")}}finally{destructiveBusy=false}}

function daysSinceLastBackup(){let last=localStorage.getItem("wf_last_backup_at");if(!last)return null;let d=new Date(last);if(Number.isNaN(d.getTime()))return null;return Math.floor((Date.now()-d.getTime())/86400000)}
function lastBackupInfoText(){let days=daysSinceLastBackup();if(days===null)return "⚠️ لسه معملتش أي نسخة احتياطية أبدًا.";if(days===0)return "✅ آخر نسخة احتياطية: النهاردة.";if(days===1)return "✅ آخر نسخة احتياطية: من يوم واحد.";return `${days>=14?"⚠️":"✅"} آخر نسخة احتياطية: من ${days} يوم.`}
function renderBackupInfo(){let el=document.getElementById("lastBackupInfo");if(el)el.textContent=lastBackupInfoText()}
document.addEventListener("DOMContentLoaded",renderBackupInfo);

async function snapshotAllData(){
  const data={};Object.values(K).forEach(k=>{data[k]=get(k,k===K.s?null:[])});
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
function bytesToB64(bytes){let s="";bytes.forEach(b=>s+=String.fromCharCode(b));return btoa(s)}
function b64ToBytes(s){const bin=atob(s),out=new Uint8Array(bin.length);for(let i=0;i<bin.length;i++)out[i]=bin.charCodeAt(i);return out}
async function encryptBackupData(data,password){const enc=new TextEncoder(),salt=crypto.getRandomValues(new Uint8Array(16)),iv=crypto.getRandomValues(new Uint8Array(12)),base=await crypto.subtle.importKey("raw",enc.encode(password),"PBKDF2",false,["deriveKey"]),key=await crypto.subtle.deriveKey({name:"PBKDF2",salt,iterations:150000,hash:"SHA-256"},base,{name:"AES-GCM",length:256},false,["encrypt"]),cipher=await crypto.subtle.encrypt({name:"AES-GCM",iv},key,enc.encode(JSON.stringify(data)));return{_encrypted:true,algorithm:"AES-GCM",kdf:"PBKDF2-SHA-256",iterations:150000,salt:bytesToB64(salt),iv:bytesToB64(iv),ciphertext:bytesToB64(new Uint8Array(cipher))}}
async function decryptBackupData(envelope,password){const dec=new TextDecoder(),base=await crypto.subtle.importKey("raw",new TextEncoder().encode(password),"PBKDF2",false,["deriveKey"]),key=await crypto.subtle.deriveKey({name:"PBKDF2",salt:b64ToBytes(envelope.salt),iterations:envelope.iterations,hash:"SHA-256"},base,{name:"AES-GCM",length:256},false,["decrypt"]),plain=await crypto.subtle.decrypt({name:"AES-GCM",iv:b64ToBytes(envelope.iv)},key,b64ToBytes(envelope.ciphertext));return JSON.parse(dec.decode(plain))}
function backupSummary(data){const n=k=>Array.isArray(data[k])?data[k].length:0;return `المخطط: ${data._meta?.schemaVersion||1} — العملاء: ${n(K.c)} — الأجهزة: ${n(K.d)} — أوامر الشغل: ${n(K.r)} — قطع المخزن: ${n(K.p)} — حركات المخزن: ${n(K.m)} — حركات الحسابات: ${n(K.wtx)} — حركات الخزنة: ${n(K.tr)} — الصور/التسجيلات: ${data.images&&typeof data.images==="object"?Object.keys(data.images).length:0}`}
function validateBackupData(data){
  if(!data||typeof data!=="object"||Array.isArray(data))throw new Error("bad");
  const keys=Object.values(K),missing=keys.filter(k=>!(k in data));if(missing.length)throw new Error(`missing-${missing.join(",")}`);
  for(const k of keys){const v=data[k],isSettings=k===K.s;if(isSettings?(v!==null&&(typeof v!=="object"||Array.isArray(v))):!Array.isArray(v))throw new Error(`invalid-${k}`);if(Array.isArray(v)&&v.some(x=>!x||typeof x!=="object"||Array.isArray(x)))throw new Error(`invalid-record-${k}`)}
  if(data.images!==undefined&&(data.images===null||typeof data.images!=="object"||Array.isArray(data.images)))throw new Error("invalid-images");
  if(data.images&&Object.values(data.images).some(x=>typeof x!=="string"))throw new Error("invalid-image-value");
  if(data._meta!==undefined&&(data._meta===null||typeof data._meta!=="object"||Array.isArray(data._meta)))throw new Error("invalid-meta");
  const schema=+(data._meta?.schemaVersion||1),current=+(window.CURRENT_SCHEMA_VERSION||schema);if(!Number.isInteger(schema)||schema<1)throw new Error("invalid-schema");if(schema>current)throw new Error("future-schema");
  if(data.wf_notif_enabled!==undefined&&data.wf_notif_enabled!==null&&typeof data.wf_notif_enabled!=="string")throw new Error("invalid-notification-setting");
  return {schemaVersion:schema};
}
async function backupAllData(){if(backupBusy)return;backupBusy=true;try{const data=await snapshotAllData(),password=prompt("كلمة مرور اختيارية للنسخة الاحتياطية. اتركها فارغة لنسخة عادية:");if(password===null)return;const output=password?await encryptBackupData(data,password):data;if(!downloadBackupData(output,password?"نسخة-احتياطية-مشفرة":"نسخة-احتياطية"))throw new Error("download");localStorage.setItem("wf_last_backup_at",data._meta.exportedAt);renderBackupInfo();if(typeof renderBackupReminder==="function")renderBackupReminder()}catch(e){console.error("[backup] فشل التصدير",e);alert("تعذر إنشاء النسخة الاحتياطية. تأكد من كلمة المرور ومساحة التخزين ثم حاول مرة أخرى.")}finally{backupBusy=false}}

async function restoreBackupFile(input){
  if(backupBusy)return;backupBusy=true;
  const file=input?.files?.[0];if(!file){backupBusy=false;return;}
  const reader=new FileReader();reader.onload=async()=>{
    let oldImages=null,oldData=null,oldState=null,safetyDownloaded=false;
    try{
      let data=JSON.parse(reader.result);if(data?._encrypted){const password=prompt("اكتب كلمة مرور النسخة المشفرة:");if(!password)throw new Error("missing-password");data=await decryptBackupData(data,password)}validateBackupData(data);
      const backupSchema=data._meta?.schemaVersion||1;
      const summary=backupSummary(data);
      oldState=captureLocalDataState();oldData=await snapshotAllData();oldImages=oldData.images;
      // ملف أمان مستقل يُنزّل قبل أي استبدال، ليظل متاحًا حتى لو حدث فشل غير متوقع.
      safetyDownloaded=downloadBackupData(oldData,"نسخة-أمان-قبل-الاسترجاع");
      if(!safetyDownloaded)throw new Error("safety-download");
      if(!confirm(`سيتم استبدال البيانات الحالية بالنسخة المختارة.\n\nمحتوى النسخة:\n${summary}\n\nتم تنزيل نسخة أمان تلقائية من الحالة الحالية قبل الاسترجاع. هل تريد المتابعة؟`)){input.value="";return}
      const staged={},keys=Object.values(K);keys.forEach(k=>{if(k in data)staged[k]=data[k]});
      if(window.ImageStore?.clearAll&&!await window.ImageStore.clearAll())throw new Error("clear-images");
      if(data.images&&window.ImageStore&&!await window.ImageStore.importAll(data.images))throw new Error("import-images");
      if(!commitStorage(staged))throw new Error("storage-failed");
      if("wf_notif_enabled" in data){if(data.wf_notif_enabled==null)localStorage.removeItem("wf_notif_enabled");else if(!put("wf_notif_enabled",data.wf_notif_enabled))throw new Error("notification-setting-failed")}
      if(window.setSchemaVersion)window.setSchemaVersion(Math.min(backupSchema,window.CURRENT_SCHEMA_VERSION||backupSchema));
      if(data._meta?.exportedAt)localStorage.setItem("wf_last_backup_at",data._meta.exportedAt);
      alert("✅ تم استرجاع النسخة الاحتياطية بنجاح. هيتم فتح الرئيسية الآن.");location.href="index.html";
    }catch(e){
      console.error("[backup] فشل الاسترجاع",e);
      restoreLocalDataState(oldState);
      try{if(window.ImageStore?.clearAll&&oldImages){await window.ImageStore.clearAll();await window.ImageStore.importAll(oldImages)}}catch(restoreError){console.error("[backup] تعذر استعادة الصور القديمة",restoreError)}
      alert(safetyDownloaded?"تعذر استرجاع النسخة. تم إلغاء العملية وإعادة البيانات المحلية قدر الإمكان. ملف الأمان التلقائي موجود في التنزيلات.":"تعذر قراءة النسخة. لم يتم تغيير البيانات الحالية.");
    }
    input.value="";
    backupBusy=false;
  };reader.readAsText(file);
}

function dataIntegrityReport(){
  const issues=[],seen=new Set(),collections=[[K.c,"العملاء"],[K.d,"الأجهزة"],[K.r,"أوامر الشغل"],[K.p,"قطع المخزن"],[K.m,"حركات المخزن"],[K.wtx,"حركات الحسابات"],[K.tr,"حركات الخزنة"]];
  const add=(message)=>{if(!issues.includes(message))issues.push(message)};
  for(const [key,label] of collections){for(const rec of arr(key)){if(!rec||typeof rec!=="object"){add(`${label}: سجل غير صالح.`);continue}if(rec.id){const token=key+":"+rec.id;if(seen.has(token))add(`${label}: رقم مكرر ${rec.id}.`);seen.add(token)}}}
  const customers=new Set(arr(K.c).map(x=>x?.id).filter(Boolean)),devices=new Set(arr(K.d).map(x=>x?.id).filter(Boolean)),parts=new Set(arr(K.p).map(x=>x?.id).filter(Boolean));
  arr(K.d).forEach(x=>{if(x?.customerId&&!customers.has(x.customerId))add(`الجهاز ${x.id||"بدون رقم"}: مرتبط بعميل غير موجود.`)});
  const requestIds=new Set(arr(K.r).map(x=>x?.id).filter(Boolean));
  arr(K.r).forEach(r=>{
    const label=r.no||r.id||"بدون رقم",partsList=Array.isArray(r.parts)?r.parts:[],partsTotal=partsList.reduce((n,x)=>n+(+x.qty||0)*(+x.sell||0),0),partsCost=partsList.reduce((n,x)=>n+(+x.qty||0)*(+x.cost||0),0),expectedTotal=(+r.labor||0)+partsTotal;
    if(r?.customerId&&!customers.has(r.customerId))add(`الأمر ${label}: العميل غير موجود.`);
    if(r?.deviceId&&!devices.has(r.deviceId))add(`الأمر ${label}: الجهاز غير موجود.`);
    partsList.filter(x=>!x.external).forEach(x=>{if(x.partId&&!parts.has(x.partId))add(`الأمر ${label}: قطعة غير موجودة (${x.partId}).`);if(!Number.isFinite(+x.qty)||+x.qty<=0)add(`الأمر ${label}: كمية قطعة غير صالحة.`)});
    if(Math.abs((+r.partsTotal||0)-partsTotal)>.01)add(`الأمر ${label}: إجمالي قطع الغيار لا يطابق تفاصيل القطع.`);
    if(Math.abs((+r.partsCost||0)-partsCost)>.01)add(`الأمر ${label}: تكلفة القطع لا تطابق تفاصيل القطع.`);
    if(Math.abs((+r.total||0)-expectedTotal)>.01)add(`الأمر ${label}: الإجمالي لا يطابق المصنعية وقطع الغيار.`);
    if(!Number.isFinite(+r.deposit)||+r.deposit<0||+r.deposit>(+r.total||0)+.01)add(`الأمر ${label}: العربون غير صالح مقارنة بالإجمالي.`);
  });
  arr(K.p).forEach(p=>{if(!Number.isFinite(+p.qty)||+p.qty<0)add(`قطعة ${p.name||p.id||"بدون اسم"}: كمية غير صالحة.`)});
  arr(K.m).forEach(m=>{if(!m?.partId||!parts.has(m.partId))add(`حركة مخزن ${m.id||"بدون رقم"}: القطعة غير موجودة.`);if(!Number.isFinite(+m.qty)||+m.qty<=0)add(`حركة مخزن ${m.id||"بدون رقم"}: كمية غير صالحة.`);if(m.requestId&&!requestIds.has(m.requestId))add(`حركة مخزن ${m.id||"بدون رقم"}: أمر الشغل غير موجود.`)});
  const activeWallet=arr(K.wtx).filter(x=>!x.deleted),activeTreasury=arr(K.tr).filter(x=>!x.deleted),refSeen=new Set();
  activeWallet.forEach(x=>{if(!Number.isFinite(+x.amount)||+x.amount<=0)add(`حركة حساب ${x.id||"بدون رقم"}: مبلغ غير صالح.`);if(x.type!=="in"&&x.type!=="out")add(`حركة حساب ${x.id||"بدون رقم"}: نوع الحركة غير صالح.`);if(x.refKey){if(refSeen.has(x.refKey))add(`حركات الحسابات: رابط مكرر ${x.refKey}.`);refSeen.add(x.refKey);const orderId=String(x.refKey).replace(/^order-(?:deposit|final)-/,"");if(/^order-(?:deposit|final)-/.test(x.refKey)&&!requestIds.has(orderId))add(`حركة حساب ${x.id||"بدون رقم"}: مرتبطة بأمر غير موجود.`)}});
  activeTreasury.forEach(x=>{if(!Number.isFinite(+x.amount)||+x.amount<=0)add(`حركة خزنة ${x.id||"بدون رقم"}: مبلغ غير صالح.`);if(x.type!=="in"&&x.type!=="out")add(`حركة خزنة ${x.id||"بدون رقم"}: نوع الحركة غير صالح.`)});
  const transferIds=new Set([...activeWallet,...activeTreasury].map(x=>x.transferId).filter(Boolean));
  transferIds.forEach(id=>{const w=activeWallet.filter(x=>x.transferId===id),t=activeTreasury.filter(x=>x.transferId===id);if(w.length!==1||t.length!==1)add(`التحويل ${id}: لا يحتوي طرفًا واحدًا صحيحًا في الحساب والخزنة.`);else if(+w[0].amount!==+t[0].amount)add(`التحويل ${id}: المبلغ مختلف بين الطرفين.`)});
  return {issues,counts:{customers:arr(K.c).length,devices:arr(K.d).length,requests:arr(K.r).length,parts:arr(K.p).length,moves:arr(K.m).length,wallets:activeWallet.length,treasury:activeTreasury.length}};
}
function runDataIntegrityCheck(){
  const host=document.getElementById("dataIntegrityResult");if(!host)return;
  const report=dataIntegrityReport(),c=report.counts;
  if(!report.issues.length){host.innerHTML=`<div class="hint">✅ لم يتم العثور على تعارضات واضحة. تم فحص ${c.customers} عميل، ${c.devices} جهاز، ${c.requests} أمر، ${c.parts} قطعة، و${c.moves} حركة مخزن.</div>`;return}
  host.innerHTML=`<div class="hint">⚠️ تم العثور على ${report.issues.length} ملاحظة. لم يتم تعديل أي بيانات.</div><ul>${report.issues.slice(0,50).map(x=>`<li>${esc(x)}</li>`).join("")}</ul>${report.issues.length>50?`<div class="hint">تم عرض أول 50 ملاحظة فقط.</div>`:""}`;
}

// أمر شغل سريع من الرئيسية: عميل + جهاز + عطل، والباقي يتظبط من صفحة الأمر نفسها.
