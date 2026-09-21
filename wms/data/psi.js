(function () {
  const F = window.WMS_FLOW;
  const U = window.WMS;
  window.WMS_UI.boot("psi-report");
  U.bindDrawerDismiss();

  const q = { date: "2026-09-16", sku: "", zone: "", loc: "" };
  let shown = [];

  function cell(v) { return U.escapeHtml(v == null ? "" : String(v)); }
  function money(n) { return Number(n || 0).toFixed(2); }
  function fillLocs() {
    const zones = {};
    const locs = {};
    F.listInventory().forEach((r) => {
      if (r.zone) zones[r.zone] = 1;
      if (r.location) locs[r.location] = 1;
    });
    (F.get().ledger || []).forEach((l) => {
      if (l.from_zone) zones[l.from_zone] = 1;
      if (l.to_zone) zones[l.to_zone] = 1;
      if (l.from_loc) locs[l.from_loc] = 1;
      if (l.to_loc) locs[l.to_loc] = 1;
    });
    document.getElementById("q-zone").innerHTML = `<option value="">全部</option>` + Object.keys(zones).sort().map((x) => `<option>${cell(x)}</option>`).join("");
    document.getElementById("q-loc").innerHTML = `<option value="">全部</option>` + Object.keys(locs).sort().map((x) => `<option>${cell(x)}</option>`).join("");
  }
  function rows() {
    return F.listPsi(q.date).filter((r) => {
      if (q.sku && String(r.sku).toLowerCase().indexOf(q.sku.toLowerCase()) < 0) return false;
      if (q.zone && r.zone !== q.zone) return false;
      if (q.loc && r.location !== q.loc) return false;
      return true;
    });
  }
  function render() {
    shown = rows();
    document.getElementById("tbody").innerHTML = shown.map((r, i) => `<tr>
      <td><div class="sku-thumb"></div></td>
      <td>${cell(r.sku)}</td><td>${cell(r.zone)}</td><td>${cell(r.location)}</td>
      <td>${r.open_qty}</td><td>${money(r.open_amt)}</td>
      <td>${r.in_qty}</td><td>${money(r.in_amt)}</td>
      <td>${r.out_qty}</td><td>${money(r.out_amt)}</td>
      <td>${r.close_qty}</td><td>${money(r.close_amt)}</td>
      <td class="ops">${window.WMS_UI.linkBtn("明细", `data-i="${i}"`)}</td>
    </tr>`).join("") || `<tr><td colspan="13">没有找到匹配的记录</td></tr>`;
    document.getElementById("meta").textContent = "共 " + shown.length + " 条。本期只统计所选日期当天：入库含 PDA上架、移位上架；出库含 PDA配货、调拨发货、调拨配货。期末按当前仓位库存回推，期初 = 期末 − 入库 + 出库，不为负。";
    document.querySelectorAll("[data-i]").forEach((btn) => {
      btn.onclick = () => openDetail(shown[Number(btn.getAttribute("data-i"))]);
    });
  }
  function openDetail(r) {
    if (!r) return;
    document.getElementById("detail-title").textContent = r.sku;
    document.getElementById("detail-sub").textContent = (r.zone || "—") + " / " + (r.location || "—") + " · " + q.date;
    const lines = r.lines || [];
    document.getElementById("detail-body").innerHTML = lines.length
      ? `<table class="data"><thead><tr><th>操作</th><th>数量</th><th>来源单号</th><th>时间</th></tr></thead><tbody>${
        lines.map((l) => `<tr><td>${cell(l.op)}</td><td>${l.qty}</td><td>${cell(l.source_no)}</td><td>${cell(l.at)}</td></tr>`).join("")
      }</tbody></table>`
      : `<p>这一天没有出入库，数量是按当前仓位回推的结存。</p>`;
    U.openDrawer("drawer-detail");
  }
  function readForm() {
    q.date = document.getElementById("q-date").value;
    q.sku = document.getElementById("q-sku").value.trim();
    q.zone = document.getElementById("q-zone").value;
    q.loc = document.getElementById("q-loc").value;
  }

  document.getElementById("btn-search").onclick = () => { readForm(); render(); };
  document.getElementById("btn-reset").onclick = () => {
    q.date = "2026-09-16";
    q.sku = q.zone = q.loc = "";
    document.getElementById("q-date").value = q.date;
    document.getElementById("q-sku").value = "";
    document.getElementById("q-zone").value = "";
    document.getElementById("q-loc").value = "";
    render();
  };
  document.getElementById("btn-refresh").onclick = () => { fillLocs(); readForm(); render(); };

  fillLocs();
  render();
})();
