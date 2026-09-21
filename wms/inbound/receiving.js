(function () {
  const F = window.WMS_FLOW;
  const UI = window.WMS_UI;
  const U = window.WMS;
  const LABELS = { pending: "待收货", partial: "部分收货", received: "全部收货", void: "作废" };
  let status = "";
  let keyword = "";

  UI.boot("receipt");

  function tabs() {
    const all = F.get().receiving;
    const items = [
      ["", "全部"],
      ["pending", "待收货"],
      ["partial", "部分收货"],
      ["received", "全部收货"],
    ];
    document.getElementById("status-tabs").innerHTML = items.map(([k, lab]) => {
      const n = k ? all.filter((r) => r.status === k).length : all.length;
      return `<button type="button" class="sub-tab${status === k ? " active" : ""}" data-st="${k}">${lab} (${n})</button>`;
    }).join("");
  }

  function rows() {
    const q = keyword.toLowerCase();
    return F.get().receiving.filter((r) => {
      if (r.status === "void") return false;
      if (status && r.status !== status) return false;
      const blob = `${r.so_no} ${r.po_no} ${r.sku} ${r.factory || ""}`.toLowerCase();
      return !q || blob.includes(q);
    });
  }

  function ops(r) {
    if (r.status === "received") return `<td class="ops"></td>`;
    if (!r.arrived_at) return `<td class="ops"><span class="toolbar-meta">待 PDA 到货</span></td>`;
    return `<td class="ops">${UI.linkBtn("收货", `data-act="receive" data-id="${r.id}"`)}</td>`;
  }

  function render() {
    tabs();
    const list = rows();
    document.getElementById("tbody").innerHTML = list.map((r) => `
      <tr>
        <td class="code-link">${U.escapeHtml(r.so_no)}</td>
        <td>${U.escapeHtml(r.po_no)}</td>
        <td>${U.escapeHtml(r.factory)}</td>
        <td class="cell-sku" title="${U.escapeHtml(r.sku)}">${U.escapeHtml(r.sku)}</td>
        <td>${r.ship_qty}</td>
        <td>${r.received_qty}</td>
        <td>${UI.tag(LABELS[r.status])}</td>
        <td>${U.escapeHtml(r.arrived_at || "-")}</td>
        ${ops(r)}
      </tr>
    `).join("") || `<tr><td colspan="9">没有数据</td></tr>`;
    document.getElementById("actions").innerHTML = `
      <button type="button" class="btn btn-primary" id="mes">模拟 MES 发货</button>
      <button type="button" class="btn" id="reset">重置演示数据</button>
      <span class="toolbar-meta">共 ${list.length} 条 · 到货在 PDA 完成</span>`;
    document.getElementById("mes").onclick = () => { UI.show(F.mesShip()); render(); };
    document.getElementById("reset").onclick = () => { UI.show(F.reset()); status = ""; keyword = ""; document.getElementById("q").value = ""; render(); };
  }

  document.getElementById("status-tabs").addEventListener("click", (e) => {
    const btn = e.target.closest("[data-st]");
    if (!btn) return;
    status = btn.getAttribute("data-st");
    render();
  });
  document.getElementById("tbody").addEventListener("click", (e) => {
    const btn = e.target.closest("[data-act]");
    if (!btn) return;
    const id = btn.getAttribute("data-id");
    const so = F.get().receiving.find((r) => r.id === id);
    if (btn.getAttribute("data-act") !== "receive" || !so) return;
    const rest = so.ship_qty - so.received_qty;
    const qty = UI.ask(`收货数量（剩余 ${rest}）`, rest);
    if (qty == null) return;
    let reason = "";
    if (Number(qty) + so.received_qty < so.ship_qty) {
      reason = UI.ask("部分收货原因", "尾数未到");
      if (reason == null) return;
    }
    UI.show(F.receive(id, qty, reason));
    render();
  });
  document.getElementById("btn-search").onclick = () => { keyword = document.getElementById("q").value.trim(); render(); };
  document.getElementById("btn-reset").onclick = () => { keyword = ""; document.getElementById("q").value = ""; render(); };
  document.getElementById("q").addEventListener("keydown", (e) => { if (e.key === "Enter") document.getElementById("btn-search").click(); });
  render();
})();
