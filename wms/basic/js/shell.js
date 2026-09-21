/**
 * WMS 统一壳层：浅色可折叠侧栏
 * 图标：细线描边风格（参考领星作业台密度与几何清晰度）
 */
window.WMS_SHELL = (function () {
  const stroke = 'fill="none" stroke="currentColor" stroke-width="1.25" stroke-linecap="round" stroke-linejoin="round"';

  const ICONS = {
    gear: `<svg class="nav-ico" viewBox="0 0 16 16" ${stroke}><circle cx="8" cy="8" r="2"/><path d="M8 1.75v1.5M8 12.75v1.5M1.75 8h1.5M12.75 8h1.5M3.2 3.2l1.1 1.1M11.7 11.7l1.1 1.1M12.8 3.2l-1.1 1.1M4.3 11.7l-1.1 1.1"/></svg>`,
    inbound: `<svg class="nav-ico" viewBox="0 0 16 16" ${stroke}><path d="M2.5 8h8.5"/><path d="M8.5 4.75 11.75 8 8.5 11.25"/><path d="M13.25 3.25v9.5"/></svg>`,
    outbound: `<svg class="nav-ico" viewBox="0 0 16 16" ${stroke}><path d="M13.5 8H5"/><path d="M7.5 4.75 4.25 8 7.5 11.25"/><path d="M2.75 3.25v9.5"/></svg>`,
    stock: `<svg class="nav-ico" viewBox="0 0 16 16" ${stroke}><path d="M2.75 5.5 8 2.75l5.25 2.75v5L8 13.25 2.75 10.5z"/><path d="M2.75 5.5 8 8.25l5.25-2.75M8 8.25v5"/></svg>`,
    chart: `<svg class="nav-ico" viewBox="0 0 16 16" ${stroke}><path d="M2.5 13h11"/><path d="M4.25 13V8.5M8 13V4.5M11.75 13V7"/></svg>`,
    chevron: `<svg class="nav-chevron" viewBox="0 0 12 12" ${stroke}><path d="M2.75 4.5 6 7.75 9.25 4.5"/></svg>`,
  };

  /** 用户定义的 WMS 目录（勿擅自增删改名） */
  const MENU = [
    {
      key: "basic",
      label: "基础数据管理",
      icon: "gear",
      children: [
        { key: "warehouse", label: "仓库管理", href: "basic/warehouse.html" },
        { key: "params", label: "参数配置", href: "basic/params.html" },
        { key: "strategy", label: "策略配置", href: "basic/strategy.html" },
      ],
    },
    {
      key: "inbound",
      label: "入库管理",
      icon: "inbound",
      children: [
        { key: "receipt", label: "收货单管理", href: "inbound/receiving.html" },
        { key: "inbound-order", label: "入库单管理", href: "inbound/inbound.html" },
        { key: "putaway", label: "上架任务", href: "inbound/putaway.html" },
      ],
    },
    {
      key: "outbound",
      label: "出库管理",
      icon: "outbound",
      children: [
        { key: "orders", label: "订单列表", href: "outbound/orders.html" },
        { key: "wave", label: "波次单管理", href: "outbound/waves.html" },
        { key: "picking", label: "配货单", href: "outbound/picks.html" },
      ],
    },
    {
      key: "internal",
      label: "库内管理",
      icon: "stock",
      children: [
        { key: "stocktake", label: "库存盘点", href: "internal/stocktake.html" },
        { key: "transfer", label: "商品移位", href: "internal/transfer.html" },
        { key: "oplog", label: "操作记录", href: "internal/oplog.html" },
      ],
    },
    {
      key: "data",
      label: "数据中心",
      icon: "chart",
      children: [
        { key: "inventory-query", label: "库存明细查询", href: "data/inventory.html" },
        { key: "psi-report", label: "进销存", href: "data/psi.html" },
      ],
    },
  ];

  function wmsBase() {
    const el = [...document.scripts].reverse().find((s) => (s.src || "").includes("shell.js"));
    if (!el) return "";
    return el.src.replace(/basic\/js\/shell\.js(?:\?.*)?$/, "");
  }

  function renderSidebar(activeKey) {
    const base = wmsBase();
    const groups = MENU.map((g) => {
      const hasActive = g.children.some((c) => c.key === activeKey);
      const openClass = hasActive ? "open has-active" : "open";
      const children = g.children.map((c) => {
        const cls = [
          "nav-item",
          c.key === activeKey ? "active" : "",
          c.disabled ? "disabled" : "",
        ].filter(Boolean).join(" ");
        const href = c.disabled || c.href === "#" ? "#" : base + c.href;
        return `<a class="${cls}" data-nav="${c.key}" href="${href}">${c.label}</a>`;
      }).join("");

      return `
        <div class="nav-group ${openClass}" data-group="${g.key}">
          <button type="button" class="nav-group-head" data-group-toggle="${g.key}">
            ${ICONS[g.icon] || ""}
            <span class="nav-label">${g.label}</span>
            ${ICONS.chevron}
          </button>
          <div class="nav-sub">${children}</div>
        </div>
      `;
    }).join("");

    return `
      <aside class="sidebar" id="app-sidebar">
        <div class="sidebar-brand">WMS<small>仓储</small></div>
        <div class="sidebar-scroll">${groups}</div>
      </aside>
    `;
  }

  function mount(activeKey) {
    const app = document.querySelector(".app");
    if (!app) return;
    const old = document.getElementById("app-sidebar");
    if (old) old.remove();
    app.insertAdjacentHTML("afterbegin", renderSidebar(activeKey));

    document.querySelectorAll("[data-group-toggle]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const group = btn.closest(".nav-group");
        if (!group) return;
        group.classList.toggle("open");
      });
    });
  }

  return { MENU, mount, ICONS };
})();
