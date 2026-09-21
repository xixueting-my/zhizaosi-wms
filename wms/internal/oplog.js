(function () {
  const F = window.WMS_FLOW;
  const U = window.WMS;
  UI_boot();
  let sku = "";
  let op = "";
  let no = "";

  function UI_boot() { window.WMS_UI.boot("oplog"); }

  function rows() {
    return (F.get().ledger || []).filter((r) => {
      if (sku && String(r.sku).toLowerCase().indexOf(sku.toLowerCase()) < 0) return false;
      if (op && r.op !== op) return false;
      if (no && String(r.source_no).indexOf(no) < 0) return false;
      return true;
    });
  }
  function cell(v) { return U.escapeHtml(v || ""); }
  function render() {
    const list = rows();
    document.getElementById("tbody").innerHTML = list.map((r) => `<tr>
      <td>${cell(r.sku)}</td><td>${cell(r.skc)}</td><td>${cell(r.spu)}</td><td>${r.qty}</td><td>${cell(r.warehouse)}</td>
      <td>${cell(r.from_zone)}</td><td>${cell(r.from_loc)}</td><td>${cell(r.to_zone)}</td><td>${cell(r.to_loc)}</td>
      <td>${cell(r.op)}</td><td>${cell(r.source_no)}</td><td>${cell(r.at)}</td>
    </tr>`).join("") || `<tr><td colspan="12">没有数据</td></tr>`;
    document.getElementById("actions").innerHTML = `<span class="toolbar-meta">共 ${list.length} 条。PDA 上架、配货和移位上架会追加到这里。</span>`;
  }
  document.getElementById("btn-search").onclick = () => {
    sku = document.getElementById("q-sku").value.trim();
    op = document.getElementById("q-op").value;
    no = document.getElementById("q-no").value.trim();
    render();
  };
  document.getElementById("btn-reset").onclick = () => {
    sku = ""; op = ""; no = "";
    document.getElementById("q-sku").value = "";
    document.getElementById("q-op").value = "";
    document.getElementById("q-no").value = "";
    render();
  };
  render();
})();
