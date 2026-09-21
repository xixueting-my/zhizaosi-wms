(function () {
  const M = window.WMS_MOCK;
  const U = window.WMS;
  let currentTab = "approval";
  let qcFilter = {};
  let szFilter = {};
  let prStatus = "";
  const prSort = { key: "reason_desc", dir: "asc" };
  const qcSort = { key: "category_l1", dir: "asc" };
  const szSort = { key: "site_id", dir: "asc" };

  U.renderShell("params");
  U.bindDrawerDismiss();

  const tabsApi = U.initTabs({
    root: document.getElementById("page-root"),
    onChange(name) { currentTab = name; },
  });
  currentTab = (location.hash || "#approval").replace("#", "") || "approval";

  function syncBatchBar(barId, count, label) {
    const bar = document.getElementById(barId);
    if (!bar) return;
    const el = bar.querySelector(".sel-count");
    if (el) el.textContent = count ? `已选 ${count} ${label}` : "";
    bar.classList.toggle("has-selection", count > 0);
  }

  function applyQcFilter() {
    qcFilter = {
      l1: document.getElementById("qc-l1").value.trim(),
      l2: document.getElementById("qc-l2").value.trim(),
      l3: document.getElementById("qc-l3").value.trim(),
    };
    renderQc();
  }
  function applySzFilter() {
    szFilter = { site_id: document.getElementById("sz-site").value };
    renderSiteZone();
  }

  document.getElementById("af-edit").onclick = () => {
    const first = M.getApprovalFlows()[0];
    if (first) openApprovalDrawer(first);
    else U.toast("暂无审批流可编辑", "info");
  };
  document.getElementById("pr-add").onclick = () => openPartialDrawer(null);
  document.getElementById("qc-add").onclick = () => openQcDrawer(null);
  document.getElementById("sz-add").onclick = () => openSiteZoneDrawer(null);

  /* —— 审批流 —— */
  function nodeSummary(flow) {
    if (flow.node_summary) return U.escapeHtml(flow.node_summary);
    const labels = (flow.nodes || []).map((n) => U.approverLabel(n)).filter(Boolean);
    return labels.length
      ? labels.map((l) => `<span class="tag tag-gray">${U.escapeHtml(l)}</span>`).join(" <span style=\"color:var(--text-tertiary)\">→</span> ")
      : "—";
  }

  function renderApproval() {
    document.getElementById("af-tbody").innerHTML = M.getApprovalFlows().map((f) => `
      <tr>
        <td>${U.escapeHtml(f.flow_name)}</td>
        <td><div class="tag-list" style="align-items:center;">${nodeSummary(f)}</div></td>
        <td><button type="button" class="btn-link" data-af-edit="${f.id}">编辑</button></td>
        <td>
          <div>${U.escapeHtml(f.updated_by)}</div>
          <div style="color:var(--text-tertiary);font-size:12px;">${U.escapeHtml(f.updated_at)}</div>
        </td>
      </tr>
    `).join("");
  }

  function openApprovalDrawer(row) {
    const form = document.getElementById("form-af");
    form.id.value = row.id;
    form.flow_name.value = row.flow_name;
    const wrap = document.getElementById("af-nodes");
    const nodes = row.nodes || ["", "", "", "", "", ""];
    wrap.innerHTML = "";
    ["一", "二", "三", "四", "五", "六"].forEach((label, i) => {
      const item = document.createElement("div");
      item.className = "field";
      item.innerHTML = `<label>审批节点${label}</label>`;
      const sel = document.createElement("select");
      sel.name = `node_${i + 1}`;
      U.fillSelect(sel, M.ENUMS.approvers, { placeholder: "留空则跳过", selected: nodes[i] || "" });
      item.appendChild(sel);
      wrap.appendChild(item);
    });
    U.openDrawer("drawer-af");
  }

  document.getElementById("af-tbody").addEventListener("click", (e) => {
    const id = e.target.getAttribute("data-af-edit");
    if (!id) return;
    openApprovalDrawer(M.getApprovalFlows().find((f) => String(f.id) === String(id)));
  });

  document.getElementById("form-af").onsubmit = (e) => {
    e.preventDefault();
    if (!U.confirmAction("修改审批流会影响在途盘点任务（将从节点一重走）。确认保存？")) return;
    const data = U.getFormData(e.target);
    const nodes = [1, 2, 3, 4, 5, 6].map((i) => data[`node_${i}`] || "");
    M.setApprovalFlows(M.getApprovalFlows().map((f) => (
      String(f.id) === String(data.id)
        ? { ...f, nodes, node_summary: undefined, updated_by: M.currentUser, updated_at: M.now() }
        : f
    )));
    U.closeDrawer("drawer-af");
    U.toast("审批流已更新");
    renderApproval();
  };

  /* —— 部分收货 —— */
  function filteredPartial() {
    return M.getPartialReasons().filter((r) => {
      if (prStatus !== "" && String(r.status) !== String(prStatus)) return false;
      return true;
    });
  }

  function renderPartial() {
    let list = filteredPartial();
    if (prSort.key) list = U.sortBy(list, prSort.key, prSort.dir);
    document.getElementById("pr-meta").textContent = `共 ${list.length} 条`;
    document.getElementById("pr-tbody").innerHTML = list.length ? list.map((r) => `
      <tr>
        <td><input type="checkbox" class="pr-check" value="${r.id}" /></td>
        <td>${r.id}</td>
        <td>${U.escapeHtml(r.reason_desc)}</td>
        <td>${U.statusTag(r.status)}</td>
        <td><button type="button" class="btn-link" data-pr-edit="${r.id}">编辑</button></td>
        <td>
          <div>${U.escapeHtml(r.updated_by)}</div>
          <div style="color:var(--text-tertiary);font-size:12px;">${U.escapeHtml(r.updated_at)}</div>
        </td>
      </tr>
    `).join("") : `<tr><td colspan="6">${U.emptyState({ title: "暂无原因", desc: "新增后可在收货作业中选用。", actionLabel: "新增原因", actionId: "pr-empty-add" })}</td></tr>`;
    const emptyBtn = document.getElementById("pr-empty-add");
    if (emptyBtn) emptyBtn.onclick = () => openPartialDrawer(null);
    document.getElementById("pr-check-all").checked = false;
    syncBatchBar("pr-actions", 0, "项");
  }

  function openPartialDrawer(row) {
    const form = document.getElementById("form-pr");
    U.clearFormErrors(form);
    document.getElementById("drawer-pr-title").textContent = row ? "编辑部分收货原因" : "新增部分收货原因";
    form.id.value = row?.id || "";
    form.reason_desc.value = row?.reason_desc || "";
    const status = row ? String(row.status) : "1";
    form.querySelectorAll('input[name="status"]').forEach((r) => { r.checked = r.value === status; });
    U.openDrawer("drawer-pr");
  }

  function selectedPartialIds() {
    return Array.from(document.querySelectorAll(".pr-check:checked")).map((el) => Number(el.value));
  }

  function setPartialStatus(ids, status) {
    if (!ids.length) return U.toast("请先勾选记录", "err");
    M.setPartialReasons(M.getPartialReasons().map((r) => (
      ids.includes(r.id) ? { ...r, status, updated_by: M.currentUser, updated_at: M.now() } : r
    )));
    U.toast(status === 1 ? "已启用" : "已停用");
    renderPartial();
  }

  document.getElementById("pr-refresh").onclick = () => {
    U.withButtonLoading(document.getElementById("pr-refresh"), () => {
      renderPartial();
      U.toast("已刷新");
    });
  };
  document.getElementById("pr-enable").onclick = () => setPartialStatus(selectedPartialIds(), 1);
  document.getElementById("pr-disable").onclick = () => setPartialStatus(selectedPartialIds(), 0);
  document.getElementById("pr-status-tabs").addEventListener("click", (e) => {
    const btn = e.target.closest("[data-pr-status]");
    if (!btn) return;
    prStatus = btn.getAttribute("data-pr-status") ?? "";
    document.querySelectorAll("#pr-status-tabs .sub-tab").forEach((t) => t.classList.toggle("active", t === btn));
    renderPartial();
  });
  U.bindSortHeaders(document.querySelector("#pr-tbody")?.closest("table")?.querySelector("thead"), prSort, renderPartial);
  document.getElementById("pr-check-all").onchange = (e) => {
    document.querySelectorAll(".pr-check").forEach((c) => { c.checked = e.target.checked; });
    syncBatchBar("pr-actions", e.target.checked ? document.querySelectorAll(".pr-check").length : 0, "项");
    U.syncRowSelection(document.getElementById("pr-tbody"), ".pr-check");
  };
  document.getElementById("pr-tbody").addEventListener("change", (e) => {
    if (!e.target.classList.contains("pr-check")) return;
    const n = document.querySelectorAll(".pr-check:checked").length;
    document.getElementById("pr-check-all").checked =
      n > 0 && n === document.querySelectorAll(".pr-check").length;
    syncBatchBar("pr-actions", n, "项");
    U.syncRowSelection(document.getElementById("pr-tbody"), ".pr-check");
  });
  document.getElementById("pr-tbody").addEventListener("click", (e) => {
    const id = e.target.getAttribute("data-pr-edit");
    if (!id) return;
    openPartialDrawer(M.getPartialReasons().find((r) => String(r.id) === String(id)));
  });
  document.getElementById("form-pr").onsubmit = (e) => {
    e.preventDefault();
    const form = e.target;
    U.clearFormErrors(form);
    const data = U.getFormData(form);
    if (!data.reason_desc?.trim()) return U.setFieldError(form, "reason_desc", "请填写原因描述");
    const payload = {
      reason_desc: data.reason_desc.trim(),
      status: Number(data.status),
      updated_by: M.currentUser,
      updated_at: M.now(),
    };
    const list = M.getPartialReasons();
    if (data.id) {
      M.setPartialReasons(list.map((r) => (String(r.id) === String(data.id) ? { ...r, ...payload } : r)));
      U.toast("已更新");
    } else {
      M.setPartialReasons([...list, { id: M.nextPartialId(), ...payload }]);
      U.toast("已新增");
    }
    U.closeDrawer("drawer-pr");
    renderPartial();
  };

  /* —— 质检 —— */
  function filteredQc() {
    return M.getQcReasons().filter((r) => {
      if (qcFilter.l1 && !r.category_l1.includes(qcFilter.l1)) return false;
      if (qcFilter.l2 && !r.category_l2.includes(qcFilter.l2)) return false;
      if (qcFilter.l3 && !r.category_l3.includes(qcFilter.l3)) return false;
      return true;
    });
  }

  function renderQc() {
    let list = filteredQc();
    if (qcSort.key) list = U.sortBy(list, qcSort.key, qcSort.dir);
    document.getElementById("qc-meta").textContent = `共 ${list.length} 条`;
    document.getElementById("qc-tbody").innerHTML = list.length ? list.map((r) => `
      <tr>
        <td>${r.id}</td>
        <td>${U.escapeHtml(r.category_l1)}</td>
        <td>${U.escapeHtml(r.category_l2)}</td>
        <td>${U.escapeHtml(r.category_l3)}</td>
        <td><button type="button" class="btn-link" data-qc-edit="${r.id}">编辑</button></td>
        <td>
          <div>${U.escapeHtml(r.updated_by)}</div>
          <div style="color:var(--text-tertiary);font-size:12px;">${U.escapeHtml(r.updated_at)}</div>
        </td>
      </tr>
    `).join("") : `<tr><td colspan="6">${U.emptyState({ title: "暂无质检原因", desc: "按一二三级分类维护不合格字典。", actionLabel: "+ 新增原因", actionId: "qc-empty-add" })}</td></tr>`;
    const emptyBtn = document.getElementById("qc-empty-add");
    if (emptyBtn) emptyBtn.onclick = () => openQcDrawer(null);
  }

  function openQcDrawer(row) {
    const form = document.getElementById("form-qc");
    U.clearFormErrors(form);
    document.getElementById("drawer-qc-title").textContent = row ? "编辑质检不合格原因" : "新增质检不合格原因";
    form.id.value = row?.id || "";
    form.category_l1.value = row?.category_l1 || "";
    form.category_l2.value = row?.category_l2 || "";
    form.category_l3.value = row?.category_l3 || "";
    U.openDrawer("drawer-qc");
  }

  document.getElementById("qc-search").onclick = applyQcFilter;
  document.getElementById("qc-reset").onclick = () => {
    document.getElementById("qc-l1").value = "";
    document.getElementById("qc-l2").value = "";
    document.getElementById("qc-l3").value = "";
    qcFilter = {};
    renderQc();
  };
  document.getElementById("qc-refresh").onclick = () => {
    U.withButtonLoading(document.getElementById("qc-refresh"), () => {
      renderQc();
      U.toast("已刷新");
    });
  };
  U.bindLiveFilters({ textIds: ["qc-l1", "qc-l2", "qc-l3"], onApply: applyQcFilter });
  U.bindSortHeaders(document.querySelector("#qc-tbody")?.closest("table")?.querySelector("thead"), qcSort, renderQc);
  document.getElementById("qc-tbody").addEventListener("click", (e) => {
    const id = e.target.getAttribute("data-qc-edit");
    if (!id) return;
    openQcDrawer(M.getQcReasons().find((r) => String(r.id) === String(id)));
  });
  document.getElementById("form-qc").onsubmit = (e) => {
    e.preventDefault();
    const form = e.target;
    U.clearFormErrors(form);
    const data = U.getFormData(form);
    let ok = true;
    ["category_l1", "category_l2", "category_l3"].forEach((k) => {
      if (!data[k]?.trim()) { U.setFieldError(form, k, "必填"); ok = false; }
    });
    if (!ok) return;
    const payload = {
      category_l1: data.category_l1.trim(),
      category_l2: data.category_l2.trim(),
      category_l3: data.category_l3.trim(),
      updated_by: M.currentUser,
      updated_at: M.now(),
    };
    const list = M.getQcReasons();
    if (data.id) {
      M.setQcReasons(list.map((r) => (String(r.id) === String(data.id) ? { ...r, ...payload } : r)));
      U.toast("已更新");
    } else {
      M.setQcReasons([...list, { id: M.nextQcId(), ...payload }]);
      U.toast("已新增");
    }
    U.closeDrawer("drawer-qc");
    renderQc();
  };

  /* —— 站点库区 —— */
  function renderSiteZone() {
    const zoneMap = U.zoneMap();
    const siteMap = U.siteMap();
    let list = M.getSiteZoneBindings();
    if (szFilter.site_id) list = list.filter((b) => String(b.site_id) === String(szFilter.site_id));
    if (szSort.key) {
      list = U.sortBy(list, (b) => {
        if (szSort.key === "site_id") return siteMap[b.site_id]?.site_name || "";
        return b[szSort.key];
      }, szSort.dir);
    }
    document.getElementById("sz-meta").textContent = `共 ${list.length} 条`;
    document.getElementById("sz-tbody").innerHTML = list.length ? list.map((b) => {
      const tags = (b.zone_ids || []).map((zid) => {
        const z = zoneMap[zid];
        return `<span class="tag tag-gray">${U.escapeHtml(z ? z.zone_name : zid)}</span>`;
      }).join("");
      const def = zoneMap[b.default_zone_id];
      return `
        <tr>
          <td><code>${U.escapeHtml(b.site_display_id || b.id)}</code></td>
          <td>${U.escapeHtml(siteMap[b.site_id]?.site_name || "—")}</td>
          <td><div class="tag-list">${tags}</div></td>
          <td>${(b.zone_ids || []).length}</td>
          <td>${U.escapeHtml(def?.zone_name || "—")}</td>
          <td><button type="button" class="btn-link" data-sz-edit="${b.id}">编辑</button></td>
        </tr>
      `;
    }).join("") : `<tr><td colspan="6">${U.emptyState({ title: "暂无站点绑定", desc: "将站点与可用库区关联，并指定默认库区。", actionLabel: "+ 新增绑定", actionId: "sz-empty-add" })}</td></tr>`;
    const emptyBtn = document.getElementById("sz-empty-add");
    if (emptyBtn) emptyBtn.onclick = () => openSiteZoneDrawer(null);
  }

  function syncDefaultZoneOptions(selectedZones, selectedDefault) {
    const form = document.getElementById("form-sz");
    const zoneMap = U.zoneMap();
    const opts = selectedZones.map((id) => ({
      value: id,
      label: zoneMap[id] ? `${zoneMap[id].zone_code} · ${zoneMap[id].zone_name}` : id,
    }));
    U.fillSelect(form.default_zone_id, opts, {
      placeholder: opts.length ? "请选择默认库区" : "请先绑定库区",
      selected: selectedDefault,
    });
  }

  function openSiteZoneDrawer(row) {
    const form = document.getElementById("form-sz");
    U.clearFormErrors(form);
    document.getElementById("drawer-sz-title").textContent = row ? "编辑站点库区绑定" : "新增站点库区绑定";
    form.id.value = row?.id || "";
    const usedSites = new Set(M.getSiteZoneBindings().map((b) => String(b.site_id)));
    const siteOpts = M.getSites()
      .filter((s) => !usedSites.has(String(s.id)) || (row && String(row.site_id) === String(s.id)))
      .map((s) => ({ value: s.id, label: `${s.site_code} · ${s.site_name}` }));
    U.fillSelect(form.site_id, siteOpts, { placeholder: "请选择站点", selected: row?.site_id });
    form.site_id.disabled = !!row;
    const selected = new Set((row?.zone_ids || []).map(String));
    const box = document.getElementById("sz-zones");
    box.innerHTML = M.getZones().map((z) => `
      <label><input type="checkbox" name="zone_ids" value="${z.id}" ${selected.has(String(z.id)) ? "checked" : ""} /> ${U.escapeHtml(z.zone_code)} · ${U.escapeHtml(z.zone_name)}</label>
    `).join("");
    const checkedIds = () => Array.from(box.querySelectorAll("input:checked")).map((el) => el.value);
    syncDefaultZoneOptions(checkedIds(), row?.default_zone_id);
    box.onchange = () => {
      const ids = checkedIds();
      const cur = form.default_zone_id.value;
      syncDefaultZoneOptions(ids, ids.includes(cur) ? cur : "");
    };
    U.openDrawer("drawer-sz");
  }

  U.fillSelect(
    document.getElementById("sz-site"),
    M.getSites().map((s) => ({ value: s.id, label: `${s.site_code} · ${s.site_name}` })),
    { placeholder: "全部站点" }
  );
  document.getElementById("sz-search").onclick = applySzFilter;
  document.getElementById("sz-reset").onclick = () => {
    document.getElementById("sz-site").value = "";
    szFilter = {};
    renderSiteZone();
  };
  document.getElementById("sz-refresh").onclick = () => {
    U.withButtonLoading(document.getElementById("sz-refresh"), () => {
      renderSiteZone();
      U.toast("已刷新");
    });
  };
  U.bindLiveFilters({ selectIds: ["sz-site"], onApply: applySzFilter });
  U.bindSortHeaders(document.querySelector("#sz-tbody")?.closest("table")?.querySelector("thead"), szSort, renderSiteZone);
  document.getElementById("sz-tbody").addEventListener("click", (e) => {
    const id = e.target.getAttribute("data-sz-edit");
    if (!id) return;
    openSiteZoneDrawer(M.getSiteZoneBindings().find((b) => String(b.id) === String(id)));
  });
  document.getElementById("form-sz").onsubmit = (e) => {
    e.preventDefault();
    const form = e.target;
    U.clearFormErrors(form);
    const data = U.getFormData(form);
    const zoneIds = Array.isArray(data.zone_ids) ? data.zone_ids : (data.zone_ids ? [data.zone_ids] : []);
    let ok = true;
    if (!data.site_id) { U.setFieldError(form, "site_id", "请选择站点"); ok = false; }
    if (!zoneIds.length) { U.setFieldError(form, "zone_ids", "请至少绑定一个库区"); ok = false; }
    if (!data.default_zone_id) { U.setFieldError(form, "default_zone_id", "请选择默认库区"); ok = false; }
    else if (!zoneIds.map(String).includes(String(data.default_zone_id))) {
      U.setFieldError(form, "default_zone_id", "默认库区必须属于已绑定库区");
      ok = false;
    }
    if (!ok) return;
    const payload = {
      site_id: Number(data.site_id),
      zone_ids: zoneIds.map(Number),
      default_zone_id: Number(data.default_zone_id),
      updated_by: M.currentUser,
      updated_at: M.now(),
    };
    const list = M.getSiteZoneBindings();
    if (data.id) {
      M.setSiteZoneBindings(list.map((b) => (String(b.id) === String(data.id) ? { ...b, ...payload } : b)));
      U.toast("已更新");
    } else {
      const newId = M.nextSiteZoneId();
      M.setSiteZoneBindings([...list, { id: newId, site_display_id: `GLB${String(4598000 + newId)}`, ...payload }]);
      U.toast("已新增");
    }
    U.closeDrawer("drawer-sz");
    renderSiteZone();
  };

  renderApproval();
  renderPartial();
  renderQc();
  renderSiteZone();
})();
