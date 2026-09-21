/**
 * 运行时配置。演示为 mock；设置里改成对接后写入 localStorage，见 docs/plans/2026-09-21-wms-pda-api.md
 */
function wmsStored(key) {
  try { return localStorage.getItem(key) || ""; } catch (e) { return ""; }
}
window.WMS_CONFIG = window.WMS_CONFIG || {
  mode: wmsStored("wms_pda_mode") || "mock",
  apiBaseUrl: wmsStored("wms_pda_api_base") || "",
  tenantHeader: "X-Tenant-Id",
  authHeader: "Authorization",
  warehouseHeader: "X-Warehouse-Id",
  tokenStorageKey: "wms_pda_token",
  tenantStorageKey: "wms_pda_tenant",
  warehouseStorageKey: "wms_pda_warehouse",
  userStorageKey: "wms_pda_user",
};
