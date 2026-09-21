(function () {
  const F = window.WMS_FLOW;
  const U = window.WMS;
  const HIST = "wms_inv_exports";
  window.WMS_UI.boot("inventory-query");
  U.bindDrawerDismiss();

  const q = { sku: "", skc: "", spu: "", wh: "", zone: "", loc: "", qty: "", empty: "" };

  function cell(v) { return U.escapeHtml(v == null ? "" : String(v)); }
  function money4(n) { return Number(n || 0).toFixed(4); }
  function includes(hay, needle) {
    if (!needle) return true;
    return String(hay || "").toLowerCase().indexOf(needle.toLowerCase()) >= 0;
  }
  function fillWarehouses() {
    const sel = document.getElementById("q-wh");
    const cur = sel.value;
    const list = (window.WMS_ORG && WMS_ORG.getWarehouses()) || [];
    sel.innerHTML = `<option value="">全部</option>` + list.map((w) => {
      const name = w.warehouse_name || w.name || "";
      return `<option value="${cell(name)}">${cell(name)}</option>`;
    }).join("");
    if (cur) sel.value = cur;
  }
  function fillLocs() {
    const zones = {};
    const locs = {};
    F.listInventory().forEach((r) => {
      if (r.zone) zones[r.zone] = 1;
      if (r.location) locs[r.location] = 1;
    });
    const z = document.getElementById("q-zone");
    const l = document.getElementById("q-loc");
    z.innerHTML = `<option value="">全部</option>` + Object.keys(zones).sort().map((x) => `<option>${cell(x)}</option>`).join("");
    l.innerHTML = `<option value="">全部</option>` + Object.keys(locs).sort().map((x) => `<option>${cell(x)}</option>`).join("");
  }
  function rows() {
    let list = F.listInventory();
    if (q.empty === "1") list = list.concat(F.listEmptySkus());
    return list.filter((r) => {
      if (!includes(r.sku, q.sku) || !includes(r.skc, q.skc) || !includes(r.spu, q.spu)) return false;
      if (q.wh && r.warehouse !== q.wh) return false;
      if (q.zone && r.zone !== q.zone) return false;
      if (q.loc && r.location !== q.loc) return false;
      if (q.qty && !(Number(r[q.qty]) > 0)) return false;
      return true;
    });
  }
  function render() {
    const list = rows();
    document.getElementById("tbody").innerHTML = list.map((r) => `<tr>
      <td>${cell(r.sku)}</td><td>${cell(r.skc)}</td><td>${cell(r.spu)}</td>
      <td><div class="sku-thumb"></div></td>
      <td>${r.total}</td><td>${r.wait_putaway}</td><td>${r.bin_qty}</td><td>${r.reserved}</td><td>${r.wait_ship}</td>
      <td>${cell(r.warehouse)}</td><td>${cell(r.zone)}</td><td>${cell(r.location)}</td><td>${money4(r.cost)}</td>
    </tr>`).join("") || `<tr><td colspan="13">没有找到匹配的记录</td></tr>`;
    document.getElementById("meta").textContent = "共 " + list.length + " 条。数量来自唯一码：待上架=质检合格，仓位=已上架，预占=已配货，待发货=已复核。成本价是按 SKU 固定的演示单价。";
  }
  function readForm() {
    q.sku = document.getElementById("q-sku").value.trim();
    q.skc = document.getElementById("q-skc").value.trim();
    q.spu = document.getElementById("q-spu").value.trim();
    q.wh = document.getElementById("q-wh").value;
    q.zone = document.getElementById("q-zone").value;
    q.loc = document.getElementById("q-loc").value;
    q.qty = document.getElementById("q-qty").value;
    q.empty = document.getElementById("q-empty").value;
  }
  function csvEscape(v) {
    const s = v == null ? "" : String(v);
    return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
  }
  function history() {
    try { return JSON.parse(sessionStorage.getItem(HIST) || "[]"); } catch (e) { return []; }
  }
  function remember(name, n) {
    const list = history();
    list.unshift({ name, at: new Date().toISOString().slice(0, 19).replace("T", " "), rows: n });
    sessionStorage.setItem(HIST, JSON.stringify(list.slice(0, 20)));
  }

  document.getElementById("btn-search").onclick = () => { readForm(); render(); };
  document.getElementById("btn-reset").onclick = () => {
    ["q-sku", "q-skc", "q-spu"].forEach((id) => { document.getElementById(id).value = ""; });
    ["q-wh", "q-zone", "q-loc", "q-qty", "q-empty"].forEach((id) => { document.getElementById(id).value = ""; });
    q.sku = q.skc = q.spu = q.wh = q.zone = q.loc = q.qty = q.empty = "";
    render();
  };
  document.getElementById("btn-refresh").onclick = () => { fillWarehouses(); fillLocs(); render(); };
  document.getElementById("btn-import").onclick = () => document.getElementById("file-import").click();
  document.getElementById("file-import").onchange = (e) => {
    const file = e.target.files && e.target.files[0];
    e.target.value = "";
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const lines = String(reader.result || "").split(/\r?\n/).filter((x) => x.trim());
      const n = Math.max(0, lines.length - 1);
      U.toast("已读取 " + n + " 行。库存以唯一码为准，导入不改仓位数量。", "ok");
    };
    reader.readAsText(file);
  };
  document.getElementById("btn-export").onclick = () => {
    const list = rows();
    const head = ["sku", "skc", "spu", "总数量", "待上架数量", "仓位库存数量", "预占数量", "待发货数量", "仓库", "库区", "库位", "成本价"];
    const body = list.map((r) => [r.sku, r.skc, r.spu, r.total, r.wait_putaway, r.bin_qty, r.reserved, r.wait_ship, r.warehouse, r.zone, r.location, money4(r.cost)]);
    const name = "库存明细.csv";
    const text = "\uFEFF" + [head].concat(body).map((row) => row.map(csvEscape).join(",")).join("\n");
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([text], { type: "text/csv;charset=utf-8" }));
    a.download = name;
    a.click();
    remember(name, list.length);
    U.toast("已导出 " + list.length + " 行", "ok");
  };
  document.getElementById("btn-hist").onclick = () => {
    const list = history();
    document.getElementById("hist-body").innerHTML = list.length
      ? `<table class="data"><thead><tr><th>文件</th><th>行数</th><th>时间</th></tr></thead><tbody>${
        list.map((h) => `<tr><td>${cell(h.name)}</td><td>${h.rows}</td><td>${cell(h.at)}</td></tr>`).join("")
      }</tbody></table>`
      : `<p class="empty">还没有导出记录</p>`;
    U.openDrawer("drawer-hist");
  };

  fillWarehouses();
  fillLocs();
  render();
})();
