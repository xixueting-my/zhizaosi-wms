(function () {
  const F = window.WMS_FLOW;
  const UI = window.WMS_UI;
  const U = window.WMS;
  const LABELS = {
    wait_wave: "待下发波次",
    waved: "已下发波次",
    check_pending: "待复核",
    checked: "已复核",
    cancelled: "已取消",
  };
  let status = "wait_wave";
  let keyword = "";

  UI.boot("orders");

  function tabs() {
    const all = F.get().orders;
    const items = ["wait_wave", "waved", "check_pending", "checked", "cancelled"];
    document.getElementById("status-tabs").innerHTML = items.map((k) => {
      const n = all.filter((r) => F.orderTabKey(r) === k).length;
      return `<button type="button" class="sub-tab${status === k ? " active" : ""}" data-st="${k}">${LABELS[k]} (${n})</button>`;
    }).join("");
  }

  function render() {
    tabs();
    const q = keyword.toLowerCase();
    const list = F.get().orders.filter((r) => {
      if (F.orderTabKey(r) !== status) return false;
      const blob = `${r.order_no} ${r.customer_order_no} ${r.sku} ${r.site || ""}`.toLowerCase();
      return !q || blob.includes(q);
    });
    document.getElementById("tbody").innerHTML = list.map((r) => {
      const ops = [];
      if (r.status === "check_pending") ops.push(UI.linkBtn("复核", `data-act="check" data-id="${r.id}"`));
      if (r.status === "checked") ops.push(UI.linkBtn("反复核", `data-act="uncheck" data-id="${r.id}"`, true));
      if (status === "wait_wave") ops.push(UI.linkBtn("取消", `data-act="cancel" data-id="${r.id}"`, true));
      if (r.status === "cancelled") ops.push(UI.linkBtn("恢复", `data-act="restore" data-id="${r.id}"`));
      return `<tr>
        <td class="code-link">${U.escapeHtml(r.order_no)}</td>
        <td>${U.escapeHtml(r.customer_order_no)}</td>
        <td class="cell-sku" title="${U.escapeHtml(r.sku)}">${U.escapeHtml(r.sku)}</td>
        <td>${r.qty}</td>
        <td>${U.escapeHtml(r.warehouse)}</td>
        <td>${U.escapeHtml(r.site || "-")}</td>
        <td>${UI.tag(LABELS[F.orderTabKey(r)], r.status === "cancelled")}</td>
        <td>${U.escapeHtml(F.orderProgress(r) || "-")}</td>
        <td class="ops">${ops.join("")}</td>
      </tr>`;
    }).join("") || `<tr><td colspan="9">没有数据</td></tr>`;
    document.getElementById("actions").innerHTML = `
      <button type="button" class="btn btn-primary" id="oms">模拟 OMS 下发</button>
      <button type="button" class="btn" id="reset">重置演示数据</button>
      <span class="toolbar-meta">共 ${list.length} 条 · 仓库 / 站点取自基础数据</span>`;
    document.getElementById("oms").onclick = () => { UI.show(F.omsIssue()); render(); };
    document.getElementById("reset").onclick = () => { UI.show(F.reset()); keyword = ""; render(); };
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
    const act = btn.getAttribute("data-act");
    const map = { check: F.checkOrder, uncheck: F.uncheckOrder, cancel: F.cancelOrder, restore: F.restoreOrder };
    UI.show(map[act](id));
    render();
  });
  document.getElementById("btn-search").onclick = () => { keyword = document.getElementById("q").value.trim(); render(); };
  document.getElementById("btn-reset").onclick = () => { keyword = ""; document.getElementById("q").value = ""; render(); };
  document.getElementById("q").addEventListener("keydown", (e) => { if (e.key === "Enter") document.getElementById("btn-search").click(); });
  render();
})();
