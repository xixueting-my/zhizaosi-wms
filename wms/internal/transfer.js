(function () {
  const F = window.WMS_FLOW;
  const UI = window.WMS_UI;
  const U = window.WMS;
  let tab = "wait";
  let qn = "";
  let qw = "";
  let detailId = "";
  let detailTab = "off";

  UI.boot("transfer");
  U.bindDrawerDismiss();

  function list() {
    return (F.get().moves || []).filter((m) => {
      const wait = m.status !== "done";
      if (tab === "wait" ? !wait : wait) return false;
      if (qn && String(m.mv_no).indexOf(qn) < 0) return false;
      if (qw && String(m.creator || "").indexOf(qw) < 0) return false;
      return true;
    });
  }

  function render() {
    const all = F.get().moves || [];
    const waitN = all.filter((m) => m.status !== "done").length;
    const doneN = all.length - waitN;
    document.getElementById("status-tabs").innerHTML = [
      ["wait", "待上架 (" + waitN + ")"],
      ["done", "已完成 (" + doneN + ")"],
    ].map(([k, lab]) => `<button type="button" class="sub-tab${tab === k ? " active" : ""}" data-st="${k}">${lab}</button>`).join("");
    const rows = list();
    document.getElementById("tbody").innerHTML = rows.map((m) => `<tr>
      <td><button type="button" class="btn-link" data-act="detail" data-id="${m.id}">${U.escapeHtml(m.mv_no)}</button></td>
      <td>${m.qty || (m.lines || []).length}</td>
      <td>${U.escapeHtml(m.creator || "-")}</td>
      <td>${U.escapeHtml(m.created_at || "-")}</td>
      <td>${U.escapeHtml(m.done_at || "-")}</td>
      <td class="ops">${UI.linkBtn("操作日志", `data-act="log" data-id="${m.id}"`)}</td>
    </tr>`).join("") || `<tr><td colspan="6">没有数据</td></tr>`;
    document.getElementById("actions").innerHTML = `<span class="toolbar-meta">共 ${rows.length} 条。下架在 PDA 移位岗完成，此处查看待上架与已完成。</span>`;
  }

  function openDetail(id) {
    detailId = id;
    const m = (F.get().moves || []).find((x) => x.id === id);
    if (!m) return;
    document.getElementById("detail-title").textContent = "移位明细 " + m.mv_no;
    const tabs = [["off", "移位下架明细"], ["on", "移位上架明细"]];
    document.getElementById("detail-tabs").innerHTML = tabs.map(([k, lab]) => `<button type="button" class="sub-tab${detailTab === k ? " active" : ""}" data-dt="${k}">${lab}</button>`).join("");
    const loc = detailTab === "off" ? "from" : "to";
    const head = detailTab === "off" ? "下架库位" : "上架库位";
    document.getElementById("detail-body").innerHTML = `<table class="data"><thead><tr><th>sku</th><th>唯一码</th><th>${head}</th></tr></thead><tbody>
      ${(m.lines || []).map((l) => `<tr><td>${U.escapeHtml(l.sku)}</td><td>${U.escapeHtml(l.uc)}</td><td>${U.escapeHtml(l[loc] || "-")}</td></tr>`).join("") || `<tr><td colspan="3">无</td></tr>`}
    </tbody></table>`;
    U.openDrawer("drawer-detail");
  }

  document.getElementById("status-tabs").addEventListener("click", (e) => {
    const btn = e.target.closest("[data-st]");
    if (!btn) return;
    tab = btn.getAttribute("data-st");
    render();
  });
  document.getElementById("detail-tabs").addEventListener("click", (e) => {
    const btn = e.target.closest("[data-dt]");
    if (!btn) return;
    detailTab = btn.getAttribute("data-dt");
    openDetail(detailId);
  });
  document.getElementById("tbody").addEventListener("click", (e) => {
    const btn = e.target.closest("[data-act]");
    if (!btn) return;
    const m = (F.get().moves || []).find((x) => x.id === btn.getAttribute("data-id"));
    if (btn.getAttribute("data-act") === "detail") { detailTab = "off"; openDetail(m.id); return; }
    const logs = (F.get().logs || []).filter((l) => l.doc === m.mv_no);
    document.getElementById("detail-title").textContent = "操作日志";
    document.getElementById("detail-tabs").innerHTML = "";
    document.getElementById("detail-body").innerHTML = logs.length
      ? `<table class="data"><thead><tr><th>时间</th><th>动作</th></tr></thead><tbody>${logs.map((l) => `<tr><td>${U.escapeHtml(l.at)}</td><td>${U.escapeHtml(l.action)}</td></tr>`).join("")}</tbody></table>`
      : "<p>暂无日志</p>";
    U.openDrawer("drawer-detail");
  });
  document.getElementById("btn-search").onclick = () => { qn = document.getElementById("q-no").value.trim(); qw = document.getElementById("q-who").value.trim(); render(); };
  document.getElementById("btn-reset").onclick = () => { qn = ""; qw = ""; document.getElementById("q-no").value = ""; document.getElementById("q-who").value = ""; render(); };
  render();
})();
