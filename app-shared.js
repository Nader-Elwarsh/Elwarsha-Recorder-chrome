/* app-shared.js — أدوات مشتركة عامة: مساعدات صور/تخزين/تاريخ، دورة حالات أمر الشغل المعتمدة، فتح/قفل صناديق الإضافة السريعة، تعبئة القوائم المنسدلة (مراكز/قرى/عملاء/عناوين/أنواع/ماركات). */
function imageToDataURL(file,max=720,quality=.62){return new Promise((resolve,reject)=>{if(!file){resolve("");return}try{let r=new FileReader();r.onload=()=>{let img=new Image();img.onload=()=>{let scale=Math.min(1,max/Math.max(img.width,img.height)),w=Math.max(1,Math.round(img.width*scale)),h=Math.max(1,Math.round(img.height*scale)),c=document.createElement("canvas");c.width=w;c.height=h;let ctx=c.getContext("2d",{alpha:false});ctx.fillStyle="#fff";ctx.fillRect(0,0,w,h);ctx.drawImage(img,0,0,w,h);resolve(c.toDataURL("image/jpeg",quality))};img.onerror=reject;img.src=r.result};r.onerror=reject;r.readAsDataURL(file)}catch(e){reject(e)}})}
function saveJSONSafe(k,v){try{put(k,v);return true}catch(e){if(e?.name==="QuotaExceededError")alert("مساحة تخزين الصور في المتصفح امتلأت. جرّب صورة أصغر أو احذف صورة قديمة.");else alert("تعذر حفظ البيانات: "+(e?.message||e));return false}}
function localDateKey(date){return dayKeyLocal(date)}
function monthKeyLocal(value){let d=new Date(value);if(Number.isNaN(d.getTime()))return"";return`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}`}
function orderNo(date=new Date()){let y=String(date.getFullYear()).slice(-2),m=date.getMonth()+1,d=date.getDate(),prefix=`W${y}-${m}-${d}-`,ymd=localDateKey(date);let n=arr(K.r).filter(x=>x.createdAt&&localDateKey(new Date(x.createdAt))===ymd).length+1;while(arr(K.r).some(x=>x.no===prefix+n))n++;return prefix+n}
function normalizeOrderNumbers(){let rs=arr(K.r),used=new Set(),groups={};rs.forEach(r=>{let dt=r.createdAt?new Date(r.createdAt):new Date(),ymd=localDateKey(dt);(groups[ymd]??=[]).push(r)});Object.entries(groups).forEach(([ymd,list])=>{let [yy,mm,dd]=ymd.split("-").map(Number),prefix=`W${String(yy).slice(-2)}-${mm}-${dd}-`;list.forEach((r,i)=>{let n=prefix+(i+1);while(used.has(n))n=prefix+(++i+1);r.no=n;used.add(n)})});put(K.r,rs)}

/* =========================================================
   دورة حالات أمر الشغل المعتمدة (راجع WORK_ORDER_LIFECYCLE_APPROVED.md)
   =========================================================
   الحالات: جديد / جاري التنفيذ / مكتمل / ملغي — ثابتة، مش قابلة للتعديل.
   الانتقالات المسموحة فقط:
     جديد → جاري التنفيذ | ملغي
     جاري التنفيذ → مكتمل | ملغي
     ملغي → جديد (إعادة فتح)
     مكتمل → جاري التنفيذ (إعادة فتح عند الحاجة)
   كل تغيير حالة بيتسجل بتاريخه ووقته في r.statusHistory. الإلغاء لازم
   له سبب (r.cancelReason). الأولوية اتشالت خالص من دورة أمر الشغل.
   ========================================================= */
const WORK_ORDER_STATUSES=["جديد","جاري التنفيذ","مكتمل","ملغي"];
const WORK_ORDER_TRANSITIONS={"جديد":["جاري التنفيذ","ملغي"],"جاري التنفيذ":["مكتمل","ملغي"],"مكتمل":["جاري التنفيذ"],"ملغي":["جديد"]};
function canTransitionStatus(from,to){if(!from)return true;if(from===to)return true;return (WORK_ORDER_TRANSITIONS[from]||[]).includes(to)}
function nextStatusOptions(status){let opts=[status,...(WORK_ORDER_TRANSITIONS[status]||[])];return [...new Set(opts)]}
function recordStatusHistory(r,from,to,note){r.statusHistory=Array.isArray(r.statusHistory)?r.statusHistory:[];r.statusHistory.push({from:from||"",to,at:new Date().toISOString(),note:note||""})}

/* =========================================================
   مهلة "المرتجع" لأوامر الشغل المكتملة والمغلقة (settings().returnWindowDays)
   =========================================================
   أمر الشغل المكتمل وغير المغلق: يفضل ممكن إرجاعه في أي وقت (زي ما كان).
   أمر الشغل المكتمل والمغلق (بعد "تم الدفع بالكامل وإغلاق الأمر"): بيبقى
   ليه مهلة محددة بالأيام (افتراضيًا 7، قابلة للتعديل من الإعدادات) تُحسب
   من تاريخ الإغلاق (closedAt). بعد انتهاء المهلة مفيش مرتجع خالص.
   ========================================================= */
function returnWindowDeadline(r){
  if(!r||!r.closedAt)return null;
  let days=+(settings().returnWindowDays);
  if(!Number.isFinite(days)||days<=0)days=7;
  return new Date(new Date(r.closedAt).getTime()+days*86400000);
}
function returnWindowDaysLeft(r){
  let dl=returnWindowDeadline(r);
  if(!dl)return null;
  return Math.ceil((dl.getTime()-Date.now())/86400000);
}
function canReturnRequest(r){
  if(!r)return false;
  if(r.status!=="مكتمل")return false;
  if(!r.closed)return true;
  let dl=returnWindowDeadline(r);
  return !!dl&&Date.now()<=dl.getTime();
}
function statusHistoryHtml(r){let h=Array.isArray(r.statusHistory)?r.statusHistory:[];if(!h.length)return"";return `<div class="status-history"><h3>🕓 سجل تغييرات الحالة</h3>${h.slice().reverse().map(x=>`<div class="status-history-row"><div class="status-history-line"><span>${x.from?`${esc(x.from)} ← `:""}<b>${esc(x.to)}</b></span><small>${new Date(x.at).toLocaleString("ar-EG")}</small></div>${x.note?`<div class="status-history-note">📝 ${esc(x.note)}</div>`:""}</div>`).join("")}</div>`}

/* =========================================================
   markPaidAndClose / closeOrder — نسخة واحدة موحّدة (دُمجت هنا 2026-08-28)
   =========================================================
   قبل كده كانت نفس الدالة معرّفة مرتين بنفس المنطق بالظبط:
   نسخة "أساسية" في app-requests.js (شغالة في request.html، route.html،
   customer.html، device.html، part.html، index.html، tasks.html،
   treasury.html، settings.html، reports.html)، ونسخة بتستبدلها في
   workshop-mini-simple-ui.js (شغالة في customers.html، devices.html،
   inventory.html، requests.html). الاختلاف الوحيد بينهم كان تفاصيل تنفيذ
   ما بتأثرش على السلوك (arr(K.r) و requestRows() نفس الحاجة بالظبط،
   وكذلك put(K.r,..) و save("wf_r",..))، لكن التكرار نفسه كان مصدر باگ
   فعلي قبل كده (حقل r.closedStatus كان بيتسجل في نسخة وينتسى في التانية،
   راجع CHANGELOG v11-31). دلوقتي نسخة واحدة بس هنا، بتحمّل في كل صفحة
   قبل app-requests.js وقبل workshop-mini-simple-ui.js، وأي صفحتين
   بيشتغلوا بنفس الدالة بالظبط.
   ========================================================= */

/* =========================================================
   ⏱️ قياس دورة أمر الشغل
   - createdAt: وقت تسجيل البلاغ
   - startedAt: أول انتقال إلى "جاري التنفيذ"
   - completedAt: آخر وصول إلى "مكتمل"
   - workshopStartedAt: بداية التنفيذ داخل الورشة عند توفرها
   التوقيتات لا تضيف حالات جديدة، وتظل متوافقة مع دورة الحالات المعتمدة.
   ========================================================= */
function requestTimingDate(r,field,fallbackToHistory){
  if(!r)return null;
  if(r[field]){let d=new Date(r[field]);if(!Number.isNaN(d.getTime()))return d;}
  if(fallbackToHistory&&Array.isArray(r.statusHistory)){
    let wanted=field==="startedAt"?"جاري التنفيذ":field==="completedAt"?"مكتمل":"";
    if(wanted){
      let rows=r.statusHistory.filter(x=>x.to===wanted&&x.at).sort((a,b)=>new Date(a.at)-new Date(b.at));
      if(rows.length){let d=new Date(field==="completedAt"?rows[rows.length-1].at:rows[0].at);if(!Number.isNaN(d.getTime()))return d;}
    }
  }
  return null;
}
function requestCreatedDate(r){
  if(!r)return null;
  let d=r.createdAt?new Date(r.createdAt):null;
  if(d&&!Number.isNaN(d.getTime()))return d;
  if(Array.isArray(r.statusHistory)&&r.statusHistory.length){
    let rows=r.statusHistory.filter(x=>x.at).sort((a,b)=>new Date(a.at)-new Date(b.at));
    if(rows.length){d=new Date(rows[0].at);if(!Number.isNaN(d.getTime()))return d;}
  }
  return null;
}
/* V11.54: ترميز لوني حسب عمر أمر الشغل (منذ تاريخ التسجيل)، عشان لو الأوامر
   المفتوحة (جديد / جاري التنفيذ) كتير مع بعض في القايمة يبقى سهل تفرّق
   بصريًا مين أحدث ومين قاعد بقاله وقت أطول محتاج ينفّذ الأول.
   الأولوية اليدوية لسه مش موجودة (متوافق مع WORK_ORDER_LIFECYCLE_APPROVED.md) —
   ده مجرد لون إرشادي بيتغير أوتوماتيك حسب الوقت، مش حقل بيتعدّل يدويًا. */
/* V11.54: ترميز لوني حسب عمر أمر الشغل (منذ تاريخ التسجيل)، عشان لو الأوامر
   المفتوحة (جديد / جاري التنفيذ) كتير مع بعض في القايمة يبقى سهل تفرّق
   بصريًا مين أحدث ومين قاعد بقاله وقت أطول محتاج ينفّذ الأول.
   الأولوية اليدوية لسه مش موجودة (متوافق مع WORK_ORDER_LIFECYCLE_APPROVED.md) —
   ده مجرد لون إرشادي بيتغير أوتوماتيك حسب الوقت، مش حقل بيتعدّل يدويًا.
   3 ألوان بس (مش 6) بناءً على طلب المستخدم، ومرتبطة بنفس رقم "تنبيه
   الأوامر القديمة" اللي المستخدم بيتحكم فيه من الإعدادات (s.overdueAlertDays):
   لو الأمر وصل لعدد الأيام ده أو أكتر يبقى أحمر (ونفسه اللي بيدخل عداد
   التنبيه في الداشبورد)، ونصّه تقريبًا يبقى أصفر، وأقل من كده أخضر. */
function requestAgeDays(r){
  let ms=requestAgeMs(r);
  return ms===null?null:Math.floor(ms/86400000)
}
function requestAgeInfo(r){
  if(!r||r.status==="مكتمل"||r.status==="ملغي")return null;
  let days=requestAgeDays(r);
  if(days===null)return null;
  let threshold=Number.isFinite(+settings().overdueAlertDays)&&+settings().overdueAlertDays>0?+settings().overdueAlertDays:7;
  let mid=Math.max(1,Math.floor(threshold/2));
  let cls,dot,range;
  if(days<mid){cls="age-b0";dot="🟢";range=`أقل من ${mid} يوم`}
  else if(days<threshold){cls="age-b1";dot="🟡";range=`من ${mid} لحد ${threshold-1} يوم`}
  else{cls="age-b2";dot="🔴";range=`${threshold} يوم فأكتر`}
  return{days,cls,dot,range,label:days===0?"جديد اليوم":(days===1?"من يوم":`من ${days} يوم`)}
}
function requestAgeLegendHtml(){
  let threshold=Number.isFinite(+settings().overdueAlertDays)&&+settings().overdueAlertDays>0?+settings().overdueAlertDays:7;
  let mid=Math.max(1,Math.floor(threshold/2));
  let items=[
    {cls:"age-b0",dot:"🟢",range:`أقل من ${mid} يوم`},
    {cls:"age-b1",dot:"🟡",range:`من ${mid} لحد ${threshold-1} يوم`},
    {cls:"age-b2",dot:"🔴",range:`${threshold} يوم فأكتر (بيدخل تنبيه الداشبورد)`}
  ];
  return `<div class="age-legend">${items.map(b=>`<span class="age-legend-item ${b.cls}">${b.dot} ${esc(b.range)}</span>`).join("")}</div>`
}
function requestIsStale(r){
  if(!r||r.status==="مكتمل"||r.status==="ملغي"||r.closed)return false;
  let days=requestAgeDays(r);
  if(days===null)return false;
  let threshold=Number.isFinite(+settings().overdueAlertDays)&&+settings().overdueAlertDays>0?+settings().overdueAlertDays:7;
  return days>=threshold
}
/* V11.56: نفس ترميز عمر الأمر، لكن معمَّم على أي قايمة أوامر (عميل/جهاز/خط
   سير) بحيث ياخد لون أسوأ (أقدم) أمر مفتوح فيها — نفس فكرة "افتح عليه
   أمر ومحتاج تتابعه" بس على مستوى العميل/الجهاز مش الأمر بس. */
function worstRequestAgeInfo(list){
  let best=null;
  (list||[]).forEach(r=>{
    let info=requestAgeInfo(r);
    if(info&&(!best||info.days>best.days))best=info;
  });
  return best;
}
/* V11.57: لون ثابت لكل تصنيف قطع غيار (غسالات/تلاجات/تكييفات...) عشان
   يبقى سهل تفرّق بينهم بصريًا في المخزن، بنفس فكرة تلوين عمر الأمر بس
   هنا اللون ثابت حسب التصنيف نفسه مش حسب الوقت. بيتحسب من هاش بسيط
   لاسم التصنيف، فأي تصنيف (حتى لو المستخدم ضاف واحد جديد من الإعدادات)
   ياخد لون ثابت تلقائي من غير أي إعداد إضافي.  */
var PART_CATEGORY_PALETTE=["cat-c0","cat-c1","cat-c2","cat-c3","cat-c4","cat-c5","cat-c6","cat-c7"];
function categoryColorClass(cat){
  let s=String(cat||"").trim();
  if(!s)return "";
  let h=0;
  for(let i=0;i<s.length;i++){h=(h*31+s.charCodeAt(i))>>>0}
  return PART_CATEGORY_PALETTE[h%PART_CATEGORY_PALETTE.length];
}
function requestStartedDate(r){return requestTimingDate(r,"startedAt",true)}
function requestCompletedDate(r){return requestTimingDate(r,"completedAt",true)}
function requestWorkshopStartedDate(r){
  if(!r)return null;
  if(r.workshopStartedAt){let d=new Date(r.workshopStartedAt);if(!Number.isNaN(d.getTime()))return d;}
  if(r.executionPlace==="الورشة")return requestStartedDate(r);
  return null;
}
function durationMs(start,end){
  if(!start||!end)return null;
  let n=new Date(end).getTime()-new Date(start).getTime();
  return Number.isFinite(n)&&n>=0?n:null;
}
function formatDuration(ms){
  if(ms===null||ms===undefined||!Number.isFinite(ms)||ms<0)return "—";
  let totalMin=Math.round(ms/60000),days=Math.floor(totalMin/1440),hours=Math.floor((totalMin%1440)/60),mins=totalMin%60;
  if(days)return `${days} يوم${days===1?"":""}${hours?` و ${hours} س`:""}`;
  if(hours)return `${hours} س${mins?` و ${mins} د`:""}`;
  return `${Math.max(0,mins)} د`;
}
function requestTotalCompletionMs(r){
  let s=requestCreatedDate(r),e=requestCompletedDate(r);
  return durationMs(s,e);
}
function requestWorkshopExecutionMs(r){
  let s=requestWorkshopStartedDate(r),e=requestCompletedDate(r);
  return durationMs(s,e);
}
function requestWorkshopEnteredDate(r){
  if(!r)return null;
  const value=r.workshopEnteredAt||r.pulledAt||r.workshopAt;
  if(value){let d=new Date(value);if(!Number.isNaN(d.getTime()))return d;}
  return r.executionPlace==="الورشة"?requestWorkshopStartedDate(r):null;
}
function requestWorkshopStayMs(r){
  let s=requestWorkshopEnteredDate(r),e=requestCompletedDate(r);
  return durationMs(s,e);
}
function requestAgeMs(r){
  let s=requestCreatedDate(r);if(!s)return null;
  let e=r?.status==="مكتمل"?requestCompletedDate(r):null;
  return durationMs(s,e||new Date());
}

function markPaidAndClose(i){
  let a=arr(K.r),r=a.find(x=>x.id===i);
  if(!r||r.closed||r.paid)return;
  if(r.status!=="مكتمل"){alert("اجعل حالة أمر الشغل «مكتمل» أولًا.");return}
  if(!confirm("تأكيد استلام كامل قيمة الأمر وإغلاقه نهائيًا؟ بعد التأكيد لن يمكن التعديل."))return;
  let wallet=document.getElementById("rCloseWallet")?.value||"";
  let now=new Date().toISOString();
  let collected=Math.max(0,(+r.total||0)-(+r.deposit||0));
  r.paid=true;
  r.remain=0;
  r.paidAt=now;
  r.closed=true;
  r.closedAt=now;
  r.closeWallet=wallet;
  put(K.r,a);
  if(typeof syncTreasuryForOrderClose==="function")syncTreasuryForOrderClose(r,collected);
  if(typeof syncWalletForOrderClose==="function")syncWalletForOrderClose(r,collected,wallet);
  location.reload();
}
function closeOrder(i){markPaidAndClose(i)}

/* K, get, put, arr, esc, id, settings, duplicateCustomerByPhone: منقولة لملف
   shared-data.js (لازم يتحمّل قبل app.js في كل صفحة) عشان تبقى نسخة واحدة
   يستخدمها كل الملفات بدل ما تتكرر في أكتر من مكان. */
function toggle(x){document.getElementById(x)?.classList.toggle("hidden")}
const QUICK_ADD_LABELS={quickCustomerBox:"➕ عميل",quickDeviceBox:"➕ جهاز",quickDeviceCustomerBox:"➕ عميل",qoCustomerBox:"➕ عميل",qoDeviceBox:"➕ جهاز"};
function toggleQuickAdd(boxId){let box=document.getElementById(boxId);if(!box)return;let btn=document.querySelector(`[data-opens="${boxId}"]`);let opening=box.classList.contains("hidden");box.classList.toggle("hidden");if(btn){btn.textContent=opening?"➖ إلغاء الإضافة":(QUICK_ADD_LABELS[boxId]||"➕ إضافة");btn.classList.toggle("quick-add-open",opening)}if(opening)setTimeout(()=>box.scrollIntoView({behavior:"smooth",block:"nearest"}),50)}
function closeQuickAdd(boxId){let box=document.getElementById(boxId);if(!box)return;box.classList.add("hidden");let btn=document.querySelector(`[data-opens="${boxId}"]`);if(btn){btn.textContent=QUICK_ADD_LABELS[boxId]||"➕ إضافة";btn.classList.remove("quick-add-open")}}

/* قسم الخزنة اتنقل لملف treasury.js (راجع الملف ده لو محتاج تعدل فيه). */

/* قسم المهام والمتابعة اتنقل لملف tasks.js (راجع الملف ده لو محتاج تعدل فيه). */
/* customerName, deviceName, addresses, addressText: منقولة لملف shared-data.js */
function fillCustomer(el,selected=""){if(!el)return;el.innerHTML='<option value="">اختر العميل</option>'+arr(K.c).map(x=>`<option value="${x.id}" ${x.id===selected?"selected":""}>${esc(x.name)} - ${esc(x.phone)}</option>`).join("")}
function fillAddress(el,cid,selected=""){let c=arr(K.c).find(x=>x.id===cid);if(!el){return}el.innerHTML='<option value="">اختر العنوان</option>'+(c?addresses(c).map(a=>`<option value="${a.key}" ${a.key===selected?"selected":""}>${esc(a.label)} — ${esc(addressText(a))}</option>`).join(""):"")}
function fillList(el,key,selected="",placeholder="اختر"){if(!el)return;let a=settings()[key]||[];let extra=selected&&!a.includes(selected)?[selected]:[];el.innerHTML=`<option value="">${placeholder}</option>`+a.concat(extra).map(x=>`<option value="${esc(x)}" ${x===selected?"selected":""}>${esc(x)}${extra.includes(x)?" (قديم/متوقف)":""}</option>`).join("")}
function dayKeyLocal(v){let d=new Date(v);return Number.isNaN(d.getTime())?"":`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`}
