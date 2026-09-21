(function () {
  const F = window.WMS_FLOW;
  const UI = window.WMS_UI;
  const U = window.WMS;
  const LABELS = { to_pick: "待配货", to_sort: "待分拣", picked: "已配货", shortage: "缺货", cancelled: "已取消" };
  let status = "to_pick";
  let keyword = "";

  UI.boot("picking");

  function waveNo(id) {
    const w = F.get().waves.find((x) => x.id === id);
    return w ? w.wave_no : "-";
  }

  function tabs() {
    const all = F.get().picks;
    const items = [["to_pick", "待配货"], ["to_sort", "待分拣"], ["picked", "已配货"], ["shortage", "缺货"], ["cancelled", "已取消"]];
    document.getElementById("status-tabs").innerHTML = items.map(([k, lab]) => {
      const n = all.filter((r) => r.status === k).length;
      return `<button type="button" class="sub-tab${status === k ? " active" : ""}" data-st="${k}">${lab} (${n})</button>`;
    }).join("");
  }

  function selectedIds() {
    return [...document.querySelectorAll(".pick-check:checked")].map((el) => el.value);
  }

  function render() {
    tabs();
    const q = keyword.toLowerCase();
    const list = F.get().picks.filter((r) => {
      if (r.status !== status) return false;
      const blob = `${r.ph_no} ${waveNo(r.wave_id)} ${r.sku}`.toLowerCase();
      return !q || blob.includes(q);
    });
    const canAssign = status === "to_pick" || status === "to_sort";
    document.getElementById("tbody").innerHTML = list.map((r) => `
      <tr>
        <td>${canAssign ? `<input type="checkbox" class="pick-check" value="${r.id}" />` : ""}</td>
        <td class="code-link">${U.escapeHtml(r.ph_no)}</td>
        <td>${U.escapeHtml(waveNo(r.wave_id))}</td>
        <td>${U.escapeHtml(r.type)}</td>
        <td class="cell-sku" title="${U.escapeHtml(r.sku)}">${U.escapeHtml(r.sku)}</td>
        <td>${r.qty}</td>
        <td>${U.escapeHtml(r.warehouse)}</td>
        <td>${UI.tag(LABELS[r.status], r.status === "cancelled" || r.status === "shortage")}</td>
        <td>${U.escapeHtml(r.picker || "-")}</td>
        <td class="ops">${UI.linkBtn("备注", `data-act="note" data-id="${r.id}"`)}</td>
      </tr>
    `).join("") || `<tr><td colspan="10">没有数据</td></tr>`;
    document.getElementById("actions").innerHTML = `
      ${canAssign ? `<button type="button" class="btn btn-primary" id="assign">分配配货员</button>` : ""}
      <button type="button" class="btn" id="reset">重置演示数据</button>
      <span class="toolbar-meta">共 ${list.length} 条 · 拣货 / 缺货由 PDA 回写</span>`;
    const assignBtn = document.getElementById("assign");
    if (assignBtn) {
      assignBtn.onclick = () => {
        const ids = selectedIds();
        if (!ids.length) return U.toast("请先勾选配货单", "err");
        const name = UI.ask("配货员", "王敏");
        if (name == null) return;
        UI.show(F.assignPickers(ids, name));
        render();
      };
    }
    document.getElementById("reset").onclick = () => { UI.show(F.reset()); render(); };
  }

  document.getElementById("status-tabs").addEventListener("click", (e) => {
    const btn = e.target.closest("[data-st]");
    if (!btn) return;
    status = btn.getAttribute("data-st");
    render();
  });
  document.getElementById("tbody").addEventListener("click", (e) => {
    const btn = e.target.closest("[data-act=note]");
    if (!btn) return;
    U.toast("备注功能占位", "info");
  });
  document.getElementById("btn-search").onclick = () => { keyword = document.getElementById("q").value.trim(); render(); };
  document.getElementById("btn-reset").onclick = () => { keyword = ""; document.getElementById("q").value = ""; render(); };
  document.getElementById("q").addEventListener("keydown", (e) => { if (e.key === "Enter") document.getElementById("btn-search").click(); });
  render();
})();
