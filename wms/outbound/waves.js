(function () {
  const F = window.WMS_FLOW;
  const UI = window.WMS_UI;
  const U = window.WMS;
  let keyword = "";
  let picking = false;
  const selected = new Set();
  const openDetail = new Set();

  UI.boot("wave");

  function detail(waveId) {
    const picks = F.get().picks.filter((p) => p.wave_id === waveId);
    const lines = [];
    picks.forEach((p) => {
      p.order_ids.forEach((oid) => {
        const o = F.get().orders.find((x) => x.id === oid);
        if (!o) return;
        lines.push(`<tr><td>${U.escapeHtml(o.order_no)}</td><td>${U.escapeHtml(o.customer_order_no)}</td><td class="cell-sku">${U.escapeHtml(o.sku)}</td><td>${o.qty}</td><td class="code-link">${U.escapeHtml(p.ph_no)}</td></tr>`);
      });
    });
    return `<tr class="wave-detail"><td colspan="6"><table class="data"><thead><tr><th>出库单号</th><th>客户订单号</th><th>SKU</th><th>数量</th><th>配货单号</th></tr></thead><tbody>${lines.join("")}</tbody></table></td></tr>`;
  }

  function render() {
    const q = keyword.toLowerCase();
    const list = F.get().waves.filter((r) => {
      if (r.status === "cancelled") return false;
      return !q || r.wave_no.toLowerCase().includes(q);
    });
    const body = list.map((r) => `
      <tr>
        <td class="code-link">${U.escapeHtml(r.wave_no)}</td>
        <td>${U.escapeHtml(r.warehouse)}</td>
        <td>${U.escapeHtml(r.creator)}</td>
        <td>${U.escapeHtml(r.created_at)}</td>
        <td class="ops">
          ${UI.linkBtn("明细", `data-act="detail" data-id="${r.id}"`)}
          ${UI.linkBtn("取消波次", `data-act="cancel" data-id="${r.id}"`, true)}
        </td>
      </tr>
      ${openDetail.has(r.id) ? detail(r.id) : ""}
    `).join("");

    let picker = "";
    if (picking) {
      const pool = F.get().orders.filter((o) => o.status === "wait_out" && !o.wave_id);
      picker = pool.map((o) => `
        <tr>
          <td><input type="checkbox" class="pick-order" value="${o.id}" ${selected.has(o.id) ? "checked" : ""} /></td>
          <td colspan="4">${U.escapeHtml(o.order_no)} · ${U.escapeHtml(o.sku)} · ×${o.qty} · ${U.escapeHtml(o.warehouse)}</td>
        </tr>`).join("") || `<tr><td colspan="5">没有未入波的待出库单</td></tr>`;
    }
    document.getElementById("tbody").innerHTML = (picker || "") + (body || `<tr><td colspan="5">没有波次</td></tr>`);
    document.getElementById("actions").innerHTML = `
      <button type="button" class="btn btn-primary" id="open-release">${picking ? "确认下发" : "下发波次"}</button>
      ${picking ? `<button type="button" class="btn" id="cancel-pick">取消选择</button>` : ""}
      <button type="button" class="btn" id="reset">重置演示数据</button>
      <span class="toolbar-meta">创建即下发，无状态分段 · 仓库取自基础数据</span>`;
    document.getElementById("open-release").onclick = () => {
      if (!picking) { picking = true; render(); return; }
      const ids = [...document.querySelectorAll(".pick-order:checked")].map((el) => el.value);
      const result = F.releaseWave(ids);
      UI.show(result);
      if (result.ok) { picking = false; selected.clear(); }
      render();
    };
    const cancel = document.getElementById("cancel-pick");
    if (cancel) cancel.onclick = () => { picking = false; selected.clear(); render(); };
    document.getElementById("reset").onclick = () => { UI.show(F.reset()); picking = false; selected.clear(); render(); };
  }

  document.getElementById("tbody").addEventListener("change", (e) => {
    if (!e.target.classList.contains("pick-order")) return;
    if (e.target.checked) selected.add(e.target.value);
    else selected.delete(e.target.value);
  });
  document.getElementById("tbody").addEventListener("click", (e) => {
    const btn = e.target.closest("[data-act]");
    if (!btn) return;
    const id = btn.getAttribute("data-id");
    if (btn.getAttribute("data-act") === "detail") {
      if (openDetail.has(id)) openDetail.delete(id);
      else openDetail.add(id);
      render();
      return;
    }
    UI.show(F.cancelWave(id));
    render();
  });
  document.getElementById("btn-search").onclick = () => { keyword = document.getElementById("q").value.trim(); render(); };
  document.getElementById("btn-reset").onclick = () => { keyword = ""; document.getElementById("q").value = ""; render(); };
  document.getElementById("q").addEventListener("keydown", (e) => { if (e.key === "Enter") document.getElementById("btn-search").click(); });
  render();
})();
