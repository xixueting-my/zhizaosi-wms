(function () {
  const M = window.WMS_MOCK;
  const U = window.WMS;
  let currentTab = "putaway";
  let paFilter = {};
  let wvFilter = {};
  let alFilter = {};
  let paStatus = "";
  let wvStatus = "";
  let alStatus = "";
  const paSort = { key: "rule_code", dir: "asc" };
  const wvSort = { key: "rule_code", dir: "asc" };
  const alSort = { key: "rule_code", dir: "asc" };

  U.renderShell("strategy");
  U.bindDrawerDismiss();

  U.initTabs({
    root: document.getElementById("page-root"),
    onChange(name) { currentTab = name; },
  });
  currentTab = (location.hash || "#putaway").replace("#", "") || "putaway";

  function syncBatchBar(barId, count, label) {
    const bar = document.getElementById(barId);
    if (!bar) return;
    const el = bar.querySelector(".sel-count");
    if (el) el.textContent = count ? `已选 ${count} ${label}` : "";
    bar.classList.toggle("has-selection", count > 0);
  }

  function applyPaFilter() {
    paFilter = {
      code: document.getElementById("pa-code").value.trim(),
      name: document.getElementById("pa-name").value.trim(),
    };
    renderPutaway();
  }
  function applyWvFilter() {
    wvFilter = {
      code: document.getElementById("wv-code").value.trim(),
      name: document.getElementById("wv-name").value.trim(),
    };
    renderWave();
  }
  function applyAlFilter() {
    alFilter = {
      code: document.getElementById("al-code").value.trim(),
      name: document.getElementById("al-name").value.trim(),
    };
    renderAllocate();
  }

  document.getElementById("pa-add").onclick = () => openPutawayDrawer(null);
  document.getElementById("wv-add").onclick = () => openWaveDrawer(null);
  document.getElementById("al-edit").onclick = () => {
    const first = M.getAllocateRules()[0];
    if (first) openAllocateDrawer(first);
    else U.toast("暂无配货规则", "info");
  };

  function filteredPutaway() {
    return M.getPutawayRules().filter((r) => {
      if (paFilter.code && !r.rule_code.toLowerCase().includes(paFilter.code.toLowerCase())) return false;
      if (paFilter.name && !r.rule_name.includes(paFilter.name)) return false;
      if (paStatus !== "" && String(r.status) !== String(paStatus)) return false;
      return true;
    });
  }

  function renderPutaway() {
    let list = filteredPutaway();
    if (paSort.key) list = U.sortBy(list, paSort.key, paSort.dir);
    document.getElementById("pa-meta").textContent = `共 ${list.length} 条`;
    document.getElementById("pa-tbody").innerHTML = list.map((r) => `
      <tr>
        <td class="ops">
          <button type="button" class="btn-link" data-pa-edit="${r.id}">编辑</button>
          ${Number(r.status) === 1
            ? `<button type="button" class="btn-link btn-link-danger" data-pa-disable="${r.id}">停用</button>`
            : `<button type="button" class="btn-link" data-pa-enable="${r.id}">启用</button>`}
        </td>
        <td><code class="code-link">${U.escapeHtml(r.rule_code)}</code></td>
        <td>${U.escapeHtml(r.rule_name)}<button type="button" class="help" data-pa-help="${U.escapeHtml(r.rule_code)}" aria-label="说明">?</button></td>
        <td>${U.statusTag(r.status)}</td>
        <td>
          <div>${U.escapeHtml(r.updated_by)}</div>
          <div style="color:var(--text-tertiary);font-size:12px;">${U.escapeHtml(r.updated_at)}</div>
        </td>
      </tr>
    `).join("") || `<tr><td colspan="5"><div class="empty">暂无预占规则</div></td></tr>`;
  }

  document.getElementById("pa-search").onclick = applyPaFilter;
  document.getElementById("pa-reset").onclick = () => {
    document.getElementById("pa-code").value = "";
    document.getElementById("pa-name").value = "";
    paFilter = {};
    renderPutaway();
  };
  U.bindLiveFilters({ textIds: ["pa-code", "pa-name"], onApply: applyPaFilter });
  U.bindSortHeaders(document.querySelector("#pa-tbody")?.closest("table")?.querySelector("thead"), paSort, renderPutaway);
  document.getElementById("pa-status-tabs").addEventListener("click", (e) => {
    const btn = e.target.closest("[data-pa-status]");
    if (!btn) return;
    paStatus = btn.getAttribute("data-pa-status") ?? "";
    document.querySelectorAll("#pa-status-tabs .sub-tab").forEach((t) => t.classList.toggle("active", t === btn));
    renderPutaway();
  });
  document.getElementById("pa-tbody").addEventListener("click", (e) => {
    const help = e.target.closest("[data-pa-help]");
    if (help) {
      showPutawayHelp(help, help.getAttribute("data-pa-help"));
      return;
    }
    const editId = e.target.getAttribute("data-pa-edit");
    if (editId) {
      openPutawayDrawer(M.getPutawayRules().find((r) => String(r.id) === String(editId)));
      return;
    }
    const enableId = e.target.getAttribute("data-pa-enable");
    const disableId = e.target.getAttribute("data-pa-disable");
    if (enableId) {
      const current = M.getPutawayRules().find((r) => r.status === 1);
      if (current && String(current.id) !== String(enableId)) {
        if (!U.confirmAction(`启用后将自动停用「${current.rule_name}」。是否继续？`)) return;
      }
      M.setPutawayRules(M.getPutawayRules().map((r) => ({
        ...r,
        status: String(r.id) === String(enableId) ? 1 : 0,
        updated_by: M.currentUser,
        updated_at: M.now(),
      })));
      U.toast("已启用预占规则（全局唯一）");
      renderPutaway();
    }
    if (disableId) {
      M.setPutawayRules(M.getPutawayRules().map((r) => (
        String(r.id) === String(disableId)
          ? { ...r, status: 0, updated_by: M.currentUser, updated_at: M.now() }
          : r
      )));
      U.toast("已停用");
      renderPutaway();
    }
  });

  function showPutawayHelp(btn, code) {
    const pop = document.getElementById("help-pop");
    const doc = M.putawayRuleDocs.find((d) => d.code === code);
    pop.innerHTML = doc
      ? `<div><strong>逻辑</strong> ${U.escapeHtml(doc.logic)}</div><div style="margin-top:6px"><strong>优势</strong> ${U.escapeHtml(doc.pros)}</div>`
      : "这条规则还没有说明。";
    pop.hidden = false;
    const rect = btn.getBoundingClientRect();
    pop.style.left = Math.max(8, Math.min(rect.left, window.innerWidth - 296)) + "px";
    pop.style.top = (rect.bottom + 6) + "px";
  }
  document.addEventListener("click", (e) => {
    const pop = document.getElementById("help-pop");
    if (!pop || pop.hidden) return;
    if (e.target.closest("#help-pop") || e.target.closest("[data-pa-help]")) return;
    pop.hidden = true;
  });

  function openPutawayDrawer(row) {
    const form = document.getElementById("form-pa");
    U.clearFormErrors(form);
    document.getElementById("drawer-pa-title").textContent = row ? "编辑预占规则" : "新增预占规则";
    form.id.value = row?.id || "";
    form.rule_code.value = row?.rule_code || "保存后自动生成";
    form.rule_name.value = row?.rule_name || "";
    U.openDrawer("drawer-pa");
  }
  document.getElementById("form-pa").onsubmit = (e) => {
    e.preventDefault();
    const form = e.target;
    U.clearFormErrors(form);
    const data = U.getFormData(form);
    if (!data.rule_name?.trim()) return U.setFieldError(form, "rule_name", "请填写规则名称");
    const list = M.getPutawayRules();
    if (data.id) {
      M.setPutawayRules(list.map((r) => (
        String(r.id) === String(data.id)
          ? { ...r, rule_name: data.rule_name.trim(), updated_by: M.currentUser, updated_at: M.now() }
          : r
      )));
      U.toast("预占规则已更新");
    } else {
      const id = M.nextPutawayId();
      M.setPutawayRules([...list, {
        id,
        rule_code: "YZGZ" + String(id).padStart(2, "0"),
        rule_name: data.rule_name.trim(),
        status: 0,
        updated_by: M.currentUser,
        updated_at: M.now(),
      }]);
      U.toast("预占规则已创建");
    }
    U.closeDrawer("drawer-pa");
    renderPutaway();
  };

  /* —— 波次 —— */
  function filteredWave() {
    return M.getWaveRules().filter((r) => {
      if (wvFilter.code && !r.rule_code.toLowerCase().includes(wvFilter.code.toLowerCase())) return false;
      if (wvFilter.name && !r.rule_name.includes(wvFilter.name)) return false;
      if (wvStatus !== "" && String(r.status) !== String(wvStatus)) return false;
      return true;
    });
  }

  function renderWave() {
    let list = filteredWave();
    if (wvSort.key) list = U.sortBy(list, wvSort.key, wvSort.dir);
    document.getElementById("wv-meta").textContent = `共 ${list.length} 条`;
    document.getElementById("wv-tbody").innerHTML = list.length ? list.map((r) => `
      <tr>
        <td><input type="checkbox" class="wv-check" value="${r.id}" /></td>
        <td><button type="button" class="btn-link" data-wv-edit="${r.id}">编辑</button></td>
        <td><code class="code-link">${U.escapeHtml(r.rule_code)}</code></td>
        <td>${U.escapeHtml(r.rule_name)}</td>
        <td>${U.escapeHtml(r.generate_time)}</td>
        <td>${r.order_qty}</td>
        <td>${U.statusTag(r.status)}</td>
        <td>
          <div>${U.escapeHtml(r.updated_by)}</div>
          <div style="color:var(--text-tertiary);font-size:12px;">${U.escapeHtml(r.updated_at)}</div>
        </td>
      </tr>
    `).join("") : `<tr><td colspan="8">${U.emptyState({ title: "暂无波次规则", desc: "按生成时间与单量阈值配置出库波次。", actionLabel: "新增波次规则", actionId: "wv-empty-add" })}</td></tr>`;
    const emptyBtn = document.getElementById("wv-empty-add");
    if (emptyBtn) emptyBtn.onclick = () => openWaveDrawer(null);
    document.getElementById("wv-check-all").checked = false;
    syncBatchBar("wv-actions", 0, "项");
  }

  function openWaveDrawer(row) {
    const form = document.getElementById("form-wv");
    U.clearFormErrors(form);
    document.getElementById("drawer-wv-title").textContent = row ? "编辑波次规则" : "新增波次规则";
    form.id.value = row?.id || "";
    form.rule_code.value = row?.rule_code || "保存后自动生成";
    form.rule_name.value = row?.rule_name || "";
    form.generate_time.value = row?.generate_time || "09:00";
    form.order_qty.value = row?.order_qty ?? 200;
    U.openDrawer("drawer-wv");
  }

  function selectedWaveIds() {
    return Array.from(document.querySelectorAll(".wv-check:checked")).map((el) => Number(el.value));
  }

  function setWaveStatus(ids, status) {
    if (!ids.length) return U.toast("请先勾选波次规则", "err");
    M.setWaveRules(M.getWaveRules().map((r) => (
      ids.includes(r.id) ? { ...r, status, updated_by: M.currentUser, updated_at: M.now() } : r
    )));
    U.toast(status === 1 ? "已启用" : "已停用");
    renderWave();
  }

  document.getElementById("wv-search").onclick = applyWvFilter;
  document.getElementById("wv-reset").onclick = () => {
    document.getElementById("wv-code").value = "";
    document.getElementById("wv-name").value = "";
    wvFilter = {};
    renderWave();
  };
  document.getElementById("wv-refresh").onclick = () => {
    U.withButtonLoading(document.getElementById("wv-refresh"), () => {
      renderWave();
      U.toast("已刷新");
    });
  };
  document.getElementById("wv-enable").onclick = () => setWaveStatus(selectedWaveIds(), 1);
  document.getElementById("wv-disable").onclick = () => setWaveStatus(selectedWaveIds(), 0);
  document.getElementById("wv-status-tabs").addEventListener("click", (e) => {
    const btn = e.target.closest("[data-wv-status]");
    if (!btn) return;
    wvStatus = btn.getAttribute("data-wv-status") ?? "";
    document.querySelectorAll("#wv-status-tabs .sub-tab").forEach((t) => t.classList.toggle("active", t === btn));
    renderWave();
  });
  U.bindLiveFilters({ textIds: ["wv-code", "wv-name"], onApply: applyWvFilter });
  U.bindSortHeaders(document.querySelector("#wv-tbody")?.closest("table")?.querySelector("thead"), wvSort, renderWave);
  document.getElementById("wv-check-all").onchange = (e) => {
    document.querySelectorAll(".wv-check").forEach((c) => { c.checked = e.target.checked; });
    syncBatchBar("wv-actions", e.target.checked ? document.querySelectorAll(".wv-check").length : 0, "项");
    U.syncRowSelection(document.getElementById("wv-tbody"), ".wv-check");
  };
  document.getElementById("wv-tbody").addEventListener("change", (e) => {
    if (!e.target.classList.contains("wv-check")) return;
    const n = document.querySelectorAll(".wv-check:checked").length;
    document.getElementById("wv-check-all").checked =
      n > 0 && n === document.querySelectorAll(".wv-check").length;
    syncBatchBar("wv-actions", n, "项");
    U.syncRowSelection(document.getElementById("wv-tbody"), ".wv-check");
  });
  document.getElementById("wv-tbody").addEventListener("click", (e) => {
    const id = e.target.getAttribute("data-wv-edit");
    if (!id) return;
    openWaveDrawer(M.getWaveRules().find((r) => String(r.id) === String(id)));
  });
  document.getElementById("form-wv").onsubmit = (e) => {
    e.preventDefault();
    const form = e.target;
    U.clearFormErrors(form);
    const data = U.getFormData(form);
    let ok = true;
    if (!data.rule_name?.trim()) { U.setFieldError(form, "rule_name", "请填写规则名称"); ok = false; }
    if (!data.generate_time) { U.setFieldError(form, "generate_time", "请选择生成时间"); ok = false; }
    const qty = Number(data.order_qty);
    if (!data.order_qty || Number.isNaN(qty) || qty < 1) {
      U.setFieldError(form, "order_qty", "单量须为 ≥ 1 的整数");
      ok = false;
    }
    if (!ok) return;
    const list = M.getWaveRules();
    if (data.id) {
      M.setWaveRules(list.map((r) => (
        String(r.id) === String(data.id)
          ? { ...r, rule_name: data.rule_name.trim(), generate_time: data.generate_time, order_qty: qty, updated_by: M.currentUser, updated_at: M.now() }
          : r
      )));
      U.toast("波次规则已更新");
    } else {
      const id = M.nextWaveId();
      M.setWaveRules([...list, {
        id,
        rule_code: `BCGZ${String(id).padStart(2, "0")}`,
        rule_name: data.rule_name.trim(),
        generate_time: data.generate_time,
        order_qty: qty,
        status: 0,
        updated_by: M.currentUser,
        updated_at: M.now(),
      }]);
      U.toast("波次规则已创建");
    }
    U.closeDrawer("drawer-wv");
    renderWave();
  };

  /* —— 配货 —— */
  function filteredAllocate() {
    return M.getAllocateRules().filter((r) => {
      if (alFilter.code && !r.rule_code.toLowerCase().includes(alFilter.code.toLowerCase())) return false;
      if (alFilter.name && !r.rule_name.includes(alFilter.name)) return false;
      if (alStatus !== "" && String(r.status) !== String(alStatus)) return false;
      return true;
    });
  }

  function renderAllocate() {
    let list = filteredAllocate();
    if (alSort.key) list = U.sortBy(list, alSort.key, alSort.dir);
    document.getElementById("al-meta").textContent = `共 ${list.length} 条`;
    document.getElementById("al-tbody").innerHTML = list.map((r) => `
      <tr>
        <td class="ops">
          <button type="button" class="btn-link" data-al-edit="${r.id}">编辑</button>
          <div class="menu">
            <button type="button" class="btn-link" data-menu-trigger>更多</button>
            <div class="menu-panel">
              ${Number(r.status) === 1
                ? `<button type="button" class="menu-item danger" data-al-disable="${r.id}">停用</button>`
                : `<button type="button" class="menu-item" data-al-enable="${r.id}">启用</button>`}
            </div>
          </div>
        </td>
        <td><code class="code-link">${U.escapeHtml(r.rule_code)}</code></td>
        <td>${U.escapeHtml(r.rule_name)}</td>
        <td>${r.weight}</td>
        <td>${U.statusTag(r.status)}</td>
        <td>
          <div>${U.escapeHtml(r.updated_by)}</div>
          <div style="color:var(--text-tertiary);font-size:12px;">${U.escapeHtml(r.updated_at)}</div>
        </td>
      </tr>
    `).join("") || `<tr><td colspan="6"><div class="empty">暂无配货规则</div></td></tr>`;
  }

  function openAllocateDrawer(row) {
    const form = document.getElementById("form-al");
    U.clearFormErrors(form);
    form.id.value = row.id;
    form.rule_code.value = row.rule_code;
    form.rule_name.value = row.rule_name;
    form.weight.value = row.weight;
    U.openDrawer("drawer-al");
  }

  document.getElementById("al-search").onclick = applyAlFilter;
  document.getElementById("al-reset").onclick = () => {
    document.getElementById("al-code").value = "";
    document.getElementById("al-name").value = "";
    alFilter = {};
    renderAllocate();
  };
  U.bindLiveFilters({ textIds: ["al-code", "al-name"], onApply: applyAlFilter });
  U.bindSortHeaders(document.querySelector("#al-tbody")?.closest("table")?.querySelector("thead"), alSort, renderAllocate);
  document.getElementById("al-status-tabs").addEventListener("click", (e) => {
    const btn = e.target.closest("[data-al-status]");
    if (!btn) return;
    alStatus = btn.getAttribute("data-al-status") ?? "";
    document.querySelectorAll("#al-status-tabs .sub-tab").forEach((t) => t.classList.toggle("active", t === btn));
    renderAllocate();
  });
  document.getElementById("al-tbody").addEventListener("click", (e) => {
    const enableId = e.target.getAttribute("data-al-enable");
    const disableId = e.target.getAttribute("data-al-disable");
    const editId = e.target.getAttribute("data-al-edit");
    if (enableId) {
      const row = M.getAllocateRules().find((r) => String(r.id) === String(enableId));
      M.setAllocateRules(M.getAllocateRules().map((r) => (
        String(r.id) === String(enableId) ? { ...r, status: 1, updated_by: M.currentUser, updated_at: M.now() } : r
      )));
      M.pushAllocateLog({ at: M.now(), who: M.currentUser, content: "启用 " + (row ? row.rule_code + " " + row.rule_name : enableId) });
      U.toast("已启用");
      renderAllocate();
    }
    if (disableId) {
      const row = M.getAllocateRules().find((r) => String(r.id) === String(disableId));
      M.setAllocateRules(M.getAllocateRules().map((r) => (
        String(r.id) === String(disableId) ? { ...r, status: 0, updated_by: M.currentUser, updated_at: M.now() } : r
      )));
      M.pushAllocateLog({ at: M.now(), who: M.currentUser, content: "停用 " + (row ? row.rule_code + " " + row.rule_name : disableId) });
      U.toast("已停用");
      renderAllocate();
    }
    if (editId) openAllocateDrawer(M.getAllocateRules().find((r) => String(r.id) === String(editId)));
  });

  U.bindMenus();
  document.getElementById("form-al").onsubmit = (e) => {
    e.preventDefault();
    const form = e.target;
    U.clearFormErrors(form);
    const data = U.getFormData(form);
    let ok = true;
    if (!data.rule_name?.trim()) { U.setFieldError(form, "rule_name", "请填写规则名称"); ok = false; }
    const weight = Number(data.weight);
    if (data.weight === "" || Number.isNaN(weight) || weight < 0) {
      U.setFieldError(form, "weight", "权重须为 ≥ 0 的整数");
      ok = false;
    }
    if (!ok) return;
    const prev = M.getAllocateRules().find((r) => String(r.id) === String(data.id));
    const name = data.rule_name.trim();
    const parts = [];
    if (prev && prev.rule_name !== name) parts.push("规则名称「" + prev.rule_name + "」改为「" + name + "」");
    if (prev && Number(prev.weight) !== weight) parts.push("权重 " + prev.weight + " 改为 " + weight);
    M.setAllocateRules(M.getAllocateRules().map((r) => (
      String(r.id) === String(data.id)
        ? { ...r, rule_name: name, weight, updated_by: M.currentUser, updated_at: M.now() }
        : r
    )));
    if (parts.length) {
      M.pushAllocateLog({ at: M.now(), who: M.currentUser, content: (prev ? prev.rule_code + "：" : "") + parts.join("；") });
    }
    U.closeDrawer("drawer-al");
    U.toast("配货规则已更新");
    renderAllocate();
  };

  function openAllocateLog() {
    const list = M.getAllocateLogs();
    document.getElementById("al-log-body").innerHTML = list.length
      ? list.map((row) => `<tr><td>${U.escapeHtml(row.at)}</td><td>${U.escapeHtml(row.who)}</td><td>${U.escapeHtml(row.content)}</td></tr>`).join("")
      : `<tr><td colspan="3">还没有操作记录</td></tr>`;
    document.getElementById("modal-al-log").classList.add("show");
  }
  document.getElementById("al-log").onclick = openAllocateLog;
  document.getElementById("modal-al-log").addEventListener("click", (e) => {
    if (e.target.id === "modal-al-log" || e.target.closest("[data-modal-close]")) {
      document.getElementById("modal-al-log").classList.remove("show");
    }
  });

  renderPutaway();
  renderWave();
  renderAllocate();
})();
