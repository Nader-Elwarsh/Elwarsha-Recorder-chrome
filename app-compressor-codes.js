/* =========================================================
   الورشة الفنية — أكواد الكباسات (app-compressor-codes.js)
   =========================================================
   مرجع بحث عن قدرات الكباسات (قاعدة موديلات ومواصفات عبر 56 ماركة)،
   مأخوذ من ملف إكسل مرجعي وحُوّل لقاعدة بيانات ثابتة منظمة في
   compressor-db.js (window.COMPRESSOR_DB). كل سجل موحّد الحقول:
   model, hp (نسبة حصان زي 1/6 أو 1 1/2), refrigerant, btu, kcal,
   application, run_capacitor, start_capacitor, oil_qty/oil_unit,
   amp, watt, freq, displacement, rpm, temp_capacity{}, notes, extra{}.

   طبقة إضافات محلية فوق القاعدة الأصلية (بدون أي تعديل في المرجع نفسه):
   - مفضلة: كباسات بتستخدمها كتير، تفتحها بضغطة من غير بحث.
   - إضافات يدوية: موديلات ناقصة تضيفها إنت وتتخزن في localStorage.
   ========================================================= */
(function (window) {
  "use strict";

  const LS_FAV = "wf_comp_fav";
  const LS_CUSTOM = "wf_comp_custom";
  const MAX_RESULTS = 100;
  let recordsCache = null;
  let brandsCache = null;

  function getLS(k, f) { try { return JSON.parse(localStorage.getItem(k)) ?? f; } catch { return f; } }
  function putLS(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); return true; } catch (e) { alert("تعذر الحفظ محليًا: " + (e?.message || e)); return false; } }

  function favorites() { return getLS(LS_FAV, []); }
  function customEntries() { return getLS(LS_CUSTOM, []); }

  function normalize(s) {
    return String(s == null ? "" : s).toUpperCase().replace(/[\s\-_\/\\]/g, "");
  }

  function db() { return window.COMPRESSOR_DB || {}; }
  function allBrands() { if (!brandsCache) brandsCache = Object.keys(db()).sort((a, b) => a.localeCompare(b, "ar")); return brandsCache; }

  function flatRecords() {
    if (recordsCache) return recordsCache;
    const out = [];
    const d = db();
    for (const brand of Object.keys(d)) for (const rec of d[brand]) out.push({ brand, custom: false, rec, _searchBlob: recordSearchBlob(rec) });
    for (const c of customEntries()) out.push({ brand: c.brand || "إضافات يدوية", custom: true, rec: c.rec, _id: c.id, _searchBlob: recordSearchBlob(c.rec) });
    recordsCache = out;
    return recordsCache;
  }

  // كل قيم السجل (بما فيها الحقول المتداخلة زي temp_capacity/extra) في نص واحد للبحث الحر
  function recordSearchBlob(rec) {
    const parts = [];
    for (const k in rec) {
      const v = rec[k];
      if (v == null) continue;
      if (typeof v === "object") { for (const kk in v) parts.push(v[kk]); }
      else parts.push(v);
    }
    return parts.map(normalize).join(" ");
  }

  function searchCompressors(query, brandFilter) {
    const q = normalize(query);
    let list = flatRecords();
    if (brandFilter) list = list.filter(x => x.brand === brandFilter);
    if (q) {
      list = list.filter(x => x._searchBlob.includes(q));
      list.sort((a, b) => {
        const am = normalize(a.rec.model).startsWith(q) ? 0 : 1;
        const bm = normalize(b.rec.model).startsWith(q) ? 0 : 1;
        return am - bm;
      });
    }
    return list;
  }

  function isFavorite(brand, model) { return favorites().some(f => f.brand === brand && f.model === model); }

  function toggleFavorite(brand, model, recJson) {
    let favs = favorites();
    const idx = favs.findIndex(f => f.brand === brand && f.model === model);
    if (idx >= 0) favs.splice(idx, 1);
    else favs.push({ brand, model, rec: JSON.parse(recJson), addedAt: new Date().toISOString() });
    putLS(LS_FAV, favs);
    renderCompressorResults();
  }

  window.toggleCompressorFavorite = function (brand, model, recJson) { toggleFavorite(brand, model, recJson); };

  window.deleteCustomCompressor = function (id) {
    if (!confirm("حذف الإضافة اليدوية دي؟")) return;
    putLS(LS_CUSTOM, customEntries().filter(c => c.id !== id));
    recordsCache = null;
    renderCompressorResults();
  };

  // ---------- تنسيق القيم للعرض ----------
  function hpDisplay(rec) { return rec.hp ? `${rec.hp} HP` : null; }
  function fmtNum(v) { return (typeof v === "number") ? (Math.round(v * 100) / 100).toLocaleString("en-US") : v; }

  const TEMP_LABELS = { "-23.3": "عند -23.3°", "-5": "عند -5°", "-6.7": "عند -6.7°", "7.2+": "عند 7.2°+" };

  function kv(icon, label, value) {
    if (value == null || value === "") return "";
    return `<div class="comp-kv"><small>${icon} ${esc(label)}</small><b>${esc(value)}</b></div>`;
  }

  function primaryGridHtml(rec) {
    return `<div class="comp-primary-grid">
      ${kv("⚙️", "القدرة (حصان)", hpDisplay(rec))}
      ${kv("🌡️", "القدرة (BTU)", rec.btu != null ? fmtNum(rec.btu) : null)}
      ${kv("🧪", "الفريون", rec.refrigerant)}
      ${kv("🎯", "التطبيق", rec.application)}
    </div>`;
  }

  function capacitorOilHtml(rec) {
    const chips = [];
    if (rec.run_capacitor != null) chips.push(`<span class="comp-field">⚡ مكثف التشغيل: <b>${esc(rec.run_capacitor)}</b></span>`);
    if (rec.start_capacitor != null) chips.push(`<span class="comp-field">🔌 مكثف الإقلاع/التقويم: <b>${esc(rec.start_capacitor)}</b></span>`);
    if (rec.oil_qty != null) chips.push(`<span class="comp-field">🛢️ كمية الزيت: <b>${esc(rec.oil_qty)}${rec.oil_unit ? " " + esc(rec.oil_unit) : ""}</b></span>`);
    if (!chips.length) return "";
    return `<div class="comp-fields">${chips.join("")}</div>`;
  }

  function extraDetailsHtml(rec) {
    const chips = [];
    if (rec.amp != null) chips.push(`<span class="comp-field">🔋 الأمبير (RLA): <b>${esc(fmtNum(rec.amp))}</b></span>`);
    if (rec.watt != null) chips.push(`<span class="comp-field">💡 الاستهلاك: <b>${esc(fmtNum(rec.watt))} W</b></span>`);
    if (rec.kcal != null) chips.push(`<span class="comp-field">🌡️ القدرة (kCal/hr): <b>${esc(fmtNum(rec.kcal))}</b></span>`);
    if (rec.freq != null) chips.push(`<span class="comp-field">〰️ التردد: <b>${esc(rec.freq)} HZ</b></span>`);
    if (rec.displacement != null) chips.push(`<span class="comp-field">📐 الإزاحة: <b>${esc(fmtNum(rec.displacement))} cc</b></span>`);
    if (rec.rpm != null) chips.push(`<span class="comp-field">🌀 السرعة: <b>${esc(rec.rpm)}</b></span>`);
    if (rec.temp_capacity) {
      for (const t in rec.temp_capacity) chips.push(`<span class="comp-field">🌡️ القدرة ${esc(TEMP_LABELS[t] || t)}: <b>${esc(fmtNum(rec.temp_capacity[t]))}</b></span>`);
    }
    if (rec.extra) {
      for (const k in rec.extra) chips.push(`<span class="comp-field">${esc(k)}: <b>${esc(rec.extra[k])}</b></span>`);
    }
    if (!chips.length) return "";
    return `<details class="comp-extra"><summary>🔎 بيانات إضافية</summary><div class="comp-fields">${chips.join("")}</div></details>`;
  }

  function specTextForCopy(item) {
    const rec = item.rec;
    const lines = [`${rec.model} (${item.brand})`];
    if (rec.hp) lines.push(`القدرة (حصان): ${rec.hp} HP`);
    if (rec.btu != null) lines.push(`القدرة (BTU): ${fmtNum(rec.btu)}`);
    if (rec.refrigerant) lines.push(`الفريون: ${rec.refrigerant}`);
    if (rec.application) lines.push(`التطبيق: ${rec.application}`);
    if (rec.run_capacitor != null) lines.push(`مكثف التشغيل: ${rec.run_capacitor}`);
    if (rec.start_capacitor != null) lines.push(`مكثف الإقلاع/التقويم: ${rec.start_capacitor}`);
    if (rec.oil_qty != null) lines.push(`كمية الزيت: ${rec.oil_qty}${rec.oil_unit ? " " + rec.oil_unit : ""}`);
    if (rec.amp != null) lines.push(`الأمبير: ${rec.amp}`);
    if (rec.notes) lines.push(`ملاحظات: ${rec.notes}`);
    return lines.join("\n");
  }

  function resultCardHtml(item) {
    const rec = item.rec;
    const model = rec.model || "—";
    const fav = !item.custom && isFavorite(item.brand, model);
    // ملحوظة مهمة: مكنش ممكن نحط JSON.stringify(rec) (اللي فيه علامات
    // اقتباس مزدوجة كتير أصلاً بحكم بنية الـ JSON) جوه onclick بعد تنظيفه
    // بـ esc() بس — لأن المتصفح بيفك ترميز HTML entities (زي &quot;) في
    // قيمة الـ attribute *قبل* ما ينفّذها كجافاسكريبت، فالـ " المرمّزة
    // كانت بترجع " عادية قدام الـ JS وتقفل السترنج بدري لكل سجل بيتفتح.
    // النتيجة: زرار "⭐ حفظ في المفضلة" كان بيفشل صامتًا لكل الموديلات.
    // escAttr() بتهرّب الاقتباس المفرد بطريقة جافاسكريبت (\\') وتحوّل
    // المزدوج لـ HTML entity (وده آمن هنا لأن الـ argument نفسه متلفوف
    // بعلامة اقتباس مفردة، مش مزدوجة) — نفس الطريقة المستخدمة في باقي
    // النظام لأي نص بيتحط جوه onclick.
    const recJson = escAttr(JSON.stringify(rec));
    const specId = "spec_" + Math.random().toString(36).slice(2);
    return `<div class="item">
      <div class="item-head">
        <b>🔩 ${esc(model)}</b>
        <span class="badge">${esc(item.brand)}</span>
      </div>
      ${item.custom ? `<span class="badge" style="margin-bottom:6px;display:inline-block">🖊️ إضافة يدوية</span>` : ""}
      ${primaryGridHtml(rec)}
      ${capacitorOilHtml(rec)}
      ${rec.notes ? `<p class="hint">📝 ${esc(rec.notes)}</p>` : ""}
      ${extraDetailsHtml(rec)}
      <textarea id="${specId}" class="hidden">${esc(specTextForCopy(item))}</textarea>
      <div class="actions comp-actions">
        ${item.custom
          ? `<button type="button" class="secondary small-btn" onclick="deleteCustomCompressor('${escAttr(item._id)}')">🗑️ حذف الإضافة</button>`
          : `<button type="button" class="secondary small-btn" onclick="toggleCompressorFavorite('${escAttr(item.brand)}','${escAttr(model)}','${recJson}')">${fav ? "💔 إزالة من المفضلة" : "⭐ حفظ في المفضلة"}</button>`}
        <button type="button" class="secondary small-btn" onclick="copyCompressorSpec('${escAttr(specId)}')">📋 نسخ البيانات</button>
      </div>
    </div>`;
  }

  window.copyCompressorSpec = function (specId) {
    const el = document.getElementById(specId);
    if (!el) return;
    const text = el.value;
    if (navigator.clipboard) navigator.clipboard.writeText(text).then(() => toast("✅ اتنسخت بيانات الكباس")).catch(() => alert(text));
    else alert(text);
  };

  function toast(msg) {
    let t = document.getElementById("compToast");
    if (!t) {
      t = document.createElement("div");
      t.id = "compToast";
      t.style.cssText = "position:fixed;bottom:80px;left:50%;transform:translateX(-50%);background:#17324d;color:#fff;padding:9px 16px;border-radius:20px;font-size:13px;z-index:999;box-shadow:0 4px 14px #00000033";
      document.body.appendChild(t);
    }
    t.textContent = msg;
    t.style.display = "block";
    clearTimeout(t._h);
    t._h = setTimeout(() => (t.style.display = "none"), 1800);
  }

  function renderFavoritesBar() {
    const host = document.getElementById("compFavorites");
    if (!host) return;
    const favs = favorites();
    if (!favs.length) { host.innerHTML = ""; return; }
    host.innerHTML = `<h3>⭐ المفضلة (${favs.length})</h3><div class="comp-fav-chips">` +
      favs.map(f => `<button type="button" class="secondary mini-action" onclick="document.getElementById('compSearch').value='${escAttr(f.model)}';renderCompressorResults()">${esc(f.model)} <small>(${esc(f.brand)})</small></button>`).join("") +
      `</div>`;
  }

  window.renderCompressorResults = function () {
    const qEl = document.getElementById("compSearch");
    const brandEl = document.getElementById("compBrandFilter");
    const q = qEl ? qEl.value.trim() : "";
    const brand = brandEl ? brandEl.value : "";
    const host = document.getElementById("compResults");
    const countEl = document.getElementById("compResultCount");
    renderFavoritesBar();
    if (!q && !brand) {
      host.innerHTML = `<p class="hint">اكتب كود الكباس (أو جزء منه)، أو أي قيمة تانية زي نوع الفريون (مثال: R600a) — أو اختر ماركة من القايمة، والنتائج هتظهر هنا. القاعدة فيها أكتر من ${flatRecords().length.toLocaleString("ar-EG")} موديل عبر ${allBrands().length} ماركة.</p>`;
      countEl.textContent = "";
      return;
    }
    const results = searchCompressors(q, brand);
    countEl.textContent = results.length > MAX_RESULTS
      ? `عدد النتائج: ${results.length} — هيظهر أول ${MAX_RESULTS} بس، ضيّق البحث عشان تشوف نتيجتك بسرعة`
      : `عدد النتائج: ${results.length}`;
    if (!results.length) {
      host.innerHTML = `<p class="hint">مفيش نتائج مطابقة. لو الموديل ده مش موجود فعلاً في الملف المرجعي، تقدر تضيفه يدويًا بالزرار فوق وهيتحفظ عندك وهيظهر في البحث بعد كده.</p>`;
      return;
    }
    host.innerHTML = results.slice(0, MAX_RESULTS).map(resultCardHtml).join("");
  };

  window.fillCompressorBrandFilter = function () {
    const el = document.getElementById("compBrandFilter");
    if (!el) return;
    el.innerHTML = `<option value="">كل الماركات</option>` + allBrands().map(b => `<option value="${esc(b)}">${esc(b)}</option>`).join("");
  };

  function id_() { return crypto.randomUUID ? crypto.randomUUID() : Date.now().toString(36) + Math.random().toString(36).slice(2); }

  window.saveCustomCompressor = function () {
    const model = document.getElementById("ccModel").value.trim();
    if (!model) { alert("لازم تكتب كود الموديل"); return; }
    const brand = document.getElementById("ccBrand").value.trim() || "إضافات يدوية";
    const rec = { model };
    const hpRaw = document.getElementById("ccHp").value.trim();
    if (hpRaw) rec.hp = hpRaw;
    const map = [["ccAmp", "amp"], ["ccBtu", "btu"], ["ccFreon", "refrigerant"], ["ccApp", "application"], ["ccRunCap", "run_capacitor"], ["ccStartCap", "start_capacitor"], ["ccOil", "oil_qty"], ["ccNote", "notes"]];
    map.forEach(([id, key]) => {
      const v = document.getElementById(id)?.value.trim();
      if (v) rec[key] = v;
    });
    const list = customEntries();
    list.push({ id: id_(), brand, rec, addedAt: new Date().toISOString() });
    putLS(LS_CUSTOM, list);
    recordsCache = null;
    ["ccModel", "ccBrand", "ccHp", "ccAmp", "ccBtu", "ccFreon", "ccApp", "ccRunCap", "ccStartCap", "ccOil", "ccNote"].forEach(x => { const e = document.getElementById(x); if (e) e.value = ""; });
    toggle("compAddBox");
    document.getElementById("compSearch").value = model;
    renderCompressorResults();
  };

  window.initCompressorCodesPage = function () {
    fillCompressorBrandFilter();
    renderCompressorResults();
  };
})(window);
