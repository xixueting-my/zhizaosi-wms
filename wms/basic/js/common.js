/**
 * WMS Basic — 公共布局、抽屉、Tab、Toast、表单工具
 */
window.WMS = (function () {
  const M = () => window.WMS_MOCK;

  function toast(message, type = "ok") {
    let wrap = document.querySelector(".toast-wrap");
    if (!wrap) {
      wrap = document.createElement("div");
      wrap.className = "toast-wrap";
      document.body.appendChild(wrap);
    }
    const el = document.createElement("div");
    el.className = `toast ${type}`;
    el.textContent = message;
    wrap.appendChild(el);
    setTimeout(() => {
      el.style.opacity = "0";
      el.style.transition = "opacity 0.12s linear";
      setTimeout(() => el.remove(), 120);
    }, 1600);
  }

  function escapeHtml(str) {
    return String(str ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function statusTag(status, enabledLabel = "启用", disabledLabel = "停用") {
    if (Number(status) === 1) return `<span class="tag tag-green">${enabledLabel}</span>`;
    return `<span class="tag tag-red">${disabledLabel}</span>`;
  }

  function fillSelect(select, options, { placeholder, valueKey = "value", labelKey = "label", selected } = {}) {
    if (!select) return;
    const opts = [];
    if (placeholder != null) opts.push(`<option value="">${escapeHtml(placeholder)}</option>`);
    options.forEach((o) => {
      const v = o[valueKey];
      const lab = o[labelKey];
      const sel = selected != null && String(selected) === String(v) ? " selected" : "";
      opts.push(`<option value="${escapeHtml(v)}"${sel}>${escapeHtml(lab)}</option>`);
    });
    select.innerHTML = opts.join("");
  }

  function warehouseMap() {
    const map = {};
    M().getWarehouses().forEach((w) => { map[w.id] = w; });
    return map;
  }
  function zoneMap() {
    const map = {};
    M().getZones().forEach((z) => { map[z.id] = z; });
    return map;
  }
  function siteMap() {
    const map = {};
    M().getSites().forEach((s) => { map[s.id] = s; });
    return map;
  }
  function zoneTypeLabel(value) {
    const hit = M().ENUMS.zoneTypes.find((t) => t.value === value);
    return hit ? hit.label : value || "-";
  }
  function approverLabel(value) {
    if (!value) return "";
    const hit = M().ENUMS.approvers.find((a) => a.value === value);
    return hit ? hit.label : value;
  }

  function openDrawer(id) {
    const el = document.getElementById(id);
    if (!el) return;
    el.classList.add("show");
    document.body.style.overflow = "hidden";
  }

  function closeDrawer(id) {
    const el = document.getElementById(id);
    if (!el) return;
    el.classList.remove("show");
    if (!document.querySelector(".drawer-mask.show")) {
      document.body.style.overflow = "";
    }
  }

  function bindDrawerDismiss() {
    document.querySelectorAll(".drawer-mask").forEach((mask) => {
      mask.addEventListener("click", (e) => {
        if (e.target === mask) {
          mask.classList.remove("show");
          document.body.style.overflow = "";
        }
      });
      mask.querySelectorAll("[data-drawer-close]").forEach((btn) => {
        btn.addEventListener("click", () => {
          mask.classList.remove("show");
          document.body.style.overflow = "";
        });
      });
    });
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape") {
        document.querySelectorAll(".drawer-mask.show").forEach((m) => m.classList.remove("show"));
        document.body.style.overflow = "";
      }
    });
  }

  function initTabs({ root = document, onChange } = {}) {
    const tabs = root.querySelectorAll("[data-tab]");
    const panels = root.querySelectorAll("[data-tab-panel]");
    function activate(name, { silent } = {}) {
      tabs.forEach((t) => t.classList.toggle("active", t.getAttribute("data-tab") === name));
      panels.forEach((p) => p.classList.toggle("active", p.getAttribute("data-tab-panel") === name));
      root.querySelectorAll("[data-hierarchy-step]").forEach((s) => {
        s.classList.toggle("active", s.getAttribute("data-hierarchy-step") === name);
      });
      const primary = root.querySelector("[data-primary-for]");
      if (primary) {
        const map = JSON.parse(primary.getAttribute("data-primary-for") || "{}");
        if (map[name]) {
          primary.textContent = map[name];
          primary.setAttribute("data-current-tab", name);
        }
      }
      if (!silent && typeof onChange === "function") onChange(name);
      try {
        const url = new URL(window.location.href);
        url.hash = name;
        history.replaceState(null, "", url);
      } catch (_) { /* ignore */ }
    }
    tabs.forEach((t) => t.addEventListener("click", () => activate(t.getAttribute("data-tab"))));
    root.querySelectorAll("[data-hierarchy-step]").forEach((s) => {
      s.addEventListener("click", () => activate(s.getAttribute("data-hierarchy-step")));
    });
    const fromHash = (location.hash || "").replace("#", "");
    const initial = fromHash && root.querySelector(`[data-tab="${fromHash}"]`)
      ? fromHash
      : (tabs[0] && tabs[0].getAttribute("data-tab"));
    if (initial) activate(initial, { silent: true });
    return { activate };
  }

  function clearFormErrors(form) {
    form.querySelectorAll(".field").forEach((item) => {
      item.classList.remove("has-error");
      const err = item.querySelector(".error");
      if (err) err.textContent = "";
    });
  }

  function setFieldError(form, name, message) {
    const field = form.querySelector(`[name="${name}"]`);
    if (!field) return;
    const item = field.closest(".field");
    if (!item) return;
    item.classList.add("has-error");
    let err = item.querySelector(".error");
    if (!err) {
      err = document.createElement("div");
      err.className = "error";
      item.appendChild(err);
    }
    err.textContent = message;
  }

  function getFormData(form) {
    const fd = new FormData(form);
    const data = {};
    fd.forEach((v, k) => {
      if (data[k] !== undefined) {
        if (!Array.isArray(data[k])) data[k] = [data[k]];
        data[k].push(v);
      } else data[k] = v;
    });
    form.querySelectorAll("select[multiple]").forEach((sel) => {
      data[sel.name] = Array.from(sel.selectedOptions).map((o) => o.value);
    });
    return data;
  }

  function confirmAction(message) {
    return window.confirm(message);
  }

  function renderShell(activePage) {
    if (window.WMS_SHELL) window.WMS_SHELL.mount(activePage);
    document.querySelectorAll("[data-nav]").forEach((a) => {
      a.classList.toggle("active", a.getAttribute("data-nav") === activePage);
    });
    const userEl = document.querySelector("[data-current-user]");
    if (userEl) userEl.textContent = M().currentUser;
    const avatar = document.querySelector("[data-avatar]");
    if (avatar) avatar.textContent = (M().currentUser || "用").slice(0, 1);
  }

  function paginate(list, page, pageSize) {
    const total = list.length;
    const pages = Math.max(1, Math.ceil(total / pageSize) || 1);
    const p = Math.min(Math.max(1, page), pages);
    const start = (p - 1) * pageSize;
    return {
      list: list.slice(start, start + pageSize),
      total,
      page: p,
      pages,
      from: total === 0 ? 0 : start + 1,
      to: Math.min(start + pageSize, total),
    };
  }

  function renderPagination(container, meta, onPage) {
    if (!container) return;
    container.innerHTML = `
      <div class="page-total">共 <strong>${meta.total}</strong> 条</div>
      <div class="pages"></div>
    `;
    const pagesEl = container.querySelector(".pages");
    const maxShow = 7;
    let start = 1;
    let end = meta.pages;
    if (meta.pages > maxShow) {
      start = Math.max(1, meta.page - 3);
      end = Math.min(meta.pages, start + maxShow - 1);
      start = Math.max(1, end - maxShow + 1);
    }
    for (let i = start; i <= end; i++) {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.textContent = String(i);
      if (i === meta.page) btn.classList.add("active");
      btn.addEventListener("click", () => onPage(i));
      pagesEl.appendChild(btn);
    }
  }

  function initRegionSelects(provinceSel, citySel, districtSel, values = {}) {
    const regions = (window.WMS_REGION && window.WMS_REGION.tree) || M().ENUMS.regions;
    const districtList = (province, city) => {
      const raw = (regions[province] || {})[city];
      if (!raw) return [];
      return Array.isArray(raw) ? raw : Object.keys(raw);
    };
    fillSelect(provinceSel, Object.keys(regions).map((k) => ({ value: k, label: k })), {
      placeholder: "省",
      selected: values.province,
    });
    function notify() {
      if (typeof values.onChange === "function") values.onChange();
    }
    function syncCity() {
      const cities = regions[provinceSel.value] || {};
      fillSelect(citySel, Object.keys(cities).map((k) => ({ value: k, label: k })), {
        placeholder: "市",
        selected: values.city,
      });
      syncDistrict();
    }
    function syncDistrict() {
      fillSelect(districtSel, districtList(provinceSel.value, citySel.value).map((k) => ({ value: k, label: k })), {
        placeholder: "区",
        selected: values.district,
      });
    }
    provinceSel.onchange = () => { values.city = ""; values.district = ""; syncCity(); notify(); };
    citySel.onchange = () => { values.district = ""; syncDistrict(); notify(); };
    districtSel.onchange = notify;
    syncCity();
  }

  function emptyState({ title, desc, actionLabel, actionId }) {
    return `
      <div class="empty">
        <h4>${escapeHtml(title)}</h4>
        ${desc ? `<p>${escapeHtml(desc)}</p>` : ""}
        ${actionLabel ? `<button type="button" class="btn btn-primary" id="${actionId}">${escapeHtml(actionLabel)}</button>` : ""}
      </div>
    `;
  }

  let menusBound = false;
  function bindMenus(root = document) {
    if (menusBound) return;
    menusBound = true;
    root.addEventListener("click", (e) => {
      const trigger = e.target.closest("[data-menu-trigger]");
      if (trigger) {
        e.stopPropagation();
        const menu = trigger.closest(".menu");
        if (!menu) return;
        root.querySelectorAll(".menu.open").forEach((m) => { if (m !== menu) m.classList.remove("open"); });
        menu.classList.toggle("open");
        return;
      }
      if (!e.target.closest(".menu")) {
        root.querySelectorAll(".menu.open").forEach((m) => m.classList.remove("open"));
      }
    });
  }

  function debounce(fn, ms = 300) {
    let timer;
    return (...args) => {
      clearTimeout(timer);
      timer = setTimeout(() => fn(...args), ms);
    };
  }

  function withButtonLoading(btn, fn, ms = 420) {
    if (!btn) return typeof fn === "function" ? fn() : undefined;
    const wasDisabled = btn.disabled;
    btn.disabled = true;
    btn.classList.add("is-loading");
    const finish = () => {
      btn.classList.remove("is-loading");
      btn.disabled = wasDisabled;
    };
    try {
      const result = fn();
      if (result && typeof result.then === "function") {
        return result.finally(finish);
      }
    } catch (err) {
      finish();
      throw err;
    }
    setTimeout(finish, ms);
  }

  function sortBy(list, keyOrFn, dir = "asc") {
    const mul = dir === "desc" ? -1 : 1;
    const getter = typeof keyOrFn === "function" ? keyOrFn : (row) => row[keyOrFn];
    return [...list].sort((a, b) => {
      let va = getter(a);
      let vb = getter(b);
      if (va == null) va = "";
      if (vb == null) vb = "";
      if (typeof va === "number" && typeof vb === "number") return (va - vb) * mul;
      return String(va).localeCompare(String(vb), "zh-CN", { numeric: true }) * mul;
    });
  }

  function bindSortHeaders(thead, state, onChange) {
    if (!thead) return;
    thead.addEventListener("click", (e) => {
      const th = e.target.closest("th[data-sort]");
      if (!th) return;
      const key = th.getAttribute("data-sort");
      if (state.key === key) state.dir = state.dir === "asc" ? "desc" : "asc";
      else {
        state.key = key;
        state.dir = "asc";
      }
      thead.querySelectorAll("th[data-sort]").forEach((el) => {
        el.classList.remove("sort-asc", "sort-desc");
        if (el.getAttribute("data-sort") === state.key) {
          el.classList.add(state.dir === "asc" ? "sort-asc" : "sort-desc");
        }
      });
      onChange(state);
    });
  }

  function bindLiveFilters({ textIds = [], selectIds = [], onApply, debounceMs = 300 } = {}) {
    const run = () => { if (typeof onApply === "function") onApply(); };
    const debounced = debounce(run, debounceMs);
    textIds.forEach((id) => {
      const el = document.getElementById(id);
      if (!el) return;
      el.addEventListener("input", debounced);
      el.addEventListener("keydown", (e) => {
        if (e.key === "Enter") {
          e.preventDefault();
          run();
        }
      });
    });
    selectIds.forEach((id) => {
      const el = document.getElementById(id);
      if (!el) return;
      el.addEventListener("change", run);
    });
  }

  function syncRowSelection(tbody, checkSelector) {
    if (!tbody) return;
    tbody.querySelectorAll("tr").forEach((tr) => {
      const cb = tr.querySelector(checkSelector);
      tr.classList.toggle("is-selected", !!(cb && cb.checked));
    });
  }

  return {
    toast,
    escapeHtml,
    statusTag,
    fillSelect,
    warehouseMap,
    zoneMap,
    siteMap,
    zoneTypeLabel,
    approverLabel,
    openDrawer,
    closeDrawer,
    bindDrawerDismiss,
    initTabs,
    clearFormErrors,
    setFieldError,
    getFormData,
    confirmAction,
    renderShell,
    paginate,
    renderPagination,
    initRegionSelects,
    emptyState,
    bindMenus,
    debounce,
    withButtonLoading,
    sortBy,
    bindSortHeaders,
    bindLiveFilters,
    syncRowSelection,
  };
})();
