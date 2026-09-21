(function () {
  const M = window.WMS_MOCK;
  const U = window.WMS;
  const PAGE_SIZE = 10;

  let currentTab = "warehouse";
  let whPage = 1;
  let znPage = 1;
  let locPage = 1;
  let whFilter = {};
  let znFilter = {};
  let locFilter = {};
  const whSort = { key: "warehouse_code", dir: "asc" };
  const znSort = { key: "zone_code", dir: "asc" };
  const locSort = { key: "location_code", dir: "asc" };

  U.renderShell("warehouse");
  U.bindDrawerDismiss();
  U.bindMenus();

  const tabsApi = U.initTabs({
    root: document.getElementById("page-root"),
    onChange(name) {
      currentTab = name;
      if (name === "warehouse") renderWarehouses();
      if (name === "zone") renderZones();
      if (name === "location") renderLocations();
    },
  });
  currentTab = (location.hash || "#warehouse").replace("#", "") || "warehouse";

  document.getElementById("wh-add").onclick = () => openWarehouseDrawer(null);
  document.getElementById("zn-add").onclick = () => openZoneDrawer(null);
  document.getElementById("loc-add").onclick = () => openLocationDrawer(null);

  function syncBatchBar(barId, count, label) {
    const bar = document.getElementById(barId);
    if (!bar) return;
    const el = bar.querySelector(".sel-count");
    if (el) el.textContent = count ? `已选 ${count} ${label}` : "";
    bar.classList.toggle("has-selection", count > 0);
  }

  function applyWhFilter() {
    whFilter = {
      code: document.getElementById("wh-code").value.trim(),
      name: document.getElementById("wh-name").value.trim(),
    };
    whPage = 1;
    renderWarehouses();
  }
  function applyZnFilter() {
    znFilter = {
      code: document.getElementById("zn-code").value.trim(),
      name: document.getElementById("zn-name").value.trim(),
      warehouse_id: document.getElementById("zn-wh").value,
      site_id: document.getElementById("zn-site").value,
      zone_type: document.getElementById("zn-type").value,
    };
    znPage = 1;
    renderZones();
  }
  function applyLocFilter() {
    locFilter = {
      ...locFilter,
      code: document.getElementById("loc-code").value.trim(),
      site_id: document.getElementById("loc-site").value,
      zone_id: document.getElementById("loc-zone").value,
      warehouse_id: document.getElementById("loc-wh").value,
      is_empty: document.getElementById("loc-empty").value,
    };
    locPage = 1;
    renderLocations();
  }

  function refreshFilterSelects() {
    const whOpts = M.getWarehouses().map((w) => ({ value: w.id, label: `${w.warehouse_code} · ${w.warehouse_name}` }));
    const siteOpts = M.getSites().map((s) => ({ value: s.id, label: `${s.site_code} · ${s.site_name}` }));
    const zoneOpts = M.getZones().map((z) => ({ value: z.id, label: `${z.zone_code} · ${z.zone_name}` }));
    U.fillSelect(document.getElementById("zn-wh"), whOpts, { placeholder: "全部仓库" });
    U.fillSelect(document.getElementById("zn-site"), siteOpts, { placeholder: "全部站点" });
    U.fillSelect(document.getElementById("zn-type"), M.ENUMS.zoneTypes, { placeholder: "全部类型" });
    U.fillSelect(document.getElementById("loc-wh"), whOpts, { placeholder: "全部仓库" });
    U.fillSelect(document.getElementById("loc-site"), siteOpts, { placeholder: "全部站点" });
    U.fillSelect(document.getElementById("loc-zone"), zoneOpts, { placeholder: "全部库区" });
    U.fillSelect(document.getElementById("loc-empty"), M.ENUMS.emptyFlags);
  }

  function regionText(w) {
    const parts = [w.province, w.city, w.district].filter(Boolean);
    return parts.length ? parts.join(" / ") : "—";
  }

  /* —— 仓库 —— */
  function filteredWarehouses() {
    return M.getWarehouses().filter((w) => {
      if (whFilter.code && !w.warehouse_code.toLowerCase().includes(whFilter.code.toLowerCase())) return false;
      if (whFilter.name && !w.warehouse_name.includes(whFilter.name)) return false;
      return true;
    });
  }

  function renderWarehouses() {
    let filtered = filteredWarehouses();
    if (whSort.key) filtered = U.sortBy(filtered, whSort.key, whSort.dir);
    const meta = U.paginate(filtered, whPage, PAGE_SIZE);
    whPage = meta.page;
    const tbody = document.getElementById("wh-tbody");
    document.getElementById("wh-meta").textContent = `共 ${meta.total} 条`;
    if (!meta.list.length) {
      tbody.innerHTML = `<tr><td colspan="6">${U.emptyState({
        title: "暂无仓库",
        desc: "创建后可继续配置库区与库位",
        actionLabel: "新建仓库",
        actionId: "wh-empty-add",
      })}</td></tr>`;
      const btn = document.getElementById("wh-empty-add");
      if (btn) btn.onclick = () => openWarehouseDrawer(null);
    } else {
      tbody.innerHTML = meta.list.map((w) => `
        <tr>
          <td><code class="code-link">${U.escapeHtml(w.warehouse_code)}</code></td>
          <td>${U.escapeHtml(w.warehouse_name)}</td>
          <td>${U.escapeHtml(regionText(w))}</td>
          <td>${U.escapeHtml(w.contact_name || "—")}</td>
          <td class="ops">
            <button type="button" class="btn-link" data-wh-edit="${w.id}">编辑</button>
            <div class="menu">
              <button type="button" class="btn-link" data-menu-trigger>更多</button>
              <div class="menu-panel">
                <button type="button" class="menu-item" data-wh-goto-zone="${w.id}">查看库区</button>
              </div>
            </div>
          </td>
          <td>
            <div>${U.escapeHtml(w.updated_by)}</div>
            <div style="color:var(--text-tertiary);font-size:12px;">${U.escapeHtml(w.updated_at)}</div>
          </td>
        </tr>
      `).join("");
    }
    U.renderPagination(document.getElementById("wh-page"), meta, (p) => { whPage = p; renderWarehouses(); });
  }

  function openWarehouseDrawer(row) {
    const form = document.getElementById("form-wh");
    U.clearFormErrors(form);
    document.getElementById("drawer-wh-title").textContent = row ? "编辑仓库" : "新建仓库";
    form.id.value = row?.id || "";
    form.warehouse_code.value = row?.warehouse_code || "";
    form.warehouse_code.readOnly = !!row;
    form.warehouse_name.value = row?.warehouse_name || "";
    form.address.value = row?.address || "";
    form.postal_code.value = row?.postal_code || "";
    form.contact_name.value = row?.contact_name || "";
    form.contact_phone.value = row?.contact_phone || "";
    form.remark.value = row?.remark || "";
    U.initRegionSelects(
      document.getElementById("wh-province"),
      document.getElementById("wh-city"),
      document.getElementById("wh-district"),
      {
        province: row?.province || "",
        city: row?.city || "",
        district: row?.district || "",
        onChange() { if (postalLive) fillPostal(); },
      }
    );
    postalLive = true;
    U.openDrawer("drawer-wh");
  }

  let postalLive = false;
  function fillPostal() {
    const form = document.getElementById("form-wh");
    const region = window.WMS_REGION;
    if (!region) return;
    const code = region.lookup(form.province.value, form.city.value, form.district.value, form.address.value);
    if (code) form.postal_code.value = code;
  }
  document.getElementById("form-wh").address.addEventListener("input", () => {
    if (postalLive) fillPostal();
  });

  document.getElementById("wh-search").onclick = applyWhFilter;
  document.getElementById("wh-reset").onclick = () => {
    document.getElementById("wh-code").value = "";
    document.getElementById("wh-name").value = "";
    whFilter = {};
    whPage = 1;
    renderWarehouses();
  };
  document.getElementById("wh-refresh").onclick = () => {
    U.withButtonLoading(document.getElementById("wh-refresh"), () => {
      renderWarehouses();
      U.toast("已刷新");
    });
  };
  U.bindLiveFilters({ textIds: ["wh-code", "wh-name"], onApply: applyWhFilter });
  U.bindSortHeaders(document.querySelector('#wh-tbody')?.closest('table')?.querySelector('thead'), whSort, () => {
    whPage = 1;
    renderWarehouses();
  });
  document.getElementById("wh-tbody").addEventListener("click", (e) => {
    const editId = e.target.getAttribute("data-wh-edit");
    const gotoZone = e.target.getAttribute("data-wh-goto-zone");
    if (editId) {
      openWarehouseDrawer(M.getWarehouses().find((w) => String(w.id) === String(editId)));
    }
    if (gotoZone) {
      document.getElementById("zn-wh").value = gotoZone;
      znFilter = { ...znFilter, warehouse_id: gotoZone };
      tabsApi.activate("zone");
      renderZones();
    }
  });
  document.getElementById("form-wh").onsubmit = (e) => {
    e.preventDefault();
    const form = e.target;
    U.clearFormErrors(form);
    const data = U.getFormData(form);
    let ok = true;
    if (!data.warehouse_code?.trim() || data.warehouse_code.length > 50) {
      U.setFieldError(form, "warehouse_code", "请填写仓库编码（≤50）");
      ok = false;
    }
    if (!data.warehouse_name?.trim() || data.warehouse_name.length > 50) {
      U.setFieldError(form, "warehouse_name", "请填写仓库名称（≤50）");
      ok = false;
    }
    const list = M.getWarehouses();
    if (!data.id && list.some((w) => w.warehouse_code === data.warehouse_code.trim())) {
      U.setFieldError(form, "warehouse_code", "仓库编码已存在");
      ok = false;
    }
    if (!ok) return;
    const payload = {
      warehouse_code: data.warehouse_code.trim(),
      warehouse_name: data.warehouse_name.trim(),
      province: data.province || "",
      city: data.city || "",
      district: data.district || "",
      address: (data.address || "").trim(),
      postal_code: (data.postal_code || "").trim(),
      contact_name: (data.contact_name || "").trim(),
      contact_phone: (data.contact_phone || "").trim(),
      remark: (data.remark || "").trim(),
      status: 1,
      updated_by: M.currentUser,
      updated_at: M.now(),
    };
    if (data.id) {
      M.setWarehouses(list.map((w) => (String(w.id) === String(data.id) ? { ...w, ...payload, warehouse_code: w.warehouse_code } : w)));
      U.toast("仓库已更新");
    } else {
      M.setWarehouses([...list, { id: M.nextWarehouseId(), ...payload }]);
      U.toast("仓库已创建");
    }
    U.closeDrawer("drawer-wh");
    refreshFilterSelects();
    renderWarehouses();
  };

  /* —— 库区 —— */
  function filteredZones() {
    const whMap = U.warehouseMap();
    return M.getZones().filter((z) => {
      if (znFilter.code && !z.zone_code.toLowerCase().includes(znFilter.code.toLowerCase())) return false;
      if (znFilter.name && !z.zone_name.includes(znFilter.name)) return false;
      if (znFilter.warehouse_id && String(z.warehouse_id) !== String(znFilter.warehouse_id)) return false;
      if (znFilter.site_id && String(z.site_id || "") !== String(znFilter.site_id)) return false;
      if (znFilter.zone_type && z.zone_type !== znFilter.zone_type) return false;
      return true;
    }).map((z) => ({ ...z, _wh: whMap[z.warehouse_id] }));
  }

  function renderZones() {
    const siteMap = U.siteMap();
    let filtered = filteredZones();
    if (znSort.key) filtered = U.sortBy(filtered, znSort.key, znSort.dir);
    const meta = U.paginate(filtered, znPage, PAGE_SIZE);
    znPage = meta.page;
    const tbody = document.getElementById("zn-tbody");
    document.getElementById("zn-meta").textContent = `共 ${meta.total} 条`;
    if (!meta.list.length) {
      tbody.innerHTML = `<tr><td colspan="7">${U.emptyState({
        title: "还没有库区",
        desc: M.getWarehouses().length ? "" : "请先创建仓库",
        actionLabel: M.getWarehouses().length ? "新建库区" : "去建仓库",
        actionId: "zn-empty-add",
      })}</td></tr>`;
      const btn = document.getElementById("zn-empty-add");
      if (btn) {
        btn.onclick = () => {
          if (!M.getWarehouses().length) tabsApi.activate("warehouse");
          else openZoneDrawer(null);
        };
      }
    } else {
      tbody.innerHTML = meta.list.map((z) => `
        <tr>
          <td><code class="code-link">${U.escapeHtml(z.zone_code)}</code></td>
          <td>${U.escapeHtml(z.zone_name)}</td>
          <td>${U.escapeHtml(z._wh ? z._wh.warehouse_name : "—")}</td>
          <td>${z.site_id ? U.escapeHtml(siteMap[z.site_id]?.site_name || "—") : '<span class="tag tag-gray">全仓共享</span>'}</td>
          <td><span class="tag tag-gray">${U.escapeHtml(U.zoneTypeLabel(z.zone_type))}</span></td>
          <td class="ops">
            <button type="button" class="btn-link" data-zn-edit="${z.id}">编辑</button>
            <div class="menu">
              <button type="button" class="btn-link" data-menu-trigger>更多</button>
              <div class="menu-panel">
                <button type="button" class="menu-item" data-zn-goto-loc="${z.id}">查看库位</button>
              </div>
            </div>
          </td>
          <td>
            <div>${U.escapeHtml(z.updated_by)}</div>
            <div style="color:var(--text-tertiary);font-size:12px;">${U.escapeHtml(z.updated_at)}</div>
          </td>
        </tr>
      `).join("");
    }
    U.renderPagination(document.getElementById("zn-page"), meta, (p) => { znPage = p; renderZones(); });
  }

  function fillZoneFormSelects(selected = {}) {
    const form = document.getElementById("form-zn");
    U.fillSelect(
      form.warehouse_id,
      M.getWarehouses().map((w) => ({ value: w.id, label: `${w.warehouse_code} · ${w.warehouse_name}` })),
      { placeholder: "请选择仓库", selected: selected.warehouse_id }
    );
    U.fillSelect(form.zone_type, M.ENUMS.zoneTypes, { placeholder: "请选择类型", selected: selected.zone_type || "NORMAL" });
    U.fillSelect(
      form.site_id,
      M.getSites().map((s) => ({ value: s.id, label: `${s.site_code} · ${s.site_name}` })),
      { placeholder: "可不选（全仓共享）", selected: selected.site_id || "" }
    );
  }

  function openZoneDrawer(row) {
    if (!M.getWarehouses().length) {
      U.toast("请先创建仓库", "err");
      tabsApi.activate("warehouse");
      return;
    }
    const form = document.getElementById("form-zn");
    U.clearFormErrors(form);
    document.getElementById("drawer-zn-title").textContent = row ? "编辑库区" : "新建库区";
    form.id.value = row?.id || "";
    form.zone_code.value = row?.zone_code || "";
    form.zone_code.readOnly = !!row;
    form.zone_name.value = row?.zone_name || "";
    fillZoneFormSelects(row || { warehouse_id: znFilter.warehouse_id || "", zone_type: "NORMAL" });
    U.openDrawer("drawer-zn");
  }

  document.getElementById("zn-search").onclick = applyZnFilter;
  document.getElementById("zn-reset").onclick = () => {
    ["zn-code", "zn-name"].forEach((id) => { document.getElementById(id).value = ""; });
    document.getElementById("zn-wh").value = "";
    document.getElementById("zn-site").value = "";
    document.getElementById("zn-type").value = "";
    znFilter = {};
    znPage = 1;
    renderZones();
  };
  document.getElementById("zn-refresh").onclick = () => {
    U.withButtonLoading(document.getElementById("zn-refresh"), () => {
      renderZones();
      U.toast("已刷新");
    });
  };
  U.bindLiveFilters({
    textIds: ["zn-code", "zn-name"],
    selectIds: ["zn-wh", "zn-site", "zn-type"],
    onApply: applyZnFilter,
  });
  U.bindSortHeaders(document.querySelector('#zn-tbody')?.closest('table')?.querySelector('thead'), znSort, () => {
    znPage = 1;
    renderZones();
  });
  document.getElementById("zn-tbody").addEventListener("click", (e) => {
    const editId = e.target.getAttribute("data-zn-edit");
    const gotoLoc = e.target.getAttribute("data-zn-goto-loc");
    if (editId) openZoneDrawer(M.getZones().find((z) => String(z.id) === String(editId)));
    if (gotoLoc) {
      document.getElementById("loc-zone").value = gotoLoc;
      locFilter = { ...locFilter, zone_id: gotoLoc };
      tabsApi.activate("location");
      renderLocations();
    }
  });
  document.getElementById("form-zn").onsubmit = (e) => {
    e.preventDefault();
    const form = e.target;
    U.clearFormErrors(form);
    const data = U.getFormData(form);
    let ok = true;
    if (!data.zone_code?.trim()) { U.setFieldError(form, "zone_code", "请填写库区编码"); ok = false; }
    if (!data.zone_name?.trim()) { U.setFieldError(form, "zone_name", "请填写库区名称"); ok = false; }
    if (!data.warehouse_id) { U.setFieldError(form, "warehouse_id", "请选择所属仓库"); ok = false; }
    if (!data.zone_type) { U.setFieldError(form, "zone_type", "请选择库区类型"); ok = false; }
    const list = M.getZones();
    if (!data.id && list.some((z) => z.zone_code === data.zone_code.trim())) {
      U.setFieldError(form, "zone_code", "库区编码已存在");
      ok = false;
    }
    if (!ok) return;
    const payload = {
      zone_code: data.zone_code.trim(),
      zone_name: data.zone_name.trim(),
      warehouse_id: Number(data.warehouse_id),
      zone_type: data.zone_type,
      site_id: data.site_id ? Number(data.site_id) : null,
      updated_by: M.currentUser,
      updated_at: M.now(),
    };
    if (data.id) {
      M.setZones(list.map((z) => (String(z.id) === String(data.id) ? { ...z, ...payload, zone_code: z.zone_code } : z)));
      U.toast("库区已更新");
    } else {
      M.setZones([...list, { id: M.nextZoneId(), ...payload }]);
      U.toast("库区已创建");
    }
    U.closeDrawer("drawer-zn");
    refreshFilterSelects();
    renderZones();
  };

  /* —— 库位 —— */
  function enrichLocation(loc) {
    const zone = U.zoneMap()[loc.zone_id];
    const wh = zone ? U.warehouseMap()[zone.warehouse_id] : null;
    const site = zone && zone.site_id ? U.siteMap()[zone.site_id] : null;
    return { ...loc, zone, wh, site };
  }

  function filteredLocations() {
    return M.getLocations().map(enrichLocation).filter((l) => {
      if (locFilter.code && !l.location_code.toLowerCase().includes(locFilter.code.toLowerCase())) return false;
      if (locFilter.zone_id && String(l.zone_id) !== String(locFilter.zone_id)) return false;
      if (locFilter.warehouse_id && String(l.zone?.warehouse_id) !== String(locFilter.warehouse_id)) return false;
      if (locFilter.site_id && String(l.zone?.site_id || "") !== String(locFilter.site_id)) return false;
      if (locFilter.is_empty !== "" && locFilter.is_empty != null && String(l.is_empty) !== String(locFilter.is_empty)) return false;
      if (locFilter.status !== "" && locFilter.status != null && String(l.status) !== String(locFilter.status)) return false;
      return true;
    });
  }

  function renderLocations() {
    let filtered = filteredLocations();
    if (locSort.key) {
      const getters = {
        location_code: (l) => l.location_code,
        pick_priority: (l) => Number(l.pick_priority),
        updated_at: (l) => l.updated_at,
      };
      filtered = U.sortBy(filtered, getters[locSort.key] || locSort.key, locSort.dir);
    }
    const meta = U.paginate(filtered, locPage, PAGE_SIZE);
    locPage = meta.page;
    const tbody = document.getElementById("loc-tbody");
    document.getElementById("loc-meta").textContent = `共 ${meta.total} 条`;
    if (!meta.list.length) {
      tbody.innerHTML = `<tr><td colspan="11">${U.emptyState({
        title: "还没有库位",
        desc: M.getZones().length ? "" : "请先创建库区",
        actionLabel: M.getZones().length ? "新建库位" : "去建库区",
        actionId: "loc-empty-add",
      })}</td></tr>`;
      const btn = document.getElementById("loc-empty-add");
      if (btn) {
        btn.onclick = () => {
          if (!M.getZones().length) tabsApi.activate("zone");
          else openLocationDrawer(null);
        };
      }
      syncBatchBar("loc-actions", 0, "项");
    } else {
      tbody.innerHTML = meta.list.map((l) => `
        <tr>
          <td><input type="checkbox" class="loc-check" value="${l.id}" /></td>
          <td><code class="code-link">${U.escapeHtml(l.location_code)}</code></td>
          <td>${U.escapeHtml(l.wh?.warehouse_name || "—")}</td>
          <td>${U.escapeHtml(l.zone?.zone_name || "—")}</td>
          <td>${l.site ? U.escapeHtml(l.site.site_name) : '<span class="tag tag-gray">—</span>'}</td>
          <td>${Number(l.pick_priority).toFixed(2)}</td>
          <td>${l.sku_qty_limit === 0 ? "不限制" : l.sku_qty_limit}</td>
          <td>${Number(l.is_empty) === 1 ? '<span class="tag tag-gray">是</span>' : '<span class="tag tag-gray">否</span>'}</td>
          <td>${U.statusTag(l.status, "正常", "停用")}</td>
          <td class="ops"><button type="button" class="btn-link" data-loc-edit="${l.id}">编辑</button></td>
          <td>
            <div>${U.escapeHtml(l.updated_by)}</div>
            <div style="color:var(--text-tertiary);font-size:12px;">${U.escapeHtml(l.updated_at)}</div>
          </td>
        </tr>
      `).join("");
      syncBatchBar("loc-actions", 0, "项");
    }
    document.getElementById("loc-check-all").checked = false;
    U.renderPagination(document.getElementById("loc-page"), meta, (p) => { locPage = p; renderLocations(); });
  }

  function updateLocZoneHint() {
    const form = document.getElementById("form-loc");
    const zone = U.zoneMap()[form.zone_id.value];
    const hint = document.getElementById("loc-zone-hint");
    if (!zone) {
      hint.innerHTML = "选择库区后自动带出所属仓库 / 站点";
      return;
    }
    const wh = U.warehouseMap()[zone.warehouse_id];
    const site = zone.site_id ? U.siteMap()[zone.site_id] : null;
    hint.innerHTML = `<span class="context-chip">仓库 ${U.escapeHtml(wh?.warehouse_name || "—")}</span>
      <span class="context-chip" style="margin-left:6px;">站点 ${U.escapeHtml(site?.site_name || "全仓共享")}</span>`;
  }

  function openLocationDrawer(row) {
    if (!M.getZones().length) {
      U.toast("请先创建库区", "err");
      tabsApi.activate("zone");
      return;
    }
    const form = document.getElementById("form-loc");
    U.clearFormErrors(form);
    document.getElementById("drawer-loc-title").textContent = row ? "编辑库位" : "新建库位";
    form.id.value = row?.id || "";
    form.location_code.value = row?.location_code || "";
    form.location_code.readOnly = !!row;
    form.pick_priority.value = row?.pick_priority ?? "1.00";
    form.sku_qty_limit.value = row?.sku_qty_limit ?? 0;
    U.fillSelect(
      form.zone_id,
      M.getZones().map((z) => ({ value: z.id, label: `${z.zone_code} · ${z.zone_name}` })),
      { placeholder: "请选择库区", selected: row?.zone_id || locFilter.zone_id || "" }
    );
    form.zone_id.onchange = updateLocZoneHint;
    updateLocZoneHint();
    U.openDrawer("drawer-loc");
  }

  function selectedLocationIds() {
    return Array.from(document.querySelectorAll(".loc-check:checked")).map((el) => Number(el.value));
  }

  function setLocationStatus(ids, status) {
    if (!ids.length) return U.toast("请先勾选库位", "err");
    M.setLocations(M.getLocations().map((l) => (
      ids.includes(l.id) ? { ...l, status, updated_by: M.currentUser, updated_at: M.now() } : l
    )));
    U.toast(status === 1 ? "已启用所选库位" : "已停用所选库位");
    renderLocations();
  }

  document.getElementById("loc-search").onclick = applyLocFilter;
  document.getElementById("loc-reset").onclick = () => {
    document.getElementById("loc-code").value = "";
    document.getElementById("loc-site").value = "";
    document.getElementById("loc-zone").value = "";
    document.getElementById("loc-wh").value = "";
    document.getElementById("loc-empty").value = "";
    const status = locFilter.status;
    locFilter = status !== undefined && status !== "" ? { status } : {};
    locPage = 1;
    renderLocations();
  };
  document.getElementById("loc-refresh").onclick = () => {
    U.withButtonLoading(document.getElementById("loc-refresh"), () => {
      renderLocations();
      U.toast("已刷新");
    });
  };
  document.getElementById("loc-enable").onclick = () => setLocationStatus(selectedLocationIds(), 1);
  document.getElementById("loc-disable").onclick = () => setLocationStatus(selectedLocationIds(), 0);
  document.getElementById("loc-print").onclick = () => U.toast("打印库位码：功能占位", "info");
  document.getElementById("loc-import").onclick = () => U.toast("导入库位：功能占位", "info");
  document.getElementById("loc-tpl").onclick = () => U.toast("已模拟下载导入模板", "info");
  document.getElementById("loc-status-tabs").addEventListener("click", (e) => {
    const btn = e.target.closest("[data-loc-status]");
    if (!btn) return;
    locFilter = { ...locFilter, status: btn.getAttribute("data-loc-status") ?? "" };
    document.querySelectorAll("#loc-status-tabs .sub-tab").forEach((t) => t.classList.toggle("active", t === btn));
    locPage = 1;
    renderLocations();
  });
  U.bindLiveFilters({
    textIds: ["loc-code"],
    selectIds: ["loc-wh", "loc-zone", "loc-site", "loc-empty"],
    onApply: applyLocFilter,
  });
  U.bindSortHeaders(document.querySelector('#loc-tbody')?.closest('table')?.querySelector('thead'), locSort, () => {
    locPage = 1;
    renderLocations();
  });
  document.getElementById("loc-check-all").onchange = (e) => {
    document.querySelectorAll(".loc-check").forEach((c) => { c.checked = e.target.checked; });
    syncBatchBar("loc-actions", e.target.checked ? document.querySelectorAll(".loc-check").length : 0, "项");
    U.syncRowSelection(document.getElementById("loc-tbody"), ".loc-check");
  };
  document.getElementById("loc-tbody").addEventListener("change", (e) => {
    if (!e.target.classList.contains("loc-check")) return;
    const n = document.querySelectorAll(".loc-check:checked").length;
    document.getElementById("loc-check-all").checked =
      n > 0 && n === document.querySelectorAll(".loc-check").length;
    syncBatchBar("loc-actions", n, "项");
    U.syncRowSelection(document.getElementById("loc-tbody"), ".loc-check");
  });
  document.getElementById("loc-tbody").addEventListener("click", (e) => {
    const id = e.target.getAttribute("data-loc-edit");
    if (!id) return;
    openLocationDrawer(M.getLocations().find((l) => String(l.id) === String(id)));
  });
  document.getElementById("form-loc").onsubmit = (e) => {
    e.preventDefault();
    const form = e.target;
    U.clearFormErrors(form);
    const data = U.getFormData(form);
    let ok = true;
    if (!data.location_code?.trim()) { U.setFieldError(form, "location_code", "请填写库位编码"); ok = false; }
    if (!data.zone_id) { U.setFieldError(form, "zone_id", "请选择所属库区"); ok = false; }
    const priority = Number(data.pick_priority);
    if (data.pick_priority === "" || Number.isNaN(priority) || priority < 0) {
      U.setFieldError(form, "pick_priority", "拣货优先级须 ≥ 0");
      ok = false;
    } else if (!/^\d+(\.\d{1,2})?$/.test(String(data.pick_priority))) {
      U.setFieldError(form, "pick_priority", "最多保留 2 位小数");
      ok = false;
    }
    const list = M.getLocations();
    if (!data.id && list.some((l) => l.location_code === data.location_code.trim())) {
      U.setFieldError(form, "location_code", "库位编码已存在");
      ok = false;
    }
    if (!ok) return;
    const payload = {
      location_code: data.location_code.trim(),
      zone_id: Number(data.zone_id),
      pick_priority: Number(Number(data.pick_priority).toFixed(2)),
      sku_qty_limit: data.sku_qty_limit === "" ? 0 : Math.max(0, parseInt(data.sku_qty_limit, 10) || 0),
      updated_by: M.currentUser,
      updated_at: M.now(),
    };
    if (data.id) {
      M.setLocations(list.map((l) => (String(l.id) === String(data.id) ? { ...l, ...payload, location_code: l.location_code } : l)));
      U.toast("库位已更新");
    } else {
      M.setLocations([...list, { id: M.nextLocationId(), is_empty: 1, status: 1, ...payload }]);
      U.toast("库位已创建");
    }
    U.closeDrawer("drawer-loc");
    refreshFilterSelects();
    renderLocations();
  };

  refreshFilterSelects();
  renderWarehouses();
  renderZones();
  renderLocations();
})();
