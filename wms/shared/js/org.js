/**
 * 组织主数据（仓库 / 站点）— 基础数据与业务流共用
 * 基础数据页可继续在 WMS_MOCK 里增删改；业务页读这里的默认值（含 localStorage 持久化）。
 */
window.WMS_ORG = (function () {
  const KEY = "wms_org_v1";

  const defaults = {
    warehouses: [
      {
        id: 1,
        warehouse_code: "WH-HZ-01",
        warehouse_name: "杭州一号仓",
        province: "浙江省",
        city: "杭州市",
        district: "余杭区",
        address: "仓前街道物流大道 88 号",
        postal_code: "311121",
        contact_name: "王仓管",
        contact_phone: "13800001111",
        remark: "Shopify 多品牌主仓",
        status: 1,
        updated_by: "Admin",
        updated_at: "2026-09-18 10:22:01",
      },
    ],
    sites: [
      { id: 1, site_code: "SF-YOURS", site_name: "yours" },
      { id: 2, site_code: "SF-MILLIE", site_name: "millie" },
      { id: 3, site_code: "SF-ATLAS", site_name: "atlas" },
      { id: 4, site_code: "SF-PETAL", site_name: "petal" },
      { id: 5, site_code: "SF-NOIR", site_name: "noir" },
    ],
  };

  const warehouses = [];
  const sites = [];

  function load() {
    warehouses.length = 0;
    sites.length = 0;
    let saved = null;
    try { saved = JSON.parse(localStorage.getItem(KEY) || "null"); } catch (e) { saved = null; }
    const wh = (saved && saved.warehouses && saved.warehouses.length) ? saved.warehouses : defaults.warehouses;
    const st = (saved && saved.sites && saved.sites.length) ? saved.sites : defaults.sites;
    wh.forEach((w) => warehouses.push(Object.assign({}, w)));
    st.forEach((s) => sites.push(Object.assign({}, s)));
  }

  function persist() {
    try {
      localStorage.setItem(KEY, JSON.stringify({
        warehouses: warehouses.map((w) => Object.assign({}, w)),
        sites: sites.map((s) => Object.assign({}, s)),
      }));
    } catch (e) { /* ignore */ }
  }

  function warehouseName() {
    const active = warehouses.find((w) => Number(w.status) !== 0) || warehouses[0];
    return (active && active.warehouse_name) || "杭州一号仓";
  }

  function siteAt(i) {
    const s = sites[(Number(i) || 0) % sites.length];
    return s ? s.site_name : "yours";
  }

  /** 与基础数据库位编码一致：YOURS-01-01 */
  function locationAt(i) {
    const n = Math.abs(Number(i) || 0);
    const s = sites[n % Math.max(sites.length, 1)] || { site_name: "yours", site_code: "SF-YOURS" };
    const code = String(s.site_code || "").replace(/^SF-/, "") || String(s.site_name || "YOURS").toUpperCase();
    const aisle = String((n % 2) + 1).padStart(2, "0");
    const bin = String((n % 10) + 1).padStart(2, "0");
    return code + "-" + aisle + "-" + bin;
  }

  function zoneAt(i) {
    const n = Math.abs(Number(i) || 0);
    const s = sites[n % Math.max(sites.length, 1)] || { site_name: "yours", site_code: "SF-YOURS" };
    const code = String(s.site_code || "").replace(/^SF-/, "") || String(s.site_name || "YOURS").toUpperCase();
    return "Z-" + code;
  }

  function syncFromMock() {
    if (!window.WMS_MOCK) return;
    const wh = WMS_MOCK.getWarehouses();
    const st = WMS_MOCK.getSites();
    if (wh && wh.length) {
      warehouses.length = 0;
      wh.forEach((w) => warehouses.push(Object.assign({}, w)));
    }
    if (st && st.length) {
      sites.length = 0;
      st.forEach((s) => sites.push(Object.assign({}, s)));
    }
    persist();
  }

  function setWarehouses(list) {
    warehouses.length = 0;
    (list || []).forEach((w) => warehouses.push(Object.assign({}, w)));
    persist();
  }

  function setSites(list) {
    sites.length = 0;
    (list || []).forEach((s) => sites.push(Object.assign({}, s)));
    persist();
  }

  load();

  return {
    getWarehouses: () => warehouses.slice(),
    getSites: () => sites.slice(),
    setWarehouses,
    setSites,
    warehouseName,
    siteAt,
    locationAt,
    zoneAt,
    syncFromMock,
    persist,
  };
})();
