(function () {
  const F = window.WMS_FLOW;
  const UI = window.WMS_UI;
  const U = window.WMS;
  const LABELS = { pending: "待上架", partial: "部分上架", done: "已上架", void: "作废" };
  let status = "";
  let keyword = "";

  UI.boot("putaway");

  function rkOf(sj) { return F.get().inbound.find((r) => r.id === sj.inbound_id); }

  function tabs() {
    const all = F.get().putaway;
    const items = [["", "全部"], ["pending", "待上架"], ["partial", "部分上架"], ["done", "已上架"], ["void", "作废"]];
    document.getElementById("status-tabs").innerHTML = items.map(([k, lab]) => {
      const n = k ? all.filter((r) => r.status === k).length : all.length;
      return `<button type="button" class="sub-tab${status === k ? " active" : ""}" data-st="${k}">${lab} (${n})</button>`;
    }).join("");
  }

  function render() {
    tabs();
    const q = keyword.toLowerCase();
    const list = F.get().putaway.filter((r) => {
      if (status && r.status !== status) return false;
      const rk = rkOf(r);
      const blob = `${r.sj_no} ${rk ? rk.rk_no : ""}`.toLowerCase();
      return !q || blob.includes(q);
    });
    document.getElementById("tbody").innerHTML = list.map((r) => {
      const rk = rkOf(r);
      const ops = [];
      if (r.status !== "void" && r.status !== "done") ops.push(UI.linkBtn("上架", `data-act="up" data-id="${r.id}"`));
      if (r.status !== "void" && r.done_qty > 0) ops.push(UI.linkBtn("撤回上架", `data-act="down" data-id="${r.id}"`, true));
      return `<tr>
        <td class="code-link">${U.escapeHtml(r.sj_no)}</td>
        <td>${U.escapeHtml(rk ? rk.rk_no : "-")}</td>
        <td>${r.plan_qty}</td><td>${r.done_qty}</td>
        <td>${UI.tag(LABELS[r.status], r.status === "void")}</td>
        <td>${U.escapeHtml(r.operator || "-")}</td>
        <td class="ops">${ops.join("")}</td>
      </tr>`;
    }).join("") || `<tr><td colspan="7">没有数据</td></tr>`;
    document.getElementById("actions").innerHTML = `<button type="button" class="btn" id="reset">重置演示数据</button><span class="toolbar-meta">共 ${list.length} 条 · 每张入库单只对应一个 SJ</span>`;
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
    const sj = F.get().putaway.find((r) => r.id === id);
    const act = btn.getAttribute("data-act");
    let result;
    if (act === "up") {
      const rest = sj.plan_qty - sj.done_qty;
      const qty = UI.ask(`上架数量（剩余 ${rest}）`, rest);
      if (qty == null) return;
      result = F.putaway(id, qty);
    }
    if (act === "down") {
      const qty = UI.ask(`撤回数量（已上架 ${sj.done_qty}）`, sj.done_qty);
      if (qty == null) return;
      result = F.unputaway(id, qty);
    }
    UI.show(result);
    render();
  });
  document.getElementById("btn-search").onclick = () => { keyword = document.getElementById("q").value.trim(); render(); };
  document.getElementById("btn-reset").onclick = () => { keyword = ""; document.getElementById("q").value = ""; render(); };
  document.getElementById("q").addEventListener("keydown", (e) => { if (e.key === "Enter") document.getElementById("btn-search").click(); });
  render();
})();
