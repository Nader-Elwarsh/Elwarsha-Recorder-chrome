/* app-settings.js — صفحة الإعدادات العامة: القوائم القابلة للتعديل والترتيب بالسحب، ثيم خط السير، المراكز/الأنواع/الماركات/تصنيفات القطع. */
function listEditorHtml(title,key,icon){
  let a=settings()[key]||[];
  return `<section class="panel setting-list-panel"><div class="page-head"><h2>${icon} ${title}</h2><button class="secondary mini-action" onclick="addSettingItem('${key}')">➕ إضافة</button></div><div class="drag-hint">☷ اسحب أي عنصر وأفلته في المكان المطلوب</div><div id="list-${key}" class="sortable-list">${a.map((x,i)=>`<div class="setting-row drag-item" draggable="true" data-drag-kind="list" data-drag-key="${esc(key)}" data-drag-index="${i}"><span class="drag-handle" title="سحب للترتيب">☷</span><span class="setting-name"><b>${i+1}.</b> ${esc(x)}</span><span class="compact-actions"><input class="order-number" type="number" min="1" max="${a.length}" value="${i+1}" title="رقم الترتيب" onchange="setListPosition('${key}',${i},this.value)"><button class="secondary mini-action" onclick="renameSettingItem('${key}',${i})">✏️</button><button class="secondary mini-action" onclick="deleteSettingItem('${key}',${i})">🗑️</button></span></div>`).join("")}</div></section>`
}
function orderTagsSettingHtml(){
  let s=settings(),active=s.orderTags||[],disabled=s.orderTagsDisabled||[];
  let activeRows=active.map((x,i)=>`<div class="setting-row"><span class="setting-name"><b>${i+1}.</b> ${esc(x)}</span><span class="compact-actions"><button class="secondary mini-action" onclick="moveOrderTag(${i},-1)" title="لأعلى">⬆️</button><button class="secondary mini-action" onclick="moveOrderTag(${i},1)" title="لأسفل">⬇️</button><button class="secondary mini-action" onclick="renameOrderTag('${esc(x)}')">✏️</button><button class="secondary mini-action" onclick="disableOrderTag('${esc(x)}')" title="إيقاف الاستخدام مؤقتًا بدون حذف">⏸️</button><button class="secondary mini-action" onclick="deleteOrderTag('${esc(x)}')">🗑️</button></span></div>`).join("");
  let disabledRows=disabled.map(x=>`<div class="setting-row setting-row-disabled"><span class="setting-name">🚫 ${esc(x)} <small>(متوقف)</small></span><span class="compact-actions"><button class="secondary mini-action" onclick="enableOrderTag('${esc(x)}')" title="إعادة التفعيل">▶️ تفعيل</button><button class="secondary mini-action" onclick="deleteOrderTag('${esc(x)}')">🗑️</button></span></div>`).join("");
  return `<section class="panel setting-list-panel" id="order-tags-panel"><div class="page-head"><h2>🏷️ التصنيف اليدوي لأوامر الشغل</h2><button class="secondary mini-action" onclick="addOrderTag()">➕ إضافة</button></div><div class="hint">التصنيفات دي بتظهر كخيارات في "التصنيف اليدوي" جوه كل أمر شغل. أوقف أي تصنيف (⏸️) من غير ما تحذفه لو مش هتستخدمه دلوقتي بس عايز تحتفظ بيه — التصنيف الموقوف بيفضل ظاهر في أي أمر شغل قديم مستخدمه بالفعل، بس مش هيبقى خيار متاح لأمر جديد لحد ما ترجّعه (▶️). الحذف النهائي (🗑️) بيشيله من القايمة تمامًا.</div>${activeRows||"<div class='hint'>لا توجد تصنيفات مضافة بعد.</div>"}${disabled.length?`<div class="setting-subhead">⏸️ متوقفة مؤقتًا</div>${disabledRows}`:""}</section>`;
}
function reorderSetting(kind,key,from,to){
  let s=settings();
  if(from===to||from<0||to<0)return;
  if(kind==='types'){
    let entries=Object.entries(s.types||{});if(from>=entries.length||to>=entries.length)return;
    let item=entries.splice(from,1)[0];entries.splice(to,0,item);s.types=Object.fromEntries(entries);
  }else{
    let a=kind==='villages'?(s.villages[key]||[]):(s[kind]||[]);
    if(from>=a.length||to>=a.length)return;
    let item=a.splice(from,1)[0];a.splice(to,0,item);
    if(kind==='villages')s.villages[key]=a;else s[kind]=a;
  }
  put(K.s,s);settingsPage();
}
function setListPosition(key,i,pos){
  let s=settings(),a=[...(s[key]||[])],n=parseInt(pos,10);
  if(!Number.isFinite(n))return settingsPage();n=Math.max(1,Math.min(a.length,n));
  if(i<0||i>=a.length||i===n-1)return;
  let item=a.splice(i,1)[0];a.splice(n-1,0,item);s[key]=a;put(K.s,s);settingsPage();
}
function bindSortableSettings(){
  document.querySelectorAll('.drag-item[draggable="true"]').forEach(el=>{
    el.addEventListener('dragstart',e=>{e.dataTransfer.effectAllowed='move';e.dataTransfer.setData('text/plain',JSON.stringify({kind:el.dataset.dragKind,key:el.dataset.dragKey||'',index:+el.dataset.dragIndex}));el.classList.add('dragging')});
    el.addEventListener('dragend',()=>el.classList.remove('dragging'));
    el.addEventListener('dragover',e=>{e.preventDefault();el.classList.add('drag-over');e.dataTransfer.dropEffect='move'});
    el.addEventListener('dragleave',()=>el.classList.remove('drag-over'));
    el.addEventListener('drop',e=>{e.preventDefault();el.classList.remove('drag-over');let raw=e.dataTransfer.getData('text/plain');if(!raw)return;try{let d=JSON.parse(raw);if(d.kind===el.dataset.dragKind&&(d.key||'')===(el.dataset.dragKey||''))reorderSetting(d.kind,d.kind==='villages'?d.key:(d.key||d.kind),d.index,+el.dataset.dragIndex)}catch(_){}});
  });
  // Touch/pointer fallback for phones where native HTML5 drag-and-drop is limited.
  document.querySelectorAll('.drag-handle').forEach(handle=>{
    let state=null;
    handle.addEventListener('pointerdown',e=>{
      if(e.pointerType==='mouse')return;
      let row=handle.closest('.drag-item');if(!row)return;
      state={row,startX:e.clientX,startY:e.clientY,kind:row.dataset.dragKind,key:row.dataset.dragKey||'',index:+row.dataset.dragIndex,moved:false};
      handle.setPointerCapture?.(e.pointerId);row.classList.add('dragging');e.preventDefault();
    });
    handle.addEventListener('pointermove',e=>{
      if(!state)return;
      if(Math.abs(e.clientY-state.startY)>6)state.moved=true;
      if(!state.moved)return;
      let target=document.elementFromPoint(e.clientX,e.clientY)?.closest('.drag-item');
      document.querySelectorAll('.drag-over').forEach(x=>x.classList.remove('drag-over'));
      if(target&&target!==state.row&&target.dataset.dragKind===state.kind&&(target.dataset.dragKey||'')===state.key)target.classList.add('drag-over');
      e.preventDefault();
    });
    handle.addEventListener('pointerup',e=>{
      if(!state)return;let target=document.elementFromPoint(e.clientX,e.clientY)?.closest('.drag-item');
      let d=state;state=null;d.row.classList.remove('dragging');document.querySelectorAll('.drag-over').forEach(x=>x.classList.remove('drag-over'));
      if(target&&target!==d.row&&d.moved&&target.dataset.dragKind===d.kind&&(target.dataset.dragKey||'')===d.key)reorderSetting(d.kind,d.kind==='villages'?d.key:(d.key||d.kind),d.index,+target.dataset.dragIndex);
      e.preventDefault();
    });
    handle.addEventListener('pointercancel',()=>{if(state){state.row.classList.remove('dragging');state=null;document.querySelectorAll('.drag-over').forEach(x=>x.classList.remove('drag-over'))}});
  });
}
function settingsPage(){
  if(!document.getElementById("centerSettings"))return;
  let s=settings();
  centerSettings.innerHTML=s.centers.map((c,i)=>`<div class="setting-row drag-item" draggable="true" data-drag-kind="centers" data-drag-index="${i}"><span class="drag-handle" title="سحب للترتيب">☷</span><span class="setting-name"><b>${i+1}. 📍 ${esc(c)}</b></span><span class="compact-actions"><input class="order-number" type="number" min="1" max="${s.centers.length}" value="${i+1}" title="رقم الترتيب" onchange="setListPosition('centers',${i},this.value)"><button class="secondary mini-action" onclick="renameCenter('${esc(c)}')">✏️</button><button class="secondary mini-action" onclick="deleteCenter('${esc(c)}')">🗑️</button></span></div><div class="village-box">${(s.villages[c]||[]).map((v,j)=>`<div class="village-row drag-item" draggable="true" data-drag-kind="villages" data-drag-key="${esc(c)}" data-drag-index="${j}"><span class="drag-handle" title="سحب للترتيب">☷</span><input class="order-number" type="number" min="1" max="${(s.villages[c]||[]).length}" value="${j+1}" title="رقم ترتيب القرية" onchange="setVillagePosition('${esc(c)}',${j},this.value)"><span class="village-name">${esc(v)}</span><span class="compact-actions"><button class="mini-action" title="تصنيف الخط: مدينة أو قرية — دوس للتبديل" onclick="toggleVillageGroup('${esc(c)}','${esc(v)}')">${villageGroupOf(c,v)==="city"?"🏙️":"🌾"}</button><button class="mini-action" title="تعديل الاسم" onclick="renameVillage('${esc(c)}','${esc(v)}')">✏️</button><button class="mini-action" title="حذف" onclick="deleteVillage('${esc(c)}','${esc(v)}')">🗑️</button></span></div>`).join("")}<button class="secondary mini-action" onclick="addVillage('${esc(c)}')">➕ قرية</button></div>`).join("");
  typeSettings.innerHTML=Object.entries(s.types).map(([t,c],i)=>`<div class="setting-row drag-item" draggable="true" data-drag-kind="types" data-drag-index="${i}"><span class="drag-handle" title="سحب للترتيب">☷</span><span class="setting-name"><b>${i+1}. ${esc(t)}</b></span><span class="compact-actions"><input class="order-number" type="number" min="1" max="${Object.keys(s.types).length}" value="${i+1}" title="رقم الترتيب" onchange="setTypePosition(${i},this.value)"><button class="secondary mini-action" onclick="renameType('${esc(t)}')">✏️</button><button class="secondary mini-action" onclick="deleteType('${esc(t)}')">🗑️</button></span></div><div class="hint type-options">${c.join("، ")||"لا توجد"} <button class="secondary mini-action" onclick="editTypeOptions('${esc(t)}')">✏️ تعديل التصنيفات</button></div>`).join("");
  brandSettings.innerHTML=s.brands.map((b,i)=>`<div class="setting-row drag-item" draggable="true" data-drag-kind="brands" data-drag-index="${i}"><span class="drag-handle" title="سحب للترتيب">☷</span><span class="setting-name"><b>${i+1}. ${esc(b)}</b></span><span class="compact-actions"><input class="order-number" type="number" min="1" max="${s.brands.length}" value="${i+1}" title="رقم الترتيب" onchange="setListPosition('brands',${i},this.value)"><button class="secondary mini-action" onclick="renameBrand('${esc(b)}')">✏️</button><button class="secondary mini-action" onclick="deleteBrand('${esc(b)}')">🗑️</button></span></div>`).join("");
  partCategorySettings.innerHTML=s.partCats.map((b,i)=>`<div class="setting-row drag-item" draggable="true" data-drag-kind="partCats" data-drag-index="${i}"><span class="drag-handle" title="سحب للترتيب">☷</span><span class="setting-name"><b>${i+1}. ${esc(b)}</b></span><span class="compact-actions"><input class="order-number" type="number" min="1" max="${s.partCats.length}" value="${i+1}" title="رقم الترتيب" onchange="setListPosition('partCats',${i},this.value)"><button class="secondary mini-action" onclick="renamePartCategory('${esc(b)}')">✏️</button><button class="secondary mini-action" onclick="deletePartCategory('${esc(b)}')">🗑️</button></span></div>`).join("");
  let host=document.getElementById("settingsDynamic");
  if(host)host.innerHTML=`<section class="panel setting-list-panel"><div class="page-head"><h2>🛠️ دورة حالات أمر الشغل</h2></div><div class="hint">الحالات (جديد / جاري التنفيذ / مكتمل / ملغي) وحالات الورشة (غير مطلوب / تم السحب / تم التسليم) بقت دورة معتمدة وثابتة، ومش قابلة للتعديل من هنا. الأولوية اتشالت خالص من أوامر الشغل. راجع ملف WORK_ORDER_LIFECYCLE_APPROVED.md لتفاصيل الدورة والانتقالات المسموحة.</div></section>`+returnWindowSettingHtml()+overdueAlertSettingHtml()+orderTagsSettingHtml()+[["أماكن التنفيذ","executionPlaces","📍"],["حالات الدفع","paymentStatuses","💳"],["وحدات القياس","units","📏"],["أنواع العناوين","addressTypes","🏠"]].map(x=>listEditorHtml(...x)).join("");
  let walletHost=document.getElementById("walletSettingsDynamic");
  if(walletHost)walletHost.innerHTML=defaultWalletSettingHtml()+[["الحسابات (محفظتي الشخصية، فودافون كاش، أورنج كاش، إنستاباي... أضف أي حساب تحب)","wallets","💳"],["التصنيف (شخصي / تشغيل / تحصيل عميل / سلفة تحويل / أخرى...)","walletCategories","🏷️"]].map(x=>inlineListEditorHtml(...x)).join("")+[["نوع المصروف — لما التصنيف \"مصروف تشغيل\" (وقود، صيانة عدة...)","expenseCategories","🧯"],["نوع المصروف — لما التصنيف \"مصروف شخصي\" (مواصلات، أكل وشرب...)","personalExpenseCategories","🙋"]].map(x=>listEditorHtml(...x)).join("")+walletCapsSettingHtml();
  let rtHost=document.getElementById("routeThemeSettings");
  if(rtHost)rtHost.innerHTML=routeThemeSettingsHtml();
  bindSortableSettings();
}
function defaultWalletSettingHtml(){
  let s=settings(),wallets=s.wallets||[],cur=s.defaultWallet||"";
  return `<section class="panel setting-list-panel" id="default-wallet-panel"><div class="page-head"><h2>⭐ المحفظة الافتراضية</h2></div><div class="hint">أي دفعة/عربون أو تقفيل أمر شغل هيتحدد له تلقائي المحفظة دي، إلا لو غيّرتها بنفسك وقت العملية.</div><select id="defaultWalletSelect" onchange="setDefaultWallet(this.value)"><option value="">بدون تحديد افتراضي</option>${wallets.map(w=>`<option ${cur===w?"selected":""}>${esc(w)}</option>`).join("")}</select></section>`;
}
function setDefaultWallet(v){let s=settings();s.defaultWallet=v||"";put(K.s,s);settingsPage()}
/* ---------------------------------------------------------------------
   حد أقصى اختياري لأي حساب (مثال شائع: إنستاباي — بدل ما يتسجل رصيد
   حسابك البنكي الشخصي بالكامل، تحط رقم تقريبي كحد أقصى، وأي رصيد فعلي
   أعلى منه بيتقف عنده في العرض والإجمالي فقط، من غير ما يأثر على كشف
   الحركات الفعلي نفسه).
--------------------------------------------------------------------- */
function walletCapsSettingHtml(){
  let s=settings(),wallets=s.wallets||[],caps=s.walletCaps||{};
  return `<section class="panel setting-list-panel" id="wallet-caps-panel">
    <div class="page-head"><h2>🔒 حد أقصى اختياري لبعض الحسابات</h2></div>
    <div class="hint">مفيد لحساب زي إنستاباي لو مش عايز تسجّله هنا بكامل رصيده الحقيقي (لأنه في الأصل جزء من حسابك البنكي الشخصي) — حط رقم تقريبي، وهو ده اللي هيدخل في رصيد المحفظة المعروض وفي إجمالي كل الحسابات، حتى لو الحركات الفعلية المسجلة جمعت لرقم أعلى. سيبه فاضي لأي محفظة تحب تحسب برصيدها الحقيقي كامل بدون حد.</div>
    ${wallets.length?wallets.map(w=>`<div class="setting-row inline-edit-row">
      <span class="setting-name">${esc(w)}</span>
      <input type="number" min="0" step="0.01" class="inline-edit-input" placeholder="بدون حد" value="${caps[w]!==undefined&&caps[w]!==null&&caps[w]!==""?esc(String(caps[w])):""}" onchange="setWalletCap('${esc(w)}',this.value)">
    </div>`).join(""):`<div class="hint">أضف حسابات أولًا من قسم "الحسابات" فوق.</div>`}
  </section>`;
}
function setWalletCap(walletName,v){
  let s=settings();s.walletCaps=s.walletCaps||{};
  v=(v||"").trim();
  if(!v)delete s.walletCaps[walletName];
  else{let n=+v;if(!Number.isFinite(n)||n<0)return alert("اكتب رقم صحيح موجب، أو سيب الخانة فاضية لإلغاء الحد الأقصى.");s.walletCaps[walletName]=n;}
  put(K.s,s);settingsPage();
}
function returnWindowSettingHtml(){
  let s=settings(),days=+s.returnWindowDays||7;
  return `<section class="panel setting-list-panel" id="return-window-panel"><div class="page-head"><h2>🔄 مهلة المرتجع بعد إغلاق الأمر</h2></div><div class="hint">أمر الشغل المكتمل وغير المغلق يفضل قابل للإرجاع/التعديل في أي وقت. أما بعد "تم الدفع بالكامل وإغلاق الأمر"، فبيبقى قابل للإرجاع فقط خلال عدد الأيام ده من تاريخ الإغلاق؛ بعدها مفيش مرتجع ولا تعديل.</div><div class="inline"><input id="returnWindowDaysInput" type="number" min="1" step="1" value="${days}" style="max-width:110px"><button class="secondary mini-action" onclick="setReturnWindowDays()">💾 حفظ المدة</button><span class="hint">حاليًا: ${days} يوم</span></div></section>`;
}
function setReturnWindowDays(){
  let el=document.getElementById("returnWindowDaysInput"),n=parseInt(el?.value,10);
  if(!Number.isFinite(n)||n<1){alert("اكتب عدد أيام صحيح (1 على الأقل).");return}
  let s=settings();s.returnWindowDays=n;put(K.s,s);settingsPage();
}
function overdueAlertSettingHtml(){
  let s=settings(),days=+s.overdueAlertDays||7,mid=Math.max(1,Math.floor(days/2));
  return `<section class="panel setting-list-panel" id="overdue-alert-panel"><div class="page-head"><h2>⏳ تنبيه الأوامر القديمة (لسه واقفة)</h2></div><div class="hint">أي أمر شغل مفتوح (جديد أو جاري التنفيذ) لو فضل من غير ما يتقفل عدد الأيام ده أو أكتر من تاريخ تسجيله، هيتلوّن 🔴 أحمر في قايمة الأوامر ويظهر في تنبيه "🔥 يحتاج انتباه" بالشاشة الرئيسية. اللون بيتدرّج تلقائي: 🟢 أقل من ${mid} يوم، 🟡 من ${mid} لحد ${Math.max(mid,days-1)} يوم، 🔴 ${days} يوم فأكتر.</div><div class="inline"><input id="overdueAlertDaysInput" type="number" min="1" step="1" value="${days}" style="max-width:110px"><button class="secondary mini-action" onclick="setOverdueAlertDays()">💾 حفظ العدد</button><span class="hint">حاليًا: ${days} يوم</span></div></section>`;
}
function setOverdueAlertDays(){
  let el=document.getElementById("overdueAlertDaysInput"),n=parseInt(el?.value,10);
  if(!Number.isFinite(n)||n<1){alert("اكتب عدد أيام صحيح (1 على الأقل).");return}
  let s=settings();s.overdueAlertDays=n;put(K.s,s);settingsPage();
}
function routeThemeSettingsHtml(){
  let s=settings(),theme=s.routeTheme||"dark",color=s.routeThemeColor||"#17181b";
  let opt=(val,label,emoji)=>`<button type="button" class="secondary mini-action route-theme-opt${theme===val?" active-opt":""}" onclick="setRouteTheme('${val}')">${emoji} ${label}</button>`;
  return `<div class="compact-actions">${opt("auto","تلقائي (حسب النظام)","📱")}${opt("dark","داكن","🌙")}${opt("light","فاتح","☀️")}${opt("custom","لون مخصص","🎨")}</div>`
    +(theme==="custom"?`<div class="inline" style="margin-top:8px;align-items:center"><input type="color" id="routeThemeColorInput" value="${color}" onchange="setRouteThemeColor(this.value)"><span class="hint">اختر أي لون تفضله للخلفية</span></div>`:"");
}
function setRouteTheme(v){let s=settings();s.routeTheme=v;put(K.s,s);settingsPage()}
function setRouteThemeColor(v){let s=settings();s.routeTheme="custom";s.routeThemeColor=v;put(K.s,s);settingsPage()}
function setTypePosition(i,pos){let n=parseInt(pos,10),entries=Object.entries(settings().types||{});if(!Number.isFinite(n))return settingsPage();n=Math.max(1,Math.min(entries.length,n));if(i<0||i>=entries.length||i===n-1)return;let item=entries.splice(i,1)[0];entries.splice(n-1,0,item);let s=settings();s.types=Object.fromEntries(entries);put(K.s,s);settingsPage()}
function addCenter(){let el=document.getElementById("newCenter"),v=el&&el.value?el.value:prompt("اسم المركز الجديد");if(!v)return;v=v.trim();if(!v)return;let s=settings();if(!s.centers.includes(v)){s.centers.push(v);s.villages[v]=s.villages[v]||[]}put(K.s,s);if(el)el.value="";settingsPage()}
function renameCenter(c){let n=prompt("الاسم الجديد للمركز",c);if(!n||n===c)return;n=n.trim();if(!n)return;let s=settings(),i=s.centers.indexOf(c);if(i<0)return;s.centers[i]=n;s.villages[n]=s.villages[c]||[];if(n!==c)delete s.villages[c];put(K.s,s);settingsPage()}
function deleteCenter(c){if(!confirm(`حذف المركز «${c}» وكل قراه؟`))return;let s=settings();s.centers=s.centers.filter(x=>x!==c);delete s.villages[c];put(K.s,s);settingsPage()}
function addType(){let t=prompt("اسم نوع الجهاز الجديد");if(!t)return;t=t.trim();if(!t)return;let s=settings();if(!(t in s.types))s.types[t]=[];put(K.s,s);settingsPage()}
function renameType(t){let n=prompt("الاسم الجديد للنوع",t);if(!n||n===t)return;n=n.trim();if(!n)return;let s=settings();if(!(t in s.types))return;if(n in s.types&&n!==t){alert("هذا النوع موجود بالفعل");return}let entries=Object.entries(s.types).map(([k,v])=>[k===t?n:k,v]);s.types=Object.fromEntries(entries);put(K.s,s);settingsPage()}
function deleteType(t){if(!confirm(`حذف نوع الجهاز «${t}» وكل تصنيفاته؟`))return;let s=settings();delete s.types[t];put(K.s,s);settingsPage()}
function addBrand(){let v=prompt("اسم الماركة الجديدة");if(!v)return;v=v.trim();if(!v)return;let s=settings();if(!s.brands.includes(v))s.brands.push(v);put(K.s,s);settingsPage()}
function deleteBrand(b){if(!confirm(`حذف الماركة «${b}»؟`))return;let s=settings();s.brands=s.brands.filter(x=>x!==b);put(K.s,s);settingsPage()}
function addPartCategory(){let v=prompt("اسم تصنيف القطع الجديد");if(!v)return;v=v.trim();if(!v)return;let s=settings();if(!s.partCats.includes(v))s.partCats.push(v);put(K.s,s);settingsPage()}
function deletePartCategory(c){if(!confirm(`حذف تصنيف «${c}»؟`))return;let s=settings();s.partCats=s.partCats.filter(x=>x!==c);put(K.s,s);settingsPage()}
function addSettingItem(key){let v=prompt("أضف عنصر جديد");if(!v)return;v=v.trim();if(!v)return;let s=settings();s[key]=s[key]||[];if(!s[key].includes(v))s[key].push(v);put(K.s,s);settingsPage()}
function renameSettingItem(key,i){let s=settings(),a=s[key]||[];if(i<0||i>=a.length)return;let n=prompt("الاسم الجديد",a[i]);if(!n||n===a[i])return;n=n.trim();if(!n)return;a[i]=n;s[key]=a;put(K.s,s);settingsPage()}
function deleteSettingItem(key,i){let s=settings(),a=s[key]||[];if(i<0||i>=a.length)return;if(!confirm(`حذف «${a[i]}»؟`))return;a.splice(i,1);s[key]=a;put(K.s,s);settingsPage()}

/* =========================================================
   محرّر قوائم بديل — بدون prompt()/confirm() (مستخدم للمحافظ وتصنيفاتها)
   =========================================================
   السبب: addSettingItem/renameSettingItem/deleteSettingItem فوق دول
   بيعتمدوا بالكامل على window.prompt() و window.confirm(). بعض
   المتصفحات المدمجة (زي واجهة WebView جوه تطبيق مثبّت كـ PWA على بعض
   الأجهزة، أو المتصفح المصغّر جوه واتساب/فيسبوك) بتمنع الـ popup ده
   بصمت تام: بترجع null/false على طول من غير أي رسالة خطأ في الكونسول
   حتى، فبيبان الزرار "مش شغال" مع إنه فعليًا بينفذ لكن بياخد قيمة فاضية
   ويوقف بصمت. عشان كده قسم المحافظ تحديدًا بيستخدم حقول <input> مباشرة
   بدل الـ popup، فمفيش أي اعتماد على إذا كان المتصفح بيسمح بيه أو لأ.
   ========================================================= */
function inlineListEditorHtml(title,key,icon){
  let a=settings()[key]||[];
  return `<section class="panel setting-list-panel">
    <div class="page-head"><h2>${icon} ${esc(title)}</h2></div>
    <div class="inline-add-row">
      <input type="text" id="newInlineItem-${esc(key)}" placeholder="اسم جديد" onkeydown="if(event.key==='Enter'){event.preventDefault();addInlineListItem('${esc(key)}')}">
      <button type="button" class="primary mini-action" onclick="addInlineListItem('${esc(key)}')">➕ إضافة</button>
    </div>
    <div class="sortable-list">
      ${a.length?a.map((x,i)=>`<div class="setting-row inline-edit-row">
        <span class="setting-name"><b>${i+1}.</b></span>
        <input type="text" class="inline-edit-input" value="${esc(x)}" onchange="renameInlineListItem('${esc(key)}',${i},this.value)">
        <span class="compact-actions">
          <button type="button" class="secondary mini-action" ${i===0?"disabled":""} onclick="moveInlineListItem('${esc(key)}',${i},-1)">⬆️</button>
          <button type="button" class="secondary mini-action" ${i===a.length-1?"disabled":""} onclick="moveInlineListItem('${esc(key)}',${i},1)">⬇️</button>
          <button type="button" class="secondary mini-action" onclick="confirmClick(this,()=>deleteInlineListItem('${esc(key)}',${i}))">🗑️</button>
        </span>
      </div>`).join(""):`<div class="hint">لا توجد عناصر بعد. أضف واحد من الحقل فوق.</div>`}
    </div>
  </section>`;
}
// تأكيد حذف بدون confirm(): أول ضغطة تحوّل الزرار لـ "تأكيد الحذف؟" لمدة
// 3 ثواني، وثاني ضغطة (في نفس المهلة) هي اللي فعليًا بتنفذ الحذف.
function confirmClick(btn,fn){
  if(btn.dataset.confirming==="1"){fn();return}
  btn.dataset.confirming="1";let orig=btn.textContent;btn.textContent="تأكيد الحذف؟";btn.classList.add("danger-btn");
  clearTimeout(btn._confirmTimer);
  btn._confirmTimer=setTimeout(()=>{btn.dataset.confirming="0";btn.textContent=orig;btn.classList.remove("danger-btn")},3000);
}
function addInlineListItem(key){
  let el=document.getElementById("newInlineItem-"+key);let v=(el?.value||"").trim();if(!v)return;
  let s=settings();s[key]=s[key]||[];if(!s[key].includes(v))s[key].push(v);put(K.s,s);
  settingsPage();
  let refocus=document.getElementById("newInlineItem-"+key);refocus?.focus();
}
function renameInlineListItem(key,i,v){
  v=(v||"").trim();let s=settings(),a=s[key]||[];if(i<0||i>=a.length)return;
  if(!v){settingsPage();return} // رجوع للاسم القديم لو مسحه فاضي بدل ما يحفظ قيمة فاضية
  let old=a[i];a[i]=v;s[key]=a;
  if(key==="wallets"&&s.walletCaps&&old in s.walletCaps&&old!==v){s.walletCaps[v]=s.walletCaps[old];delete s.walletCaps[old]}
  put(K.s,s);settingsPage();
}
function deleteInlineListItem(key,i){
  let s=settings(),a=s[key]||[];if(i<0||i>=a.length)return;
  let removed=a[i];a.splice(i,1);s[key]=a;
  if(key==="wallets"&&s.walletCaps&&removed in s.walletCaps)delete s.walletCaps[removed];
  put(K.s,s);settingsPage();
}
function moveInlineListItem(key,i,dir){
  let s=settings(),a=s[key]||[],j=i+dir;if(j<0||j>=a.length)return;[a[i],a[j]]=[a[j],a[i]];s[key]=a;put(K.s,s);settingsPage();
}


