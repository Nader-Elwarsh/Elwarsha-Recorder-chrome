/* theme.js — تبديل الوضع الفاتح/الداكن لكل صفحات النظام، محفوظ في localStorage.
   لازم يتحمّل مبكرًا في <head> (قبل أي شيء تقريبًا) عشان يطبّق المظهر المحفوظ
   قبل ما المتصفح يرسم الصفحة، فمفيش وميض (Flash) من الفاتح للداكن. */
(function () {
  try {
    var saved = localStorage.getItem("wf_theme");
    if (saved === "dark") {
      document.documentElement.setAttribute("data-theme", "dark");
    }
  } catch (e) {}
})();

function toggleTheme() {
  try {
    var isDark = document.documentElement.getAttribute("data-theme") === "dark";
    var next = isDark ? "light" : "dark";
    if (next === "dark") {
      document.documentElement.setAttribute("data-theme", "dark");
    } else {
      document.documentElement.removeAttribute("data-theme");
    }
    localStorage.setItem("wf_theme", next);
    updateThemeToggleIcons();
  } catch (e) {}
}

function updateThemeToggleIcons() {
  var isDark = document.documentElement.getAttribute("data-theme") === "dark";
  var btns = document.querySelectorAll(".theme-toggle-btn");
  for (var i = 0; i < btns.length; i++) {
    btns[i].textContent = isDark ? "☀️" : "🌙";
    btns[i].setAttribute("aria-label", isDark ? "التبديل للوضع الفاتح" : "التبديل للوضع الداكن");
    btns[i].setAttribute("title", isDark ? "الوضع الفاتح" : "الوضع الداكن");
  }
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", updateThemeToggleIcons);
} else {
  updateThemeToggleIcons();
}
