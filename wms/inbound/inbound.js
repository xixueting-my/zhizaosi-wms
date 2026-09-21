(function () {
  const F = window.WMS_FLOW;
  const UI = window.WMS_UI;
  const U = window.WMS;
  const LABELS = {
    qc_pending: "待质检", qc_doing: "质检中", qc_done: "质检完成", inbound_done: "已入库", void: "作废",
  };
  let status = "";
  let keyword = "";

  UI.boot("inbound-order");

  function soOf(rk) { return F.get().receiving.find((s) => s.id === rk.so_id); }

  function tabs() {
    const all = F.get().inbound;
    const items = [["", "全部"], ["qc_pending", "待质检"], ["qc_doing", "质检中"], ["qc_done", "质检完成"], ["inbound_done", "已入库"], ["void", "作废"]];
    document.getElementById("status-tabs").innerHTML = items.map(([k, lab]) => {
      const n = k ? all.filter((r) => r.status === k).length : all.length;
      return `<button type="button" class="sub-tab${status === k ? " active" : ""}" data-st="${k}">${lab} (${n})</button>`;
    }).join("");
  }

  function render() {
    tabs();
    const q = keyword.toLowerCase();
    const list = F.get().inbound.filter((r) => {
      if (status && r.status !== status) return false;
      const so = soOf(r);
      const blob = `${r.rk_no} ${so ? so.so_no : ""}`.toLowerCase();
      return !q || blob.includes(q);
    });
    document.getElementById("tbody").innerHTML = list.map((r) => {
      const so = soOf(r);
      const ops = [];
      if (r.status !== "void") {
        if (r.status === "qc_pending" || r.status === "inbound_done") ops.push(UI.linkBtn(r.status === "inbound_done" ? "补质检" : "开始质检", `data-act="start" data-id="${r.id}"`));
        if (r.status === "qc_doing") ops.push(UI.linkBtn("提交质检", `data-act="submit" data-id="${r.id}"`));
        if (r.status === "qc_doing" || r.status === "qc_done") ops.push(UI.linkBtn("质检回退", `data-act="revert" data-id="${r.id}"`, true));
        if (r.status === "qc_done" || r.status === "inbound_done") ops.push(UI.linkBtn("确认入库", `data-act="confirm" data-id="${r.id}"`));
        if (r.status === "inbound_done") ops.push(UI.linkBtn("取消确认", `data-act="unconfirm" data-id="${r.id}"`, true));
      }
      return `<tr>
        <td class="code-link">${U.escapeHtml(r.rk_no)}</td>
        <td>${U.escapeHtml(so ? so.so_no : "-")}</td>
        <td>${so ? so.received_qty : "-"}</td>
        <td>${r.qc_pass}</td><td>${r.qc_fail}</td><td>${r.qc_repair}</td>
        <td>${UI.tag(LABELS[r.status], r.status === "void")}</td>
        <td class="ops">${ops.join("")}</td>
      </tr>`;
    }).join("") || `<tr><td colspan="8">没有数据</td></tr>`;
    document.getElementById("actions").innerHTML = `<button type="button" class="btn" id="reset">重置演示数据</button><span class="toolbar-meta">共 ${list.length} 条 · 边收边检：部分收货即可质检</span>`;
    document.getElementById("reset").onclick = () => { UI.show(F.reset()); status = ""; keyword = ""; render(); };
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
    const rk = F.get().inbound.find((r) => r.id === id);
    const so = soOf(rk);
    let result;
    if (act === "start") result = F.startQc(id);
    if (act === "submit") {
      const cap = so.received_qty;
      const passQty = UI.ask(`合格数（实收 ${cap}）`, Math.max(0, cap - rk.qc_fail - rk.qc_repair));
      if (passQty == null) return;
      const failQty = UI.ask("不合格数", rk.qc_fail || 0);
      if (failQty == null) return;
      const repairQty = UI.ask("维修数", rk.qc_repair || 0);
      if (repairQty == null) return;
      result = F.submitQc(id, passQty, failQty, repairQty);
    }
    if (act === "revert") result = F.revertQc(id);
    if (act === "confirm") result = F.confirmInbound(id);
    if (act === "unconfirm") result = F.unconfirmInbound(id);
    UI.show(result);
    render();
  });
  document.getElementById("btn-search").onclick = () => { keyword = document.getElementById("q").value.trim(); render(); };
  document.getElementById("btn-reset").onclick = () => { keyword = ""; document.getElementById("q").value = ""; render(); };
  document.getElementById("q").addEventListener("keydown", (e) => { if (e.key === "Enter") document.getElementById("btn-search").click(); });
  render();
})();
