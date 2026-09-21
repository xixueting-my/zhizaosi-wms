/**
 * WMS Basic — Mock 数据与枚举
 * 后续用真实枚举替换 ENUMS 即可，页面逻辑尽量只读这里。
 */
window.WMS_MOCK = (function () {
  const now = () => {
    const d = new Date();
    const p = (n) => String(n).padStart(2, "0");
    return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`;
  };

  const ENUMS = {
    zoneTypes: [
      { value: "NORMAL", label: "普通库区" },
      { value: "COLD", label: "冷藏库区" },
      { value: "HAZMAT", label: "危险品库区" },
      { value: "RETURN", label: "退货库区" },
    ],
    emptyFlags: [
      { value: "", label: "全部" },
      { value: "1", label: "是" },
      { value: "0", label: "否" },
    ],
    status: [
      { value: 1, label: "启用" },
      { value: 0, label: "停用" },
    ],
    locationStatus: [
      { value: 1, label: "正常" },
      { value: 0, label: "停用" },
    ],
    approvers: [
      { value: "u1", label: "陆舟" },
      { value: "u2", label: "蒋兵" },
      { value: "u3", label: "许建伟" },
      { value: "u4", label: "张荷虎" },
      { value: "u5", label: "何宇麟" },
    ],
    regions: {
      浙江省: {
        杭州市: ["西湖区", "滨江区", "余杭区"],
        宁波市: ["海曙区", "鄞州区"],
      },
      广东省: {
        广州市: ["天河区", "番禺区"],
        深圳市: ["南山区", "宝安区"],
      },
      上海市: {
        上海市: ["浦东新区", "静安区", "徐汇区"],
      },
    },
  };

  const shops = [
    ["YOURS", "yours"],
    ["MILLIE", "millie"],
    ["ATLAS", "atlas"],
    ["PETAL", "petal"],
    ["NOIR", "noir"],
  ];

  const sites = (window.WMS_ORG ? WMS_ORG.getSites() : shops.map((s, i) => ({
    id: i + 1, site_code: "SF-" + s[0], site_name: s[1],
  }))).map((s) => Object.assign({}, s));

  let warehouses = (window.WMS_ORG ? WMS_ORG.getWarehouses() : [{
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
  }]).map((w) => Object.assign({}, w));

  let zones = shops.map((s, i) => ({
    id: i + 1,
    zone_code: "Z-" + s[0],
    zone_name: s[1],
    warehouse_id: 1,
    site_id: i + 1,
    zone_type: "NORMAL",
    updated_by: "Admin",
    updated_at: "2026-09-18 11:00:00",
  }));

  let locations = [];
  shops.forEach((s, zi) => {
    for (let n = 1; n <= 20; n++) {
      const aisle = n <= 10 ? "01" : "02";
      const bin = String(((n - 1) % 10) + 1).padStart(2, "0");
      locations.push({
        id: zi * 20 + n,
        location_code: s[0] + "-" + aisle + "-" + bin,
        zone_id: zi + 1,
        pick_priority: Number((1 + (n - 1) * 0.1).toFixed(2)),
        sku_qty_limit: 0,
        is_empty: n === 1 ? 0 : 1,
        status: n === 20 && zi === 4 ? 0 : 1,
        updated_by: "Admin",
        updated_at: "2026-09-18 12:00:00",
      });
    }
  });

  let approvalFlows = [
    {
      id: 1,
      flow_name: "盘点审批",
      flow_code: "AF_STOCKTAKE",
      nodes: ["u1", "u2", "u3", "", "", ""],
      updated_by: "Admin",
      updated_at: "2026-07-28 10:44:28",
    },
    {
      id: 2,
      flow_name: "补扣款审批",
      flow_code: "AF_ADJUST",
      nodes: ["u4", "", "", "", "", ""],
      node_summary: "共1条金额规则",
      updated_by: "Admin",
      updated_at: "2026-07-28 10:44:28",
    },
  ];

  let partialReasons = [
    { id: 1, reason_desc: "工厂少发", status: 1, updated_by: "Admin", updated_at: "2026-08-01 09:00:00" },
    { id: 2, reason_desc: "物流破损剔除", status: 1, updated_by: "何宇麟", updated_at: "2026-08-12 14:20:00" },
    { id: 3, reason_desc: "质检抽检暂扣", status: 0, updated_by: "张荷虎", updated_at: "2026-08-20 11:11:11" },
  ];

  let qcReasons = [
    { id: 1, category_l1: "外观", category_l2: "破损、脏污", category_l3: "破损、污迹", updated_by: "Admin", updated_at: "2026-08-05 10:00:00" },
    { id: 2, category_l1: "外观", category_l2: "色差", category_l3: "严重色差", updated_by: "Admin", updated_at: "2026-08-05 10:05:00" },
    { id: 3, category_l1: "功能", category_l2: "配件缺失", category_l3: "说明书缺失", updated_by: "何宇麟", updated_at: "2026-08-08 15:30:00" },
  ];

  let siteZoneBindings = shops.map((s, i) => ({
    id: i + 1,
    site_id: i + 1,
    site_display_id: "GLB" + String(4598000 + i),
    zone_ids: [i + 1],
    default_zone_id: i + 1,
    updated_by: "Admin",
    updated_at: "2026-09-01 10:00:00",
  }));

  let putawayRules = [
    { id: 1, rule_code: "YZGZ03", rule_name: "路线优先", status: 1, updated_by: "何宇麟", updated_at: "2026-03-26 09:37:11" },
    { id: 2, rule_code: "YZGZ02", rule_name: "效率优先", status: 0, updated_by: "何宇麟", updated_at: "2026-03-26 09:37:11" },
    { id: 3, rule_code: "YZGZ01", rule_name: "清库位优先", status: 0, updated_by: "何宇麟", updated_at: "2026-03-26 09:37:11" },
  ];

  const putawayRuleDocs = [
    {
      code: "YZGZ01",
      title: "清库位优先",
      logic: "优先寻找空库位上架；尽量避免与已有库存混放，减少一库多款。",
      pros: "盘点更清晰，降低混款风险。",
    },
    {
      code: "YZGZ02",
      title: "效率优先",
      logic: "偏出库视角：优先靠近出库口的库位，缩短拣货路径。",
      pros: "出库拣货更快，整体人效更高。",
    },
    {
      code: "YZGZ03",
      title: "路线优先",
      logic: "偏入库视角：优先靠近收货口的库位，缩短上架搬运距离。（与效率优先区分：一为入库上架，一为出库拣货）",
      pros: "上架更快，收货阶段省人力。",
    },
  ];

  let waveRules = [
    { id: 1, rule_code: "BCGZ03", rule_name: "18点波次", generate_time: "18:00", order_qty: 200, status: 0, updated_by: "张荷虎", updated_at: "2026-03-10 11:38:47" },
    { id: 2, rule_code: "BCGZ02", rule_name: "14点波次", generate_time: "14:00", order_qty: 200, status: 0, updated_by: "张荷虎", updated_at: "2026-03-10 11:38:47" },
    { id: 3, rule_code: "BCGZ01", rule_name: "9点波次", generate_time: "09:00", order_qty: 150, status: 1, updated_by: "张荷虎", updated_at: "2026-03-10 11:38:47" },
  ];

  let allocateRules = [
    { id: 1, rule_code: "PHGZ02", rule_name: "提升拣货效率", weight: 60, status: 0, updated_by: "张荷虎", updated_at: "2026-01-14 15:28:26" },
    { id: 2, rule_code: "PHGZ01", rule_name: "缺货订单整理", weight: 50, status: 1, updated_by: "张荷虎", updated_at: "2026-01-14 15:28:26" },
  ];

  let allocateLogs = [
    { at: "2026-01-14 15:28:26", who: "张荷虎", content: "新建 PHGZ01 缺货订单整理，权重 50，状态启用" },
  ];

  let seq = {
    warehouse: Math.max(1, ...warehouses.map((w) => Number(w.id) || 0)),
    zone: Math.max(5, ...zones.map((z) => Number(z.id) || 0)),
    location: Math.max(100, ...locations.map((l) => Number(l.id) || 0)),
    partial: 3,
    qc: 3,
    siteZone: 5,
    putaway: 3,
    wave: 3,
    allocate: 2,
  };

  return {
    now,
    ENUMS,
    currentUser: "当前用户",
    getSites: () => sites.slice(),
    getWarehouses: () => warehouses.slice(),
    setWarehouses: (list) => {
      warehouses = list;
      if (window.WMS_ORG) WMS_ORG.syncFromMock();
    },
    nextWarehouseId: () => ++seq.warehouse,
    getZones: () => zones.slice(),
    setZones: (list) => { zones = list; },
    nextZoneId: () => ++seq.zone,
    getLocations: () => locations.slice(),
    setLocations: (list) => { locations = list; },
    nextLocationId: () => ++seq.location,
    getApprovalFlows: () => approvalFlows.slice(),
    setApprovalFlows: (list) => { approvalFlows = list; },
    getPartialReasons: () => partialReasons.slice(),
    setPartialReasons: (list) => { partialReasons = list; },
    nextPartialId: () => ++seq.partial,
    getQcReasons: () => qcReasons.slice(),
    setQcReasons: (list) => { qcReasons = list; },
    nextQcId: () => ++seq.qc,
    getSiteZoneBindings: () => siteZoneBindings.slice(),
    setSiteZoneBindings: (list) => { siteZoneBindings = list; },
    nextSiteZoneId: () => ++seq.siteZone,
    getPutawayRules: () => putawayRules.slice(),
    setPutawayRules: (list) => { putawayRules = list; },
    nextPutawayId: () => ++seq.putaway,
    putawayRuleDocs,
    getWaveRules: () => waveRules.slice(),
    setWaveRules: (list) => { waveRules = list; },
    nextWaveId: () => ++seq.wave,
    getAllocateRules: () => allocateRules.slice(),
    setAllocateRules: (list) => { allocateRules = list; },
    nextAllocateId: () => ++seq.allocate,
    getAllocateLogs: () => allocateLogs.slice(),
    pushAllocateLog: (row) => { allocateLogs.unshift(row); },
  };
})();
