/* app-restock.js — قسمين مرتبطين ببعض:

   1) نافذة موحّدة "إضافة قطعة جديدة للمخزن" (quickAddPart...) — بتتفتح من أي بحث
      عن قطعة غيار في النظام (قطع الغيار المستخدمة في الأمر، إضافة قطعة لأمر
      شغل قائم، شاشة التوريد تحت) لو الاسم اللي اتكتب مش موجود في المخزن.
      النافذة بتتبني ديناميكيًا وتتضاف لل body مرة واحدة بس وتتشارك بين كل
      الأماكن دي، بدل ما نكرر نموذج القطعة الكامل في كل شاشة على حدة.

   2) "توريد جديد" في شاشة المخزن: زيادة كمية صنف موجود (مع تحديث اختياري
      لسعر الشراء) أو إضافة صنف جديد بأول كمية له — الاتنين بيتسجلوا كحركة
      "توريد" في سجل حركات المخزن (K.m) عشان يبانوا في تقرير المخزن وسجل
      الصنف، بخلاف حركات "الخروج/الإرجاع" اللي بتتسجل تلقائي مع أوامر الشغل. */

/* ---------------------- 1) نافذة إضافة قطعة جديدة موحّدة ---------------------- */

let _qapCtx = null;

function _ensureQuickAddPartBox() {
  let box = document.getElementById("quickAddPartBox");
  if (box) return box;
  box = document.createElement("section");
  box.id = "quickAddPartBox";
  box.className = "quick-add hidden wide";
  box.innerHTML = `
    <h3>➕ إضافة قطعة جديدة للمخزن</h3>
    <div class="form-grid">
      <label class="wide">اسم القطعة<input id="qapName"></label>
      <label>التصنيف<div class="part-autocomplete"><input type="text" id="qapCategorySearch" class="part-autocomplete-input" placeholder="🔍 اكتب اسم التصنيف..." autocomplete="off" oninput="filterListOptions('qapCategory', this.value)" onfocus="filterListOptions('qapCategory', this.value)" onblur="hideListResults('qapCategory')"><input type="hidden" id="qapCategory"><div id="qapCategoryResults" class="part-autocomplete-results hidden"></div></div></label>
      <label>الكود <small>اختياري</small><input id="qapCode"></label>
      <label>الكمية الأولى<input id="qapQty" type="number" min="0" value="1"></label>
      <label>سعر الشراء<input id="qapBuy" type="number" min="0" step=".01" value="0"></label>
      <label>سعر الاستخدام<input id="qapUse" type="number" min="0" step=".01" value="0"></label>
    </div>
    <div class="actions">
      <button type="button" class="primary" onclick="saveQuickAddPart()">💾 حفظ القطعة</button>
      <button type="button" class="secondary" onclick="closeQuickAddPart()">إلغاء</button>
    </div>`;
  document.body.appendChild(box);
  return box;
}

/* name: الاسم المكتوب في مربع البحث اللي فتح منه المستخدم الإضافة (بيتحط
   كقيمة مبدئية قابلة للتعديل). ctx.onCreated(part): بيتنفّذ بعد الحفظ عشان
   الشاشة اللي فتحت النافذة تختار الصنف الجديد تلقائيًا (زي أي quick-add تاني
   في النظام). ctx.defaultQty: كمية مبدئية مقترحة (مثلاً لو جاي من شاشة توريد). */
function openQuickAddPart(name, ctx = {}) {
  _qapCtx = ctx;
  const box = _ensureQuickAddPartBox();
  document.getElementById("qapName").value = (name || "").trim();
  fillListSearch("qapCategory", "partCat", "");
  document.getElementById("qapCode").value = "";
  document.getElementById("qapQty").value = ctx.defaultQty ?? 1;
  document.getElementById("qapBuy").value = "";
  document.getElementById("qapUse").value = "";
  box.classList.remove("hidden");
  box.scrollIntoView({ behavior: "smooth", block: "center" });
  document.getElementById("qapName")?.focus();
}

function closeQuickAddPart() {
  document.getElementById("quickAddPartBox")?.classList.add("hidden");
  _qapCtx = null;
}

function saveQuickAddPart() {
  const name = (document.getElementById("qapName")?.value || "").trim();
  if (!name) return alert("اكتب اسم القطعة.");
  const dup = findDuplicatePartName(name);
  if (dup) return alert(`⚠️ الصنف «${dup.name}» موجود بالفعل بنفس الاسم. اختره من نتائج البحث بدل ما تضيفه مرة تانية.`);
  const category = document.getElementById("qapCategory")?.value || "";
  if (!category) return alert("اختر تصنيف القطعة (أو أضف تصنيف جديد من نفس المربع).");
  const code = (document.getElementById("qapCode")?.value || "").trim();
  const dupCode = code ? findDuplicatePartCode(code) : null;
  if (dupCode) return alert(`⚠️ الكود «${code}» مستخدم بالفعل مع «${dupCode.name}». اختر كودًا مختلفًا أو اتركه فاضي.`);
  const qty = +(document.getElementById("qapQty")?.value || 0);
  const buy = +(document.getElementById("qapBuy")?.value || 0);
  const use = +(document.getElementById("qapUse")?.value || 0);
  if (!Number.isFinite(qty) || qty < 0) return alert("اكتب كمية أولى صحيحة (صفر أو أكبر).");
  if (!Number.isFinite(buy) || buy < 0 || !Number.isFinite(use) || use < 0) return alert("اكتب أسعار صحيحة.");
  const p = { id: id(), name, category, code, location: "", qty, min: 0, buy, use, photo: "", createdAt: new Date().toISOString() };
  const all = arr(K.p);
  all.push(p);
  if (!saveJSONSafe(K.p, all)) return;
  if (qty > 0) {
    const moves = arr(K.m);
    moves.push({ id: id(), partId: p.id, type: "توريد", note: "إضافة صنف جديد", qty, at: new Date().toISOString() });
    put(K.m, moves);
  }
  closeQuickAddPart();
  refreshAllScreens?.();
  renderParts?.();
  const ctx = _qapCtx;
  _qapCtx = null;
  if (ctx?.onCreated) ctx.onCreated(p);
}

/* ---------------------- 2) توريد جديد (شاشة المخزن) ---------------------- */

function toggleRestockBox() {
  const box = document.getElementById("restockBox");
  if (!box) return;
  box.classList.toggle("hidden");
  if (!box.classList.contains("hidden")) {
    document.getElementById("stkPart").value = "";
    document.getElementById("stkPartSearch").value = "";
    document.getElementById("stkQty").value = 1;
    document.getElementById("stkBuy").value = "";
    document.getElementById("stkNote").value = "";
    document.getElementById("stkCurrentHint").textContent = "اكتب اسم القطعة أو الكود، أو اسم صنف جديد عشان تضيفه.";
    document.getElementById("stkPartSearch")?.focus();
  }
}

function filterRestockPartOptions(q) {
  const box = document.getElementById("stkPartResults");
  if (!box) return;
  const hidden = document.getElementById("stkPart");
  if (hidden) hidden.value = "";
  q = String(q ?? document.getElementById("stkPartSearch")?.value ?? "").trim();
  const list = arr(K.p).filter(p => !p.archived);
  const qLower = q.toLowerCase();
  const matches = (q ? list.filter(p => (p.name || "").toLowerCase().includes(qLower) || (p.code || "").toLowerCase().includes(qLower)) : list).slice(0, 50);
  let html = matches.length
    ? matches.map(p => `<div class="part-ac-item" data-value="${esc(p.id)}"><b>${esc(p.name)}</b><span>الحالي: ${+p.qty || 0}</span></div>`).join("")
    : '<div class="part-ac-empty">لا توجد أصناف مطابقة.</div>';
  if (q && !list.some(p => (p.name || "").toLowerCase() === qLower)) {
    html += `<div class="part-ac-item ac-add-new" data-newpart="${esc(q)}"><b>➕ "${esc(q)}" صنف جديد — إضافته للمخزن</b></div>`;
  }
  box.innerHTML = html;
  box.querySelectorAll("[data-value]").forEach(item => {
    item.onmousedown = () => selectRestockPart(item.dataset.value);
  });
  box.querySelectorAll("[data-newpart]").forEach(item => {
    item.onmousedown = () => {
      const typedName = item.dataset.newpart;
      const qty = +(document.getElementById("stkQty")?.value || 1);
      box.classList.add("hidden");
      openQuickAddPart(typedName, {
        defaultQty: Number.isFinite(qty) && qty > 0 ? qty : 1,
        onCreated: (p) => {
          toggleRestockBox();
          alert(`✅ تمت إضافة الصنف الجديد «${p.name}» للمخزن بكمية ${p.qty}.`);
        }
      });
    };
  });
  box.classList.remove("hidden");
}

function selectRestockPart(pid) {
  const p = arr(K.p).find(x => x.id === pid);
  if (!p) return;
  const hidden = document.getElementById("stkPart"), search = document.getElementById("stkPartSearch"), box = document.getElementById("stkPartResults"), hint = document.getElementById("stkCurrentHint"), buyEl = document.getElementById("stkBuy");
  if (hidden) hidden.value = pid;
  if (search) search.value = p.name;
  if (box) box.classList.add("hidden");
  if (hint) hint.textContent = `الكمية الحالية: ${+p.qty || 0} — سعر الشراء الحالي: ${(+p.buy || 0).toFixed(2)} ج.`;
  if (buyEl) buyEl.placeholder = (+p.buy || 0).toFixed(2);
}

function hideRestockPartResults() {
  setTimeout(() => document.getElementById("stkPartResults")?.classList.add("hidden"), 150);
}

function saveRestock() {
  const pid = document.getElementById("stkPart")?.value || "";
  if (!pid) return alert("اختر قطعة موجودة من نتائج البحث، أو استخدم خيار «صنف جديد» لو مش موجودة.");
  const qty = +(document.getElementById("stkQty")?.value || 0);
  if (!Number.isFinite(qty) || qty < 1) return alert("اكتب كمية واردة صحيحة (أكبر من صفر).");
  const buyEl = document.getElementById("stkBuy"), note = (document.getElementById("stkNote")?.value || "").trim();
  const all = arr(K.p), p = all.find(x => x.id === pid);
  if (!p) return alert("القطعة غير موجودة (ربما اتحذفت). جرّب تدور تاني.");
  p.qty = (+p.qty || 0) + qty;
  if (buyEl?.value !== "" && buyEl?.value != null) {
    const nb = +buyEl.value;
    if (Number.isFinite(nb) && nb >= 0) p.buy = nb;
  }
  if (!saveJSONSafe(K.p, all)) return;
  const moves = arr(K.m);
  moves.push({ id: id(), partId: pid, type: "توريد", note, qty, at: new Date().toISOString() });
  put(K.m, moves);
  refreshAllScreens?.();
  renderParts?.();
  alert(`✅ تم تسجيل توريد ${qty} من «${p.name}». الكمية الحالية الآن: ${p.qty}.`);
  toggleRestockBox();
}
