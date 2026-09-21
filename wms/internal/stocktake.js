(function () {
  const F = window.WMS_FLOW;
  const UI = window.WMS_UI;
  const U = window.WMS;
  const PHASE = {
    count: "待盘点",
    pending_submit: "待提交供应链审核",
    auditing: "供应链审核中",
    done: "盘点完成",
    cancelled: "已取消",
  };
  let view = "task";
  let phase = "count";
  let q = { no: "", type: "", src: "", who: "" };

  UI.boot("stocktake");
  U.bindDrawerDismiss();

  function all() { return F.get().stocktakes || []; }
  function filtered() {
    return all().filter((t) => {
      if (view === "audit") {
        if (phase === "auditing" && t.phase !== "auditing") return false;
        if (phase === "audited" && !(t.phase === "done" && t.audit_result)) return false;
      } else if (t.phase !== phase) return false;
      if (q.type && t.type !== q.type) return false;
      if (q.no && !String(t.st_no).includes(q.no)) return false;
      if (q.src && !String(t.source_no || "").includes(q.src)) return false;
      if (q.who && !String(t.counter || "").includes(q.who)) return false;
      return true;
    });
  }
  function selected() {
    return [...document.querySelectorAll(".row-check:checked")].map((el) => el.value);
  }

  function tabs() {
    document.getElementById("view-tabs").innerHTML = [
      ["task", "盘点任务"],
      ["audit", "盘点审核"],
    ].map(([k, lab]) => `<button type="button" class="sub-tab${view === k ? " active" : ""}" data-view="${k}">${lab}</button>`).join("");
    const items = view === "audit"
      ? [["auditing", "待审核"], ["audited", "已审核"]]
      : Object.keys(PHASE).map((k) => [k, PHASE[k]]);
    document.getElementById("status-tabs").innerHTML = items.map(([k, lab]) => {
      const n = view === "audit"
        ? all().filter((t) => (k === "auditing" ? t.phase === "auditing" : t.phase === "done" && t.audit_result)).length
        : all().filter((t) => t.phase === k).length;
      return `<button type="button" class="sub-tab${phase === k ? " active" : ""}" data-st="${k}">${lab} (${n})</button>`;
    }).join("");
  }

  function render() {
    tabs();
    const list = filtered();
    const audit = view === "audit";
    document.getElementById("thead").innerHTML = `<tr>
      ${audit ? "" : "<th></th>"}
      <th>盘点任务号</th><th>盘点类型</th><th>是否存在差异</th><th>来源单号</th><th>盘点库区</th><th>数量</th><th>盘点人</th>
      ${audit ? "<th>当前审批人</th>" : "<th>备注</th>"}
      <th>操作</th></tr>`;
    document.getElementById("tbody").innerHTML = list.map((t) => `<tr>
      ${audit ? "" : `<td><input type="checkbox" class="row-check" value="${U.escapeHtml(t.id)}" /></td>`}
      <td><button type="button" class="btn-link" data-act="detail" data-id="${t.id}">${U.escapeHtml(t.st_no)}</button></td>
      <td>${U.escapeHtml(t.type || "")}</td>
      <td>${t.diff ? "是" : "否"}</td>
      <td>${U.escapeHtml(t.source_no || "-")}</td>
      <td>${U.escapeHtml(t.zone || "-")}</td>
      <td>${t.qty || 0}</td>
      <td>${U.escapeHtml(t.counter || "-")}</td>
      <td>${U.escapeHtml(audit ? (t.auditor || "-") : (t.remark || "-"))}</td>
      <td class="ops">
        ${t.phase === "pending_submit" ? UI.linkBtn("提交审核", `data-act="submit" data-id="${t.id}"`) : ""}
        ${t.phase === "auditing" ? UI.linkBtn("无异议", `data-act="none" data-id="${t.id}"`) + UI.linkBtn("发起复盘", `data-act="recount" data-id="${t.id}"`) : ""}
        ${UI.linkBtn("操作日志", `data-act="log" data-id="${t.id}"`)}
      </td>
    </tr>`).join("") || `<tr><td colspan="10">没有数据</td></tr>`;
    document.getElementById("actions").innerHTML = audit ? `<span class="toolbar-meta">共 ${list.length} 条</span>` : `
      <button type="button" class="btn btn-primary" id="btn-new">新增盘点任务</button>
      <button type="button" class="btn" id="btn-assign">分配任务</button>
      <button type="button" class="btn" id="btn-cancel">取消任务</button>
      <button type="button" class="btn" id="btn-import">导入盘点任务</button>
      <button type="button" class="btn" id="btn-tpl">下载导入模板</button>
      <button type="button" class="btn" id="btn-export">导出</button>
      <input type="file" id="file-import" accept=".csv,text/csv" hidden />
      <span class="toolbar-meta">共 ${list.length} 条</span>`;
    const neu = document.getElementById("btn-new");
    if (neu) neu.onclick = () => U.openDrawer("drawer-new");
    const assign = document.getElementById("btn-assign");
    if (assign) assign.onclick = () => {
      const name = UI.ask("盘点人", "王敏");
      if (!name) return;
      UI.show(F.assignStocktake(selected(), name));
      render();
    };
    const cancel = document.getElementById("btn-cancel");
    if (cancel) cancel.onclick = () => {
      if (!window.confirm("取消所选盘点任务？")) return;
      UI.show(F.cancelStocktake(selected()));
      render();
    };
    const exp = document.getElementById("btn-export");
    if (exp) exp.onclick = () => download("盘点任务.csv", ["盘点任务号", "类型", "差异", "来源单号", "库区", "数量", "盘点人"].join(",") + "\n" + list.map((t) => [t.st_no, t.type, t.diff ? "是" : "否", t.source_no, t.zone, t.qty, t.counter].join(",")).join("\n"));
    const tpl = document.getElementById("btn-tpl");
    if (tpl) tpl.onclick = () => download("盘点导入模板.csv", "盘点类型,盘点方式,库区或SKU,来源单号,备注\n普通盘点,zone,MD,,循环盘\n缺货盘点,sku,yours||FUZ1001||Black||S,PH2606240015,缺货");
    const imp = document.getElementById("btn-import");
    const file = document.getElementById("file-import");
    if (imp && file) {
      imp.onclick = () => file.click();
      file.onchange = () => {
        const f = file.files && file.files[0];
        file.value = "";
        if (!f) return;
        const reader = new FileReader();
        reader.onload = () => {
          const lines = String(reader.result || "").split(/\r?\n/).slice(1).filter((l) => l.trim());
          let n = 0;
          lines.forEach((line) => {
            const [type, method, key, source, remark] = line.split(",");
            const r = F.createStocktake({ type: type || "普通盘点", method: method === "sku" ? "sku" : "zone", zone: method === "sku" ? "" : key, sku: method === "sku" ? key : "", source_no: source || "", remark: remark || "" });
            if (r.ok) n += 1;
          });
          UI.show({ ok: true, message: "已导入 " + n + " 条" });
          render();
        };
        reader.readAsText(f);
      };
    }
  }

  function download(name, text) {
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([text], { type: "text/csv;charset=utf-8" }));
    a.download = name;
    a.click();
  }

  document.getElementById("view-tabs").addEventListener("click", (e) => {
    const btn = e.target.closest("[data-view]");
    if (!btn) return;
    view = btn.getAttribute("data-view");
    phase = view === "audit" ? "auditing" : "count";
    render();
  });
  document.getElementById("status-tabs").addEventListener("click", (e) => {
    const btn = e.target.closest("[data-st]");
    if (!btn) return;
    phase = btn.getAttribute("data-st");
    render();
  });
  document.getElementById("tbody").addEventListener("click", (e) => {
    const btn = e.target.closest("[data-act]");
    if (!btn) return;
    const t = all().find((x) => x.id === btn.getAttribute("data-id"));
    const act = btn.getAttribute("data-act");
    if (act === "detail") {
      document.getElementById("detail-title").textContent = t.st_no;
      document.getElementById("detail-sub").textContent = (t.type || "") + " · " + (PHASE[t.phase] || "");
      document.getElementById("detail-body").innerHTML = `<table class="data"><thead><tr><th>库位</th><th>SKU</th><th>账面</th><th>实盘</th></tr></thead><tbody>
        ${(t.lines || []).map((l) => `<tr><td>${U.escapeHtml(l.location)}</td><td>${U.escapeHtml(l.sku)}</td><td>${l.system_qty}</td><td>${l.count_qty == null ? "-" : l.count_qty}</td></tr>`).join("")}
      </tbody></table>`;
      U.openDrawer("drawer-detail");
    }
    if (act === "log") {
      const logs = (F.get().logs || []).filter((l) => l.doc && l.doc.indexOf(t.st_no) >= 0);
      document.getElementById("detail-title").textContent = "操作日志";
      document.getElementById("detail-sub").textContent = t.st_no;
      document.getElementById("detail-body").innerHTML = logs.length
        ? `<table class="data"><thead><tr><th>时间</th><th>动作</th></tr></thead><tbody>${logs.map((l) => `<tr><td>${U.escapeHtml(l.at)}</td><td>${U.escapeHtml(l.action)}</td></tr>`).join("")}</tbody></table>`
        : "<p>暂无日志</p>";
      U.openDrawer("drawer-detail");
    }
    if (act === "submit") { UI.show(F.submitStocktakeAudit(t.id)); render(); }
    if (act === "none") { UI.show(F.approveStocktake(t.id, "none")); render(); }
    if (act === "recount") { UI.show(F.approveStocktake(t.id, "recount")); render(); }
  });
  document.getElementById("f-method").onchange = () => {
    const sku = document.getElementById("f-method").value === "sku";
    document.getElementById("f-sku-wrap").hidden = !sku;
    document.getElementById("f-zone-wrap").hidden = sku;
  };
  document.getElementById("form-new").onsubmit = (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    const method = fd.get("method");
    UI.show(F.createStocktake({
      type: fd.get("type"), method, zone: fd.get("zone"), sku: fd.get("sku"),
      source_no: fd.get("source_no"), remark: fd.get("remark"),
    }));
    U.closeDrawer("drawer-new");
    view = "task"; phase = "count";
    render();
  };
  document.getElementById("btn-search").onclick = () => {
    q = { no: document.getElementById("q-no").value.trim(), type: document.getElementById("q-type").value, src: document.getElementById("q-src").value.trim(), who: document.getElementById("q-who").value.trim() };
    render();
  };
  document.getElementById("btn-reset").onclick = () => {
    q = { no: "", type: "", src: "", who: "" };
    ["q-no", "q-src", "q-who"].forEach((id) => { document.getElementById(id).value = ""; });
    document.getElementById("q-type").value = "";
    render();
  };
  render();
})();
