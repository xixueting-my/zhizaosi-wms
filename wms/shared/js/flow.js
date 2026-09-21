/**
 * WMS 状态机 — 件级唯一码 + Web/PDA 共用
 * SKU/唯一码规则：docs/plans/2026-09-21-sku-uc-rules.md
 * docs/plans/2026-09-21-wms-pda-prototype-strict.md
 */
window.WMS_FLOW = (function () {
  const KEY = "wms_flow_v9";
  const listeners = [];

  function whName() {
    return (window.WMS_ORG && WMS_ORG.warehouseName()) || "杭州一号仓";
  }
  function siteName(i) {
    return (window.WMS_ORG && WMS_ORG.siteAt(i)) || "yours";
  }
  function SK() { return window.WMS_SKU; }
  function skuOf(site, spu, color, size) {
    return SK().build({ site: site || siteName(0), spu, color, size });
  }
  function skcOf(site, spu, color) {
    return SK().buildSkc({ site: site || siteName(0), spu, color });
  }
  function nowText() {
    const d = new Date();
    const p = (n) => String(n).padStart(2, "0");
    return d.getFullYear() + "-" + p(d.getMonth() + 1) + "-" + p(d.getDate()) + " " + p(d.getHours()) + ":" + p(d.getMinutes());
  }
  function seq(prefix, n) { return prefix + "260921" + String(n).padStart(4, "0"); }
  function fail(m, code) { return { ok: false, message: m, code: code || "BIZ" }; }
  function byId(list, id) { return list.find((x) => x.id === id); }
  function recommendLoc(sku) {
    if (window.WMS_ORG && WMS_ORG.locationAt) {
      const hash = String(sku || "").split("").reduce((a, c) => a + c.charCodeAt(0), 0);
      return WMS_ORG.locationAt(hash);
    }
    const hash = String(sku || "").split("").reduce((a, c) => a + c.charCodeAt(0), 0);
    return ["A", "B", "C"][hash % 3] + "-" + String((hash % 12) + 1).padStart(2, "0") + "-" + String((hash % 20) + 1).padStart(2, "0");
  }
  function countQc(units) {
    return {
      qc_pass: units.filter((u) => u.status === "qc_pass" || u.status === "putaway" || u.status === "picked" || u.status === "checked").length,
      qc_fail: units.filter((u) => u.status === "qc_fail").length,
      qc_repair: units.filter((u) => u.status === "qc_repair").length,
    };
  }

  function line(sku, name, ship, received) {
    return {
      line_id: "ln_" + sku.replace(/[^a-zA-Z0-9]/g, "").slice(-12),
      sku, name: name || sku, barcode: sku,
      ship_qty: ship, received_qty: received || 0, session_qty: 0,
    };
  }
  function sizeLine(site, spu, color, size, name, ship, received) {
    return line(skuOf(site, spu, color, size), name, ship, received);
  }

  function makeUnits(so, lines) {
    const units = [];
    const seqBySku = {};
    lines.forEach((l) => {
      for (let i = 1; i <= Number(l.ship_qty); i++) {
        seqBySku[l.sku] = (seqBySku[l.sku] || 0) + 1;
        const n = seqBySku[l.sku];
        units.push({
          uc: SK().buildUc(l.sku, n),
          sku: l.sku, name: l.name, so_id: so.id, so_no: so.so_no,
          status: "expected", location: "", recommend_location: recommendLoc(l.sku),
          order_id: "", pick_id: "", qc_reason: "", session: false,
        });
      }
    });
    return units;
  }

  function syncHeader(so) {
    if (!so.lines) return;
    so.ship_qty = so.lines.reduce((s, l) => s + Number(l.ship_qty), 0);
    so.received_qty = so.lines.reduce((s, l) => s + Number(l.received_qty), 0);
  }

  function seed() {
    const sizes = ["XS", "S", "M", "L", "XL", "2XL", "3XL"];
    const s0 = siteName(0), s1 = siteName(1), s2 = siteName(2), s3 = siteName(3), s4 = siteName(4);

    const lines1 = sizes.map((sz) => sizeLine(s0, "FUZ1663", "DustyLavender", sz, "雾紫连衣裙 " + sz, 1, 0));
    const so1 = {
      id: "so1", so_no: "SO2609190001", po_no: "PM2609150002", factory: "wms-测试",
      site: s0, skc: skcOf(s0, "FUZ1663", "DustyLavender"), sku: lines1.map((l) => l.sku).join(","),
      order_type: "生产入库", ship_qty: 7, received_qty: 0, status: "pending",
      ship_time: "2026-09-19 21:55:20", eta: "2026-09-22", tracking_no: "SF10001",
      partial_reason: "", arrived_at: "", arrived_by: "", inbound_id: "",
      lines: lines1,
    };
    const units1 = makeUnits(so1, lines1);

    const linesA = sizes.map((sz) => sizeLine(s1, "FUZ2892", "Rust", sz, "铁锈针织 " + sz, 2, 2));
    const soA = {
      id: "soA", so_no: "SO2607300002", po_no: "PM2607150008", factory: "wms-测试",
      site: s1, skc: skcOf(s1, "FUZ2892", "Rust"), sku: linesA[0].sku,
      order_type: "备货款", ship_qty: 14, received_qty: 14, status: "received",
      ship_time: "2026-07-30 10:00:00", eta: "2026-08-02", tracking_no: "SF20001",
      partial_reason: "", arrived_at: "2026-07-31 09:00", arrived_by: "王敏", inbound_id: "rkA",
      lines: linesA,
    };
    const unitsA = makeUnits(soA, linesA);
    const qcCycle = ["qc_pass", "received", "qc_fail", "qc_repair", "qc_pass", "received"];
    unitsA.forEach((u, i) => {
      const st = qcCycle[i % qcCycle.length];
      u.status = st;
      if (st === "qc_fail") u.qc_reason = ["线头", "色差", "破洞", "污渍"][i % 4];
      if (st === "qc_repair") u.qc_reason = "开线";
    });

    const lines2 = [
      sizeLine(s2, "OLZ1634", "Brown", "S", "棕色针织衫 S", 6, 2),
      sizeLine(s2, "OLZ1634", "Brown", "M", "棕色针织衫 M", 6, 1),
      sizeLine(s2, "OLZ1634", "Brown", "L", "棕色针织衫 L", 6, 3),
      sizeLine(s2, "OLZ1634", "Brown", "XL", "棕色针织衫 XL", 4, 0),
    ];
    const so2 = {
      id: "so2", so_no: "SO2609210002", po_no: "PO2609180091", factory: "杭州二厂",
      site: s2, skc: skcOf(s2, "OLZ1634", "Brown"), sku: lines2[0].sku,
      order_type: "生产入库", ship_qty: 22, received_qty: 6, status: "partial",
      ship_time: "2026-09-19 11:20:00", eta: "2026-09-21", tracking_no: "SF10002",
      partial_reason: "尾数未到", arrived_at: "2026-09-21 09:10", arrived_by: "王敏", inbound_id: "rk1",
      lines: lines2,
    };
    const units2 = makeUnits(so2, lines2);
    let got = {};
    got[skuOf(s2, "OLZ1634", "Brown", "S")] = 2;
    got[skuOf(s2, "OLZ1634", "Brown", "M")] = 1;
    got[skuOf(s2, "OLZ1634", "Brown", "L")] = 3;
    units2.forEach((u) => {
      if (got[u.sku] > 0) { u.status = "received"; got[u.sku] -= 1; }
    });

    const lines3 = sizes.slice(0, 5).map((sz) => sizeLine(s3, "FUZ1001", "Black", sz, "黑色基础款 " + sz, 4, 0));
    const so3 = {
      id: "so3", so_no: "SO2609180003", po_no: "PO2609170102", factory: "广州一厂",
      site: s3, skc: skcOf(s3, "FUZ1001", "Black"), sku: lines3[0].sku,
      order_type: "生产入库", ship_qty: 20, received_qty: 0, status: "pending",
      ship_time: "2026-09-18 09:00:00", eta: "2026-09-20", tracking_no: "SF10003",
      partial_reason: "", arrived_at: "2026-09-20 14:00", arrived_by: "李强", inbound_id: "",
      lines: lines3,
    };
    const units3 = makeUnits(so3, lines3);

    const lines4 = ["XS", "S", "M", "L"].map((sz) => sizeLine(s4, "GLZ0714", "Grey", sz, "灰色上衣 " + sz, 2, 2));
    const so4 = {
      id: "so4", so_no: "SO2606150001", po_no: "PO2606100011", factory: "东莞三厂",
      site: s4, skc: skcOf(s4, "GLZ0714", "Grey"), sku: lines4[0].sku,
      order_type: "生产入库", ship_qty: 8, received_qty: 8, status: "received",
      ship_time: "2026-06-15 08:00:00", eta: "2026-06-18", tracking_no: "SF30001",
      partial_reason: "", arrived_at: "2026-06-16 10:00", arrived_by: "陈工", inbound_id: "rk2",
      lines: lines4,
    };
    const units4 = makeUnits(so4, lines4);
    units4.forEach((u, i) => {
      u.status = "putaway";
      u.location = (window.WMS_ORG && WMS_ORG.locationAt) ? WMS_ORG.locationAt(10 + i) : ("YYKQ-" + String(10 + i));
      u.recommend_location = u.location;
    });

    units4.forEach((u, i) => {
      if (i === 0) { u.pick_id = "pDone"; u.order_id = "o1"; u.status = "checked"; }
      else if (i === 1) { u.pick_id = "pDone"; u.order_id = "o2"; u.status = "picked"; }
      else if (i < 5) { u.pick_id = "p1"; u.order_id = "o" + (i + 1); u.status = "putaway"; }
    });

    const orders = units4.map((u, i) => {
      const waved = i < 5;
      const donePick = i < 2;
      const parts = skuParts(u.sku);
      return {
        id: "o" + (i + 1),
        order_no: "CK260921" + String(1001 + i),
        customer_order_no: "8358361465" + String(100 + i),
        package_no: "PKG-" + (1000 + i),
        sku: u.sku, name: u.name, qty: 1, checked_qty: i === 0 ? 1 : 0,
        warehouse: whName(), site: parts.site || s4,
        status: i === 0 ? "checked" : (i === 1 ? "check_pending" : "wait_out"),
        wave_id: waved ? "w1" : "",
        pick_id: donePick ? "pDone" : (waved ? "p1" : ""),
        channel: "Shopify", tracking_no: "UL16112588" + i + "YP",
      };
    });
    for (let k = 0; k < 3; k++) {
      const site = siteName(k);
      const sku = skuOf(site, "FUZ1001", "Black", "M");
      orders.push({
        id: "oWait" + k,
        order_no: "CK2609212" + String(100 + k),
        customer_order_no: "SH-WAIT-" + (200 + k),
        package_no: "",
        sku, name: "黑色基础款 M", qty: 1, checked_qty: 0,
        warehouse: whName(), site,
        status: "wait_out", wave_id: "", pick_id: "",
        channel: "Shopify", tracking_no: "",
      });
    }
    orders.push({
      id: "oCancel1",
      order_no: "CK2609200999",
      customer_order_no: "SH-CANCEL-1",
      package_no: "",
      sku: skuOf(s0, "OLZ1634", "Brown", "S"), name: "棕色针织衫 S", qty: 1, checked_qty: 0,
      warehouse: whName(), site: s0,
      status: "cancelled", wave_id: "", pick_id: "",
      channel: "Shopify", tracking_no: "",
    });

    const pickDoneLines = units4.slice(0, 2).map((u, i) => ({
      line_id: "pkd" + i, location: u.location, sku: u.sku, name: u.name, barcode: u.sku,
      qty: 1, picked_qty: 1, uc: u.uc, shortage: false, order_no: orders[i].order_no,
    }));
    const pickOpenLines = units4.slice(2, 5).map((u, i) => ({
      line_id: "pk" + i, location: u.location, sku: u.sku, name: u.name, barcode: u.sku,
      qty: 1, picked_qty: 0, uc: u.uc, shortage: false, order_no: orders[i + 2].order_no,
    }));

    const stLines = [];
    for (let i = 0; i < 11; i++) {
      const sz = sizes[i % sizes.length];
      const site = siteName(i % 5);
      stLines.push({
        location: (window.WMS_ORG && WMS_ORG.locationAt) ? WMS_ORG.locationAt(50 + i) : ("MD-01-" + String(i + 1).padStart(2, "0")),
        sku: skuOf(site, "MDZ1052", "Black", sz),
        name: "黑色 " + sz,
        system_qty: 2 + (i % 5),
        count_qty: i < 3 ? 2 + (i % 5) : null,
      });
    }

    const colors = ["Black", "White", "Navy", "Khaki", "Pink", "Olive", "Red", "Beige", "Grey", "Brown"];
    const factories = ["广州一厂", "杭州二厂", "东莞三厂", "wms-测试", "佛山四厂"];
    const extraReceiving = [];
    const extraUnits = [];
    const extraInbound = [];
    for (let n = 1; n <= 12; n++) {
      const color = colors[n % colors.length];
      const site = siteName(n);
      const szs = n % 2 ? ["S", "M", "L", "XL"] : ["XS", "S", "M", "L", "XL"];
      const lines = szs.map((sz) => sizeLine(site, "BULK" + n, color, sz, color + " " + sz, 2, 0));
      const arrived = n <= 6;
      const so = {
        id: "soP" + n, so_no: "SO260922" + String(1000 + n), po_no: "PO260922" + String(2000 + n),
        factory: factories[n % factories.length], site,
        skc: skcOf(site, "BULK" + n, color), sku: lines[0].sku, order_type: "生产入库",
        ship_qty: lines.length * 2, received_qty: 0, status: "pending",
        ship_time: "2026-09-" + String(10 + (n % 9)).padStart(2, "0") + " 09:" + String(n).padStart(2, "0") + ":00",
        eta: "2026-09-23", tracking_no: "SF4" + String(1000 + n),
        partial_reason: "", arrived_at: arrived ? "2026-09-21 08:" + String(n).padStart(2, "0") : "",
        arrived_by: arrived ? "王敏" : "", inbound_id: "", lines,
      };
      extraReceiving.push(so);
      extraUnits.push.apply(extraUnits, makeUnits(so, lines));
    }

    const qcSizes = ["XS", "S", "M", "L", "XL", "2XL", "3XL", "4XL"];
    const qcLines = [];
    ["Rust", "Ivory", "Black"].forEach((c) => {
      qcSizes.forEach((sz) => qcLines.push(sizeLine(s0, "QCSTD", c, sz, c + " 样衣 " + sz, 3, 3)));
    });
    const soQ = {
      id: "soQ", so_no: "SO2608010009", po_no: "PM2607280019", factory: "wms-测试",
      site: s0, skc: skcOf(s0, "QCSTD", "Rust"), sku: qcLines[0].sku, order_type: "备货款",
      ship_qty: qcLines.length * 3, received_qty: qcLines.length * 3, status: "received",
      ship_time: "2026-08-01 10:00:00", eta: "2026-08-04", tracking_no: "SF80009",
      partial_reason: "", arrived_at: "2026-08-02 09:00", arrived_by: "王敏", inbound_id: "rkQ",
      lines: qcLines,
    };
    const unitsQ = makeUnits(soQ, qcLines);
    const reasons = ["线头", "色差", "破洞", "污渍", "尺寸不符"];
    unitsQ.forEach((u, i) => {
      if (i < 24) u.status = "received";
      else if (i < 48) u.status = "qc_pass";
      else if (i < 60) { u.status = "qc_fail"; u.qc_reason = reasons[i % reasons.length]; }
      else { u.status = "qc_repair"; u.qc_reason = i % 2 ? "开线" : "掉扣"; }
    });
    const qcQ = countQc(unitsQ);
    extraReceiving.push(soQ);
    extraUnits.push.apply(extraUnits, unitsQ);
    extraInbound.push({ id: "rkQ", rk_no: "RK2608010009", so_id: "soQ", status: "qc_doing", qc_pass: qcQ.qc_pass, qc_fail: qcQ.qc_fail, qc_repair: qcQ.qc_repair, putaway_id: "" });

    const putSizes = ["S", "M", "L", "XL", "2XL"];
    const putLines = putSizes.map((sz) => sizeLine(s1, "PUTWAIT", "Navy", sz, "待上架海军蓝 " + sz, 4, 4));
    const soPut = {
      id: "soPut", so_no: "SO2608100011", po_no: "PO2608050011", factory: "东莞三厂",
      site: s1, skc: skcOf(s1, "PUTWAIT", "Navy"), sku: putLines[0].sku, order_type: "生产入库",
      ship_qty: 20, received_qty: 20, status: "received",
      ship_time: "2026-08-10 11:00:00", eta: "2026-08-12", tracking_no: "SF80111",
      partial_reason: "", arrived_at: "2026-08-11 10:00", arrived_by: "李强", inbound_id: "rkPut",
      lines: putLines,
    };
    const unitsPut = makeUnits(soPut, putLines);
    unitsPut.forEach((u, i) => {
      u.status = "qc_pass";
      u.recommend_location = (window.WMS_ORG && WMS_ORG.locationAt) ? WMS_ORG.locationAt(30 + i) : recommendLoc(u.sku);
    });
    extraReceiving.push(soPut);
    extraUnits.push.apply(extraUnits, unitsPut);
    extraInbound.push({ id: "rkPut", rk_no: "RK2608100011", so_id: "soPut", status: "qc_done", qc_pass: 20, qc_fail: 0, qc_repair: 0, putaway_id: "sjPut" });

    const moreOrders = [];
    const morePickUnits = [];
    const morePicks = [1, 2, 3].map((k) => {
      const oid = "oPx" + k;
      const site = siteName(k);
      const sku = skuOf(site, "PICK" + k, "Olive", "M");
      const order = {
        id: oid, order_no: "CK260923" + String(1000 + k), customer_order_no: "SH-PX-" + k,
        package_no: "", sku, name: "配货橄榄 M", qty: 2, checked_qty: 0,
        warehouse: whName(), site, status: "wait_out", wave_id: "w2", pick_id: "pX" + k,
        channel: "Shopify", tracking_no: "",
      };
      moreOrders.push(order);
      const lines = [];
      for (let i = 1; i <= 2; i++) {
        const loc = (window.WMS_ORG && WMS_ORG.locationAt) ? WMS_ORG.locationAt(40 + k * 2 + i) : ("C-" + k + "-" + String(i).padStart(2, "0"));
        const uc = SK().buildUc(sku, i);
        lines.push({
          line_id: "pkx" + k + "_" + i, location: loc,
          sku, name: order.name, barcode: sku,
          qty: 1, picked_qty: 0, uc, shortage: false, order_no: order.order_no,
        });
        morePickUnits.push({
          uc, sku, name: order.name, so_id: "", so_no: "",
          status: "putaway", location: loc, recommend_location: loc,
          order_id: oid, pick_id: "pX" + k, qc_reason: "", session: false,
        });
      }
      return {
        id: "pX" + k, ph_no: "PH260923000" + k, wave_id: "w2", sku,
        qty: lines.length, picked_qty: 0, type: "多件",
        warehouse: whName(), status: "to_pick", picker: "", order_ids: [oid], lines,
      };
    });
    orders.push.apply(orders, moreOrders);

    const moreSt = [3, 4].map((k) => ({
      id: "st" + k, st_no: "ST2609" + String(10 + k) + "000" + k, warehouse: whName(),
      zone: k === 3 ? "B" : "C", status: "open", title: (k === 3 ? "B" : "C") + "区循环盘", drafted: false,
      lines: Array.from({ length: k === 3 ? 16 : 12 }, (_, i) => {
        const sz = ["XS", "S", "M", "L", "XL", "2XL"][i % 6];
        const site = siteName(k + i);
        return {
          location: (window.WMS_ORG && WMS_ORG.locationAt) ? WMS_ORG.locationAt(60 + k * 20 + i) : ((k === 3 ? "B" : "C") + "-0" + ((i % 4) + 1) + "-" + String(10 + i)),
          sku: skuOf(site, "STK" + k, "Beige", sz), name: "盘点米色 " + sz,
          system_qty: 1 + (i % 4), count_qty: null,
        };
      }),
    }));

    const qcA = countQc(unitsA);
    return {
      seq: { so: 30, rk: 10, sj: 6, order: 30, wave: 3, pick: 10, st: 6, ex: 0, mv: 0 },
      receiving: [so1, soA, so2, so3, so4].concat(extraReceiving),
      inbound: [
        { id: "rkA", rk_no: "RK2607300002", so_id: "soA", status: "qc_doing", qc_pass: qcA.qc_pass, qc_fail: qcA.qc_fail, qc_repair: qcA.qc_repair, putaway_id: "" },
        { id: "rk1", rk_no: "RK2609210001", so_id: "so2", status: "qc_pending", qc_pass: 0, qc_fail: 0, qc_repair: 0, putaway_id: "" },
        { id: "rk2", rk_no: "RK2606150001", so_id: "so4", status: "inbound_done", qc_pass: 8, qc_fail: 0, qc_repair: 0, putaway_id: "sj1" },
      ].concat(extraInbound),
      putaway: [
        { id: "sj1", sj_no: "SJ2606150001", inbound_id: "rk2", status: "done", plan_qty: 8, done_qty: 8,
          operator: "陈工", recommend_location: units4[0].location,
          lines: lines4.map((l, i) => ({ line_id: "pl" + i, sku: l.sku, name: l.name, barcode: l.sku, plan_qty: 2, done_qty: 2, location: units4[i * 2] ? units4[i * 2].location : units4[0].location })) },
        { id: "sjPut", sj_no: "SJ2608100011", inbound_id: "rkPut", status: "pending", plan_qty: 20, done_qty: 0,
          operator: "", recommend_location: unitsPut[0].recommend_location,
          lines: putLines.map((l, i) => ({ line_id: "plp" + i, sku: l.sku, name: l.name, barcode: l.sku, plan_qty: 4, done_qty: 0, location: unitsPut[i * 4] ? unitsPut[i * 4].recommend_location : "" })) },
      ],
      orders,
      waves: [
        { id: "w1", wave_no: "BC2609210001", warehouse: whName(), status: "released", creator: "系统", created_at: "2026-09-21 08:30" },
        { id: "w2", wave_no: "BC2609230002", warehouse: whName(), status: "released", creator: "系统", created_at: "2026-09-21 10:00" },
      ],
      picks: [
        { id: "pDone", ph_no: "PH2606240015", wave_id: "w1", sku: skcOf(s4, "GLZ0714", "Grey"),
          qty: pickDoneLines.length, picked_qty: pickDoneLines.length, type: "多件",
          warehouse: whName(), status: "picked", picker: "王敏",
          order_ids: ["o1", "o2"], lines: pickDoneLines },
        { id: "p1", ph_no: "PH2609210008", wave_id: "w1", sku: skcOf(s4, "GLZ0714", "Grey"),
          qty: pickOpenLines.length, picked_qty: 0, type: "多件",
          warehouse: whName(), status: "to_pick", picker: "",
          order_ids: ["o3", "o4", "o5"], lines: pickOpenLines },
      ].concat(morePicks),
      stocktakes: [
        { id: "st1", st_no: "ST2608110003", warehouse: whName(), zone: "MD", status: "doing", title: "MD区盘点", drafted: true, lines: stLines },
        { id: "st2", st_no: "ST2608120001", warehouse: whName(), zone: "A", status: "open", title: "A区循环盘", drafted: false,
          lines: sizes.map((sz, i) => ({
            location: (window.WMS_ORG && WMS_ORG.locationAt) ? WMS_ORG.locationAt(i) : ("A-01-0" + (i + 1)),
            sku: skuOf(s0, "FUZ1001", "Black", sz), name: "黑色 " + sz, system_qty: 3 + i, count_qty: null,
          })) },
      ].concat(moreSt),
      units: units1.concat(unitsA, units2, units3, units4, extraUnits, morePickUnits),
      moves: [],
      exceptions: [],
      logs: [],
    };
  }

  let state = load();
  function load() {
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) {
        const s = JSON.parse(raw);
        if (!s.units) s.units = [];
        if (!s.moves) s.moves = [];
        if (!s.exceptions) s.exceptions = [];
        ensureInternal(s);
        return s;
      }
    } catch (e) {}
    const fresh = seed();
    ensureInternal(fresh);
    return fresh;
  }
  function emit() {
    localStorage.setItem(KEY, JSON.stringify(state));
    listeners.forEach((fn) => fn(state));
  }
  function zoneOf(loc) {
    const s = String(loc || "");
    if (/^[A-Z]+-\d{2}-\d{2}$/i.test(s)) return "Z-" + s.split("-")[0].toUpperCase();
    const m = s.match(/[A-Za-z]+/);
    return m ? m[0].slice(0, 2).toUpperCase() : "";
  }
  function costOf(sku) {
    const n = String(sku || "").split("").reduce((a, c) => a + c.charCodeAt(0), 0);
    return Math.round((8 + (n % 2200) / 100) * 10000) / 10000;
  }
  function skuParts(sku) {
    if (window.WMS_SKU) {
      const p = WMS_SKU.parse(sku);
      return { sku: p.sku, skc: p.skc, spu: p.spu, site: p.site, color: p.color, size: p.size };
    }
    const skc = String(sku || "").split("||")[0];
    return { sku: sku || "", skc, spu: skc.split("_")[0], site: "", color: "", size: "" };
  }

  function pushLedger(row) {
    if (!state.ledger) state.ledger = [];
    const sku = row.sku || "";
    const parts = skuParts(sku);
    state.ledger.unshift({
      sku, skc: parts.skc, spu: parts.spu, qty: row.qty || 1, warehouse: whName(),
      from_zone: row.from_zone || zoneOf(row.from_loc), from_loc: row.from_loc || "",
      to_zone: row.to_zone || zoneOf(row.to_loc), to_loc: row.to_loc || "",
      op: row.op, source_no: row.source_no || "", at: nowText(),
    });
    state.ledger = state.ledger.slice(0, 300);
  }

  function sampleLedger() {
    const rows = [
      [skuOf(siteName(0), "TestZ1640", "Black", "S"), 1, "AH", "3B11-10-102", "AH", "3B11-10-101", "PDA配货", "PH2609160008", "2026-09-16 14:22:01"],
      [skuOf(siteName(1), "FUZ0947", "GrayPurple", "M"), 1, "", "", "FU", "3A20-01-101", "PDA上架", "SJ2609160002", "2026-09-16 11:05:18"],
      [skuOf(siteName(2), "OLZ1634", "Brown", "L"), 1, "EV", "3A24-10-301", "OY", "3B05-01-104", "调拨发货", "TO2609150003", "2026-09-15 16:40:22"],
      [skuOf(siteName(4), "GLZ0714", "Grey", "S"), 1, "MD", "YYKQ-10", "MD", "3A23-02-401", "PDA配货", "PH2606240015", "2026-09-14 09:18:44"],
      [skuOf(siteName(1), "PUTWAIT", "Navy", "M"), 1, "", "", "B", "B-02-06", "PDA上架", "SJ2608100011", "2026-09-12 10:02:33"],
      [skuOf(siteName(0), "QCSTD", "Ivory", "L"), 1, "C", "C-06-02", "C", "C-06-08", "调拨配货", "TO2609110001", "2026-09-11 15:27:09"],
      [skuOf(siteName(0), "FUZ1001", "Black", "M"), 1, "A", "A-01-03", "A", "A-02-01", "PDA配货", "PH2609210008", "2026-09-10 08:41:55"],
      [skuOf(siteName(3), "MDZ1052", "Black", "S"), 1, "MD", "3A23-02-401", "MD", "3A23-02-402", "PDA上架", "SJ2609080004", "2026-09-08 13:16:20"],
    ];
    return rows.map((r) => {
      const parts = skuParts(r[0]);
      return {
        sku: r[0], skc: parts.skc, spu: parts.spu, qty: r[1], warehouse: whName(),
        from_zone: r[2], from_loc: r[3], to_zone: r[4], to_loc: r[5], op: r[6], source_no: r[7], at: r[8],
      };
    });
  }

  function ensureInternal(s) {
    if (!s.ledger || !s.ledger.length) s.ledger = sampleLedger();
    (s.stocktakes || []).forEach((t) => {
      if (!t.phase) t.phase = t.status === "done" ? "done" : "count";
      if (!t.type) t.type = "普通盘点";
      if (!t.method) t.method = "zone";
      if (t.source_no == null) t.source_no = "";
      if (t.diff == null) t.diff = (t.lines || []).some((l) => l.count_qty != null && Number(l.count_qty) !== Number(l.system_qty));
      if (t.counter == null) t.counter = "";
      if (t.remark == null) t.remark = "";
      if (!t.creator) t.creator = "Admin";
      if (!t.created_at) t.created_at = "2026-09-11 09:00:00";
      if (t.auditor == null) t.auditor = "";
      if (t.audit_result == null) t.audit_result = "";
      if (!t.qty) t.qty = (t.lines || []).reduce((n, l) => n + Number(l.system_qty || 0), 0);
    });
    if (!(s.stocktakes || []).some((t) => t.id === "stAudit")) {
      s.stocktakes.push(
        { id: "stSub", st_no: "ST2609100002", warehouse: whName(), zone: "MD", status: "done", phase: "pending_submit", type: "缺货盘点", method: "zone", source_no: "PH2606240015", diff: true, counter: "李强", remark: "配货缺货触发", creator: "Admin", created_at: "2026-09-10 08:12:00", auditor: "", audit_result: "", qty: 3, drafted: false, title: "缺货盘点",
          lines: [{ location: "3A23-02-401", sku: skuOf(siteName(3), "MDZ1052", "Black", "S"), system_qty: 2, count_qty: 1 }] },
        { id: "stAudit", st_no: "ST2609090001", warehouse: whName(), zone: "B", status: "done", phase: "auditing", type: "普通盘点", method: "zone", source_no: "", diff: true, counter: "王敏", remark: "", creator: "Admin", created_at: "2026-09-09 11:20:00", auditor: "供应链-陈工", audit_result: "", qty: 4, drafted: false, title: "B区盘点",
          lines: [{ location: "B-02-01", sku: skuOf(siteName(2), "OLZ1634", "Brown", "L"), system_qty: 2, count_qty: 2 }] },
        { id: "stDone", st_no: "ST2609080006", warehouse: whName(), zone: "A", status: "done", phase: "done", type: "普通盘点", method: "sku", source_no: "", diff: false, counter: "王敏", remark: "", creator: "Admin", created_at: "2026-09-08 09:00:00", auditor: "供应链-王敏", audit_result: "none", qty: 6, drafted: false, title: "A区抽盘",
          lines: [{ location: "A-01-01", sku: skuOf(siteName(0), "FUZ1001", "Black", "S"), system_qty: 3, count_qty: 3 }] },
        { id: "stCancel", st_no: "ST2609070004", warehouse: whName(), zone: "C", status: "cancelled", phase: "cancelled", type: "普通盘点", method: "zone", source_no: "", diff: false, counter: "", remark: "重复任务", creator: "Admin", created_at: "2026-09-07 17:40:00", auditor: "", audit_result: "", qty: 2, drafted: false, title: "已取消",
          lines: [{ location: "C-01-01", sku: skuOf(siteName(0), "QCSTD", "Black", "M"), system_qty: 1, count_qty: null }] }
      );
    }
    if (!s.moves) s.moves = [];
    (s.moves || []).forEach((m) => {
      if (!m.creator) m.creator = "Admin";
      if (!m.qty) m.qty = (m.lines || []).length;
      if (m.status === "done" && !m.done_at) m.done_at = m.created_at || "";
      (m.lines || []).forEach((l) => { if (!l.to && m.to_loc) l.to = m.to_loc; if (!l.from && m.from_loc) l.from = m.from_loc; });
    });
    if (!s.moves.some((m) => m.id === "mvDemo1")) {
      s.moves.unshift(
        { id: "mvDemo1", mv_no: "TL2608240001", status: "done", creator: "Admin", created_at: "2026-08-24 11:57:23", done_at: "2026-08-24 12:10:02", qty: 1, from_loc: "3A24-10-301", to_loc: "3B05-01-104",
          lines: [{ uc: SK().buildUc(skuOf(siteName(4), "GLZ0714", "Grey", "S"), 1), sku: skuOf(siteName(4), "GLZ0714", "Grey", "S"), from: "3A24-10-301", to: "3B05-01-104", qty: 1 }] },
        { id: "mvDemo2", mv_no: "TL2608250003", status: "done", creator: "Admin", created_at: "2026-08-25 09:20:11", done_at: "2026-08-25 09:41:00", qty: 2, from_loc: "YYKQ-11", to_loc: "B-02-06",
          lines: [
            { uc: SK().buildUc(skuOf(siteName(4), "GLZ0714", "Grey", "M"), 1), sku: skuOf(siteName(4), "GLZ0714", "Grey", "M"), from: "YYKQ-11", to: "B-02-06", qty: 1 },
            { uc: SK().buildUc(skuOf(siteName(4), "GLZ0714", "Grey", "L"), 1), sku: skuOf(siteName(4), "GLZ0714", "Grey", "L"), from: "YYKQ-12", to: "B-02-07", qty: 1 },
          ] },
        { id: "mvWait", mv_no: "TL2609210004", status: "open", creator: "Admin", created_at: "2026-09-21 10:15:00", done_at: "", qty: 1, from_loc: "A-01-02", to_loc: "",
          lines: [{ uc: SK().buildUc(skuOf(siteName(3), "FUZ1001", "Black", "S"), 1), sku: skuOf(siteName(3), "FUZ1001", "Black", "S"), from: "A-01-02", to: "", qty: 1 }] }
      );
    }
  }

  function log(doc, action) {
    state.logs.unshift({ at: nowText(), doc, action });
    state.logs = state.logs.slice(0, 200);
  }
  function qcSum(rk) { return Number(rk.qc_pass) + Number(rk.qc_fail) + Number(rk.qc_repair); }

  function syncReceiveStatus(so) {
    if (so.status === "void") return;
    if (so.received_qty <= 0) so.status = "pending";
    else if (so.received_qty < so.ship_qty) so.status = "partial";
    else so.status = "received";
  }
  function syncPutawayStatus(sj) {
    if (sj.status === "void") return;
    if (sj.done_qty <= 0) sj.status = "pending";
    else if (sj.done_qty < sj.plan_qty) sj.status = "partial";
    else sj.status = "done";
  }
  function ensureLines(so) {
    if (so.lines && so.lines.length) return so.lines;
    so.lines = [line(String(so.sku).split(",")[0], so.sku, so.ship_qty, so.received_qty)];
    return so.lines;
  }
  function ensureInbound(so) {
    if (so.inbound_id) return byId(state.inbound, so.inbound_id);
    state.seq.rk += 1;
    const rk = { id: "rk" + state.seq.rk, rk_no: seq("RK", state.seq.rk), so_id: so.id,
      status: "qc_pending", qc_pass: 0, qc_fail: 0, qc_repair: 0, putaway_id: "" };
    state.inbound.push(rk);
    so.inbound_id = rk.id;
    return rk;
  }
  function activePutaway(rk) {
    if (!rk || !rk.putaway_id) return null;
    const sj = byId(state.putaway, rk.putaway_id);
    return sj && sj.status !== "void" ? sj : null;
  }
  function unitsOfSo(soId) { return state.units.filter((u) => u.so_id === soId); }
  function findUnit(uc) { return state.units.find((u) => u.uc === uc); }

  const api = {
    subscribe(fn) { listeners.push(fn); },
    get() { return state; },
    reset() { state = seed(); ensureInternal(state); log("", "重置演示数据"); emit(); return { ok: true, message: "已重置演示数据" }; },
    logsFor(token) { return state.logs.filter((l) => !token || l.doc.includes(token) || l.action.includes(token)); },
    findUnit(uc) { const u = findUnit(uc); return u ? { ok: true, data: u } : fail("唯一码不存在", "NOT_FOUND"); },
    listUnits(filter) {
      let list = state.units.slice();
      if (filter) {
        if (filter.so_id) list = list.filter((u) => u.so_id === filter.so_id);
        if (filter.status) list = list.filter((u) => u.status === filter.status);
        if (filter.pick_id) list = list.filter((u) => u.pick_id === filter.pick_id);
      }
      return list;
    },

    mesShip() {
      state.seq.so += 1;
      const n = state.seq.so;
      const site = siteName(n);
      const sku = skuOf(site, "FUZNEW" + n, "Ivory", "M");
      const lines = [line(sku, "新品 M", 4, 0)];
      const so = {
        id: "so" + n, so_no: seq("SO", n), po_no: "PO260921" + String(n).padStart(4, "0"),
        factory: "广州一厂", site, skc: skcOf(site, "FUZNEW" + n, "Ivory"), sku,
        order_type: "生产入库", ship_qty: 4, received_qty: 0, status: "pending",
        ship_time: nowText(), eta: "2026-09-25", tracking_no: "SF" + (20000 + n),
        partial_reason: "", arrived_at: "", arrived_by: "", inbound_id: "", lines,
      };
      state.units = state.units.concat(makeUnits(so, lines));
      state.receiving.unshift(so);
      log(so.so_no, "模拟 MES 发货");
      emit();
      return { ok: true, message: "已生成 " + so.so_no };
    },

    arrive(id) {
      const so = byId(state.receiving, id);
      if (!so) return fail("收货单不存在", "NOT_FOUND");
      if (so.status === "void") return fail("已作废", "VOID");
      if (so.status === "received") return fail("当前收货单已完成或关闭，不可操作", "CLOSED");
      so.arrived_at = nowText();
      so.arrived_by = "当前用户";
      log(so.so_no, "到货扫描");
      emit();
      const next = state.receiving.find((r) => r.id !== so.id && r.status === "pending" && !r.arrived_at && r.factory === so.factory);
      return { ok: true, message: so.so_no + " 已到货", data: { so, suggest_next: next || null } };
    },
    confirmArrive(id) { return api.arrive(id); },

    receive(id, qty, reason) {
      const so = byId(state.receiving, id);
      if (!so) return fail("收货单不存在");
      if (so.status === "void" || so.status === "received") return fail("当前收货单已完成或关闭，不可操作", "CLOSED");
      if (!so.arrived_at) return fail("尚未到货确认，请先在 PDA 到货", "NEED_ARRIVE");
      ensureLines(so);
      qty = Number(qty);
      if (!qty || qty <= 0) return fail("数量须大于 0");
      if (so.received_qty + qty > so.ship_qty) return fail("实收不能超过送货件数", "OVER_RECEIVE");
      if (so.received_qty + qty < so.ship_qty && !reason) return fail("部分收货须填写原因", "NEED_REASON");
      let left = qty;
      for (const ln of so.lines) {
        if (left <= 0) break;
        const room = Number(ln.ship_qty) - Number(ln.received_qty);
        if (room <= 0) continue;
        const take = Math.min(room, left);
        ln.received_qty += take;
        const us = state.units.filter((u) => u.so_id === so.id && u.sku === ln.sku && u.status === "expected");
        for (let i = 0; i < take && i < us.length; i++) us[i].status = "received";
        left -= take;
      }
      syncHeader(so);
      if (so.received_qty < so.ship_qty) so.partial_reason = reason;
      syncReceiveStatus(so);
      const rk = ensureInbound(so);
      log(so.so_no, "收货 +" + qty);
      emit();
      return { ok: true, message: so.so_no + " 实收 " + so.received_qty, data: { so, inbound: rk } };
    },

    scanReceiveUc(soId, code) {
      const so = byId(state.receiving, soId);
      if (!so) return fail("收货单不存在", "NOT_FOUND");
      if (so.status === "void" || so.status === "received") return fail("当前收货单已完成或关闭，不可操作", "CLOSED");
      if (!so.arrived_at) return fail("尚未到货确认", "NEED_ARRIVE");
      ensureLines(so);
      let unit = findUnit(code);
      if (!unit) {
        const ln = so.lines.find((l) => l.sku === code || l.barcode === code);
        if (!ln) return fail("唯一码/SKU 与本单不符", "SKU_MISMATCH");
        unit = state.units.find((u) => u.so_id === so.id && u.sku === ln.sku && u.status === "expected" && !u.session);
        if (!unit) return fail("该 SKU 已无可收件数", "DONE");
      } else {
        if (unit.so_id !== so.id) return fail("唯一码不属于本收货单", "SKU_MISMATCH");
        if (unit.status !== "expected" && !unit.session) return fail("该唯一码已收货", "DUP");
        if (unit.session) return fail("该唯一码已在本次扫描中", "DUP");
      }
      const ln = so.lines.find((l) => l.sku === unit.sku);
      if (!ln) return fail("明细不存在");
      if (Number(ln.received_qty) + Number(ln.session_qty) >= Number(ln.ship_qty)) return fail("该 SKU 已收齐", "OVER_RECEIVE");
      unit.session = true;
      ln.session_qty = Number(ln.session_qty || 0) + 1;
      log(so.so_no, "扫描唯一码 " + unit.uc);
      emit();
      return { ok: true, message: "已扫 " + unit.uc, data: { so, unit, lines: so.lines } };
    },

    clearReceiveSession(soId) {
      const so = byId(state.receiving, soId);
      if (!so) return fail("不存在");
      ensureLines(so);
      so.lines.forEach((l) => { l.session_qty = 0; });
      state.units.filter((u) => u.so_id === soId && u.session).forEach((u) => { u.session = false; });
      emit();
      return { ok: true, message: "已清空本次扫描", data: so };
    },

    saveReceiveDraft(soId) {
      const so = byId(state.receiving, soId);
      if (!so) return fail("不存在");
      log(so.so_no, "暂存收货");
      emit();
      return { ok: true, message: "已暂存", data: so };
    },

    commitReceive(soId, opts) {
      opts = opts || {};
      const so = byId(state.receiving, soId);
      if (!so) return fail("不存在");
      if (so.status === "void" || so.status === "received") return fail("当前收货单已完成或关闭，不可操作", "CLOSED");
      ensureLines(so);
      const sessionTotal = so.lines.reduce((s, l) => s + Number(l.session_qty || 0), 0);
      if (sessionTotal <= 0 && opts.mode !== "complete") return fail("本次未扫描任何唯一码", "EMPTY");
      so.lines.forEach((l) => {
        l.received_qty = Number(l.received_qty) + Number(l.session_qty || 0);
        l.session_qty = 0;
      });
      state.units.filter((u) => u.so_id === soId && u.session).forEach((u) => {
        u.session = false;
        u.status = "received";
      });
      syncHeader(so);
      const short = so.received_qty < so.ship_qty;
      if (opts.mode === "partial" || (short && opts.mode !== "complete")) {
        if (!opts.reason && short) return fail("部分收货须填写原因", "NEED_REASON");
        so.partial_reason = opts.reason || so.partial_reason;
      }
      if (opts.mode === "complete" && short && !opts.reason) {
        return fail("数量不足，请选择部分收货或补扫", "SHORT");
      }
      if (opts.mode === "complete" && short) so.partial_reason = opts.reason || "收货完成(短收)";
      syncReceiveStatus(so);
      if (opts.mode === "complete" && !short) so.status = "received";
      const rk = ensureInbound(so);
      log(so.so_no, "提交收货 mode=" + (opts.mode || ""));
      emit();
      return { ok: true, message: "收货已提交", data: { so, inbound: rk, short } };
    },

    finishPartial(id, reason) { return api.commitReceive(id, { mode: "partial", reason }); },

    receiveLine(id, sku, qty, reason) {
      const so = byId(state.receiving, id);
      if (!so) return fail("不存在");
      ensureLines(so);
      qty = Number(qty);
      for (let i = 0; i < qty; i++) {
        const r = api.scanReceiveUc(id, sku);
        if (!r.ok) return r;
      }
      return { ok: true, message: "已扫 " + qty, data: { so } };
    },

    unreceive(id, qty) {
      const so = byId(state.receiving, id);
      if (!so || so.status === "void") return fail("不能反收货");
      ensureLines(so);
      qty = Number(qty);
      const rk = so.inbound_id ? byId(state.inbound, so.inbound_id) : null;
      const floor = rk && rk.status !== "void" ? qcSum(rk) : 0;
      if (so.received_qty - qty < floor) return fail("实收不能低于已质检数量");
      let left = qty;
      for (let i = so.lines.length - 1; i >= 0 && left > 0; i--) {
        const ln = so.lines[i];
        const take = Math.min(ln.received_qty, left);
        ln.received_qty -= take;
        const us = state.units.filter((u) => u.so_id === so.id && u.sku === ln.sku && u.status === "received");
        for (let j = 0; j < take && j < us.length; j++) us[us.length - 1 - j].status = "expected";
        left -= take;
      }
      syncHeader(so); syncReceiveStatus(so);
      log(so.so_no, "反收货 -" + qty); emit();
      return { ok: true, message: "实收 " + so.received_qty };
    },

    voidReceive(id) {
      const so = byId(state.receiving, id);
      if (!so) return fail("不存在");
      if (so.status === "void") return fail("已作废");
      const rk = so.inbound_id ? byId(state.inbound, so.inbound_id) : null;
      const sj = activePutaway(rk);
      if (sj && sj.done_qty > 0) return fail("已有上架数量");
      so.status = "void";
      if (rk) rk.status = "void";
      if (sj) sj.status = "void";
      log(so.so_no, "作废"); emit();
      return { ok: true, message: "已作废" };
    },

    startQc(id) {
      const rk = byId(state.inbound, id);
      if (!rk || rk.status === "void") return fail("入库单不可用");
      if (rk.status === "qc_done") return fail("质检已提交");
      const so = byId(state.receiving, rk.so_id);
      if (!so || so.received_qty <= 0) return fail("尚未收货");
      if (rk.status !== "qc_doing") rk.status = "qc_doing";
      log(rk.rk_no, "开始质检"); emit();
      return { ok: true, message: "质检中" };
    },

    scanQcUc(soId, uc, result, reason) {
      const so = byId(state.receiving, soId);
      if (!so) return fail("收货单不存在");
      const code = String(uc || "").trim();
      if (!code) return fail("请扫描唯一码");
      const resultName = { pass: "合格", fail: "不合格", repair: "仓内维修" }[result] || "";
      const map = { pass: "qc_pass", fail: "qc_fail", repair: "qc_repair" };
      if (!map[result]) return fail("结果无效");
      const unit = findUnit(code);
      if (!unit) {
        const onThis = (so.lines || []).some((l) => l.sku === code || l.barcode === code);
        if (onThis) {
          if (!Number(so.received_qty)) return fail("扫到的是 SKU，不是唯一码。本单还没有收货，不能质检");
          const pending = state.units.filter((u) => u.so_id === soId && u.sku === code && u.status === "received");
          if (pending.length) return fail("扫到的是 SKU，不是唯一码。请扫描件上的唯一码，例如 " + pending[0].uc);
          const got = state.units.some((u) => u.so_id === soId && u.sku === code && u.status !== "expected");
          if (!got) return fail("扫到的是 SKU，不是唯一码。该 SKU 还没有收货");
          return fail("扫到的是 SKU，不是唯一码。该 SKU 已没有待质检件数");
        }
        if (state.units.some((u) => u.sku === code)) return fail("扫到的是 SKU，不是唯一码，且不属于本单 " + so.so_no);
        return fail("没有这个唯一码。请扫描件上的唯一码，不要扫描 SKU");
      }
      if (unit.so_id !== soId) return fail("这件属于收货单 " + (unit.so_no || "其他单") + "，不是当前单 " + so.so_no, "SKU_MISMATCH");
      if (unit.status === "expected") return fail("这件还没有收货，不能质检");
      if (unit.status === "putaway") return fail("这件已经上架，不能再改质检结果");
      if (unit.status === "picked" || unit.status === "checked") return fail("这件已经出库，不能质检");
      if (unit.status === map[result]) return fail("这件已经是「" + resultName + "」，不用重复扫描");
      unit.status = map[result];
      unit.qc_reason = reason || "";
      const rk = ensureInbound(so);
      if (rk.status === "qc_pending") rk.status = "qc_doing";
      const us = unitsOfSo(soId);
      rk.qc_pass = us.filter((u) => u.status === "qc_pass" || u.status === "putaway").length;
      rk.qc_fail = us.filter((u) => u.status === "qc_fail").length;
      rk.qc_repair = us.filter((u) => u.status === "qc_repair").length;
      log(so.so_no, "质检 " + result + " " + uc); emit();
      return { ok: true, message: "已记录", data: { so, unit, inbound: rk, units: us } };
    },

    submitQc(id, passQty, failQty, repairQty) {
      const rk = byId(state.inbound, id);
      if (!rk) return fail("不存在");
      if (rk.status !== "qc_doing" && rk.status !== "qc_pending") {
        /* allow */
      }
      const so = byId(state.receiving, rk.so_id);
      passQty = Number(passQty) || 0; failQty = Number(failQty) || 0; repairQty = Number(repairQty) || 0;
      const sum = passQty + failQty + repairQty;
      if (sum <= 0) return fail("质检数量须大于 0");
      if (sum > so.received_qty) return fail("不能超过实收");
      rk.qc_pass = passQty; rk.qc_fail = failQty; rk.qc_repair = repairQty;
      rk.status = "qc_done";
      log(rk.rk_no, "提交质检"); emit();
      return { ok: true, message: "质检完成" };
    },

    submitQcForSo(soId) {
      const so = byId(state.receiving, soId);
      if (!so) return fail("不存在");
      const rk = ensureInbound(so);
      const us = unitsOfSo(soId).filter((u) => u.status === "received" || u.status.indexOf("qc_") === 0 || u.status === "putaway");
      const pending = us.filter((u) => u.status === "received");
      if (pending.length) return fail("仍有 " + pending.length + " 件未质检", "PENDING");
      rk.qc_pass = us.filter((u) => u.status === "qc_pass" || u.status === "putaway").length;
      rk.qc_fail = us.filter((u) => u.status === "qc_fail").length;
      rk.qc_repair = us.filter((u) => u.status === "qc_repair").length;
      rk.status = "qc_done";
      const conf = api.confirmInbound(rk.id);
      if (!conf.ok) return conf;
      log(so.so_no, "提交质检并确认入库"); emit();
      return { ok: true, message: "质检已提交", data: { so, inbound: rk, putaway: conf.data } };
    },

    revertQc(id) {
      const rk = byId(state.inbound, id);
      if (!rk) return fail("不存在");
      if (rk.status === "inbound_done") return fail("请先取消确认入库");
      rk.status = "qc_pending";
      rk.qc_pass = rk.qc_fail = rk.qc_repair = 0;
      log(rk.rk_no, "质检回退"); emit();
      return { ok: true, message: "已回退" };
    },

    confirmInbound(id) {
      const rk = byId(state.inbound, id);
      if (!rk || rk.status === "void") return fail("不可用");
      if (rk.status !== "qc_done" && rk.status !== "inbound_done") return fail("请先提交质检");
      const so = byId(state.receiving, rk.so_id);
      ensureLines(so);
      let sj = rk.putaway_id ? byId(state.putaway, rk.putaway_id) : null;
      const recLoc = recommendLoc(so.lines[0].sku);
      if (!sj) {
        state.seq.sj += 1;
        const passUnits = state.units.filter((u) => u.so_id === so.id && u.status === "qc_pass");
        const plan = rk.qc_pass || passUnits.length;
        sj = {
          id: "sj" + state.seq.sj, sj_no: seq("SJ", state.seq.sj), inbound_id: rk.id,
          status: "pending", plan_qty: plan, done_qty: 0, operator: "",
          recommend_location: recLoc,
          lines: so.lines.map((l, i) => ({
            line_id: "pl_" + state.seq.sj + "_" + i, sku: l.sku, name: l.name, barcode: l.sku,
            plan_qty: passUnits.filter((u) => u.sku === l.sku).length, done_qty: 0, location: "",
          })),
        };
        state.putaway.push(sj);
        rk.putaway_id = sj.id;
        passUnits.forEach((u) => { u.recommend_location = recLoc; });
      } else {
        sj.plan_qty = rk.qc_pass;
        if (!sj.recommend_location) sj.recommend_location = recLoc;
        syncPutawayStatus(sj);
      }
      rk.status = "inbound_done";
      log(rk.rk_no, "确认入库 " + sj.sj_no); emit();
      return { ok: true, message: "已确认 " + sj.sj_no, data: sj };
    },

    unconfirmInbound(id) {
      const rk = byId(state.inbound, id);
      if (!rk || rk.status !== "inbound_done") return fail("当前不是已入库");
      const sj = rk.putaway_id ? byId(state.putaway, rk.putaway_id) : null;
      if (sj && sj.done_qty > 0) return fail("请先撤回上架");
      if (sj) sj.status = "void";
      rk.status = "qc_done";
      emit();
      return { ok: true, message: "已取消确认" };
    },

    putaway(id, qty) {
      const sj = byId(state.putaway, id);
      if (!sj) return fail("不存在");
      const open = (sj.lines || []).find((l) => Number(l.done_qty) < Number(l.plan_qty)) || (sj.lines || [])[0];
      if (!open) return fail("无明细");
      return api.putawayDo(id, { sku: open.sku, location: sj.recommend_location || recommendLoc(open.sku), qty });
    },

    putawayDo(id, body) {
      const sj = byId(state.putaway, id);
      if (!sj || sj.status === "void") return fail("不可用");
      const qty = Number(body.qty);
      if (!qty || !body.location) return fail("参数不完整");
      const ln = (sj.lines || []).find((l) => l.sku === body.sku);
      if (!ln) return fail("物料不符", "SKU_MISMATCH");
      if (ln.done_qty + qty > ln.plan_qty) return fail("超上架", "OVER_PUTAWAY");
      ln.done_qty += qty; ln.location = body.location;
      sj.done_qty = sj.lines.reduce((s, l) => s + Number(l.done_qty), 0);
      sj.operator = "当前用户";
      syncPutawayStatus(sj);
      const us = state.units.filter((u) => u.sku === body.sku && u.status === "qc_pass").slice(0, qty);
      us.forEach((u) => { u.status = "putaway"; u.location = body.location; });
      log(sj.sj_no, "上架 +" + qty); emit();
      return { ok: true, message: "已上架至 " + body.location, data: { sj } };
    },

    scanPutawayUc(uc) {
      const code = String(uc || "").trim();
      const unit = findUnit(code);
      if (!unit) {
        if (state.units.some((u) => u.sku === code)) return fail("扫到的是 SKU，不是唯一码。请扫描件上的唯一码");
        return fail("没有这个唯一码", "NOT_FOUND");
      }
      if (unit.status === "putaway") return fail("这件已经上架", "DUP");
      if (unit.status !== "qc_pass") {
        const name = { expected: "未收货", received: "待质检", qc_fail: "不合格", qc_repair: "仓内维修", picked: "已配货", checked: "已复核" }[unit.status] || unit.status;
        return fail("只有质检合格的件才能上架。这件当前是「" + name + "」", "BIZ");
      }
      if (!unit.recommend_location) unit.recommend_location = recommendLoc(unit.sku);
      emit();
      return { ok: true, data: unit, message: "请扫描库位" };
    },

    scanPutawayLoc(uc, location) {
      const unit = findUnit(uc);
      if (!unit) return fail("唯一码不存在");
      if (unit.status === "putaway") return fail("该唯一码已上架", "DUP");
      if (unit.status !== "qc_pass") return fail("状态不可上架");
      if (!location) return fail("请扫描库位");
      unit.location = location;
      unit.status = "putaway";
      pushLedger({ sku: unit.sku, to_loc: location, op: "PDA上架", source_no: unit.so_no });
      const so = byId(state.receiving, unit.so_id);
      const rk = so && so.inbound_id ? byId(state.inbound, so.inbound_id) : null;
      const sj = rk && rk.putaway_id ? byId(state.putaway, rk.putaway_id) : null;
      if (sj) {
        const ln = (sj.lines || []).find((l) => l.sku === unit.sku);
        if (ln) { ln.done_qty = Number(ln.done_qty) + 1; ln.location = location; }
        sj.done_qty = Number(sj.done_qty) + 1;
        sj.operator = "当前用户";
        syncPutawayStatus(sj);
      }
      log(unit.uc, "上架 → " + location); emit();
      return { ok: true, message: "上架成功", data: { unit, sj } };
    },

    unputaway(id, qty) {
      const sj = byId(state.putaway, id);
      if (!sj) return fail("不存在");
      qty = Number(qty);
      if (sj.done_qty < qty) return fail("不足");
      sj.done_qty -= qty;
      syncPutawayStatus(sj);
      emit();
      return { ok: true, message: "已撤回" };
    },

    omsIssue() {
      state.seq.order += 1;
      const n = state.seq.order;
      const site = siteName(n);
      const sku = skuOf(site, "FUZ1001", "Black", "M");
      const o = {
        id: "o" + n, order_no: seq("CK", n), customer_order_no: "SH" + (30000 + n), package_no: "",
        sku, name: "黑色基础款 M", qty: 1, checked_qty: 0,
        warehouse: whName(), site, status: "wait_out", wave_id: "", pick_id: "",
      };
      state.orders.unshift(o); log(o.order_no, "OMS 下发"); emit();
      return { ok: true, message: "已生成 " + o.order_no };
    },
    orderProgress(o) {
      if (o.status === "cancelled") return "已取消";
      if (o.status === "checked") return "已复核";
      if (o.status === "check_pending") return "待复核";
      if (o.status === "wait_out" && o.wave_id) return "已下发波次";
      if (o.status === "wait_out") return "待下发波次";
      return "";
    },
    orderTabKey(o) {
      if (o.status === "cancelled") return "cancelled";
      if (o.status === "checked") return "checked";
      if (o.status === "check_pending") return "check_pending";
      if (o.status === "wait_out" && o.wave_id) return "waved";
      return "wait_wave";
    },
    assignPickers(ids, picker) {
      const name = String(picker || "").trim();
      if (!name) return fail("请填写配货员");
      const list = (ids || []).map((id) => byId(state.picks, id)).filter(Boolean);
      if (!list.length) return fail("请选择配货单");
      if (list.some((p) => p.status !== "to_pick" && p.status !== "to_sort")) {
        return fail("只能分配待配货或待分拣的单");
      }
      list.forEach((p) => { p.picker = name; });
      log(list.map((p) => p.ph_no).join(","), "分配配货员 " + name);
      emit();
      return { ok: true, message: "已分配 " + list.length + " 单给 " + name };
    },
    releaseWave(orderIds) {
      const orders = orderIds.map((id) => byId(state.orders, id)).filter(Boolean);
      if (!orders.length) return fail("请选择订单");
      state.seq.wave += 1;
      const wave = { id: "w" + state.seq.wave, wave_no: seq("BC", state.seq.wave), warehouse: whName(),
        status: "released", creator: "当前用户", created_at: nowText() };
      state.waves.unshift(wave);
      const groups = {};
      orders.forEach((o) => { (groups[o.sku] = groups[o.sku] || []).push(o); });
      Object.keys(groups).forEach((sku) => {
        const list = groups[sku];
        state.seq.pick += 1;
        const lines = list.map((o, i) => ({
          line_id: "pk_" + state.seq.pick + "_" + i, location: recommendLoc(o.sku + o.order_no),
          sku: o.sku, name: o.name || o.sku, barcode: o.sku, qty: Number(o.qty), picked_qty: 0, uc: "", shortage: false,
        }));
        const pick = {
          id: "p" + state.seq.pick, ph_no: seq("PH", state.seq.pick), wave_id: wave.id, sku,
          qty: list.reduce((s, o) => s + Number(o.qty), 0), picked_qty: 0,
          type: list.length === 1 && list[0].qty === 1 ? "单件" : "多件",
          warehouse: whName(), status: "to_pick", picker: "", order_ids: list.map((o) => o.id), lines,
        };
        state.picks.unshift(pick);
        list.forEach((o) => { o.wave_id = wave.id; o.pick_id = pick.id; });
      });
      log(wave.wave_no, "下发波次"); emit();
      return { ok: true, message: "已下发 " + wave.wave_no };
    },
    cancelWave(id) {
      const wave = byId(state.waves, id);
      if (!wave) return fail("不存在");
      state.picks.filter((p) => p.wave_id === id).forEach((p) => { p.status = "cancelled"; });
      state.orders.forEach((o) => {
        if (o.wave_id === id) { o.wave_id = ""; o.pick_id = ""; if (o.status === "check_pending") o.status = "wait_out"; }
      });
      wave.status = "cancelled"; emit();
      return { ok: true, message: "已取消" };
    },

    advancePick(id) {
      const p = byId(state.picks, id);
      if (!p || p.status === "cancelled") return fail("不可推进");
      if (p.status === "to_pick") p.status = p.type === "单件" ? "picked" : "to_sort";
      else if (p.status === "to_sort") p.status = "picked";
      else return fail("当前不可推进");
      if (!p.picker) p.picker = "当前用户";
      if (p.status === "picked") {
        p.order_ids.forEach((oid) => {
          const o = byId(state.orders, oid);
          if (o && o.status === "wait_out") { o.status = "check_pending"; o.checked_qty = 0; }
        });
      }
      log(p.ph_no, "推进 → " + p.status); emit();
      return { ok: true, message: "已更新", data: p };
    },

    scanPickCode(pickId, code) {
      const p = byId(state.picks, pickId);
      if (!p || (p.status !== "to_pick" && p.status !== "to_sort")) return fail("配货单不可拣");
      let line = p.lines.find((l) => l.uc === code || l.sku === code || l.barcode === code);
      if (!line) {
        const unit = findUnit(code);
        if (unit) line = p.lines.find((l) => l.sku === unit.sku && Number(l.picked_qty) < Number(l.qty));
      }
      if (!line) return fail("与配货明细不符", "SKU_MISMATCH");
      if (Number(line.picked_qty) >= Number(line.qty)) return fail("该行已扫完");
      line.picked_qty = Number(line.picked_qty) + 1;
      p.picked_qty = p.lines.reduce((s, l) => s + Number(l.picked_qty), 0);
      if (!p.picker) p.picker = "当前用户";
      const unit = findUnit(code) || state.units.find((u) => u.sku === line.sku && u.status === "putaway" && u.pick_id === "");
      if (unit) { unit.status = "picked"; unit.pick_id = p.id; unit.order_id = p.order_ids[0] || ""; }
      pushLedger({ sku: line.sku, from_loc: line.location, op: "PDA配货", source_no: p.ph_no });
      log(p.ph_no, "拣货扫码 " + code); emit();
      return { ok: true, message: "已扫描", data: { pick: p, line } };
    },

    submitPick(pickId, opts) {
      opts = opts || {};
      const p = byId(state.picks, pickId);
      if (!p) return fail("不存在");
      const open = (p.lines || []).filter((l) => Number(l.picked_qty) < Number(l.qty) && !l.shortage);
      if (open.length && !opts.forceShortage) {
        return fail("还有 " + open.length + " 项未扫描", "PENDING");
      }
      if (open.length && opts.forceShortage) {
        open.forEach((l) => { l.shortage = true; });
        p.status = "shortage";
        log(p.ph_no, "主动缺货提交"); emit();
        return { ok: true, message: "已提交缺货", data: p };
      }
      return api.advancePick(pickId);
    },

    pickLine(id, location, sku, qty) {
      const p = byId(state.picks, id);
      if (!p) return fail("不存在");
      for (let i = 0; i < Number(qty); i++) {
        const r = api.scanPickCode(id, sku);
        if (!r.ok) return r;
      }
      return { ok: true, message: "已拣", data: { pick: p } };
    },

    revertPick(id) {
      const p = byId(state.picks, id);
      if (!p) return fail("不存在");
      if (p.status === "picked") p.status = p.type === "单件" ? "to_pick" : "to_sort";
      else if (p.status === "to_sort") p.status = "to_pick";
      else return fail("不能撤回");
      p.order_ids.forEach((oid) => {
        const o = byId(state.orders, oid);
        if (o && o.status === "check_pending") { o.status = "wait_out"; o.checked_qty = 0; }
      });
      emit();
      return { ok: true, message: "已撤回" };
    },
    shortagePick(id) {
      const p = byId(state.picks, id);
      if (!p) return fail("不存在");
      p.status = "shortage"; emit();
      return { ok: true, message: "缺货" };
    },
    resumePick(id) {
      const p = byId(state.picks, id);
      if (!p || p.status !== "shortage") return fail("不是缺货");
      p.status = "to_pick"; emit();
      return { ok: true, message: "已恢复" };
    },
    cancelPick(id) {
      const p = byId(state.picks, id);
      if (!p || p.status !== "to_pick") return fail("仅待配货可取消");
      p.status = "cancelled"; emit();
      return { ok: true, message: "已取消" };
    },

    checkOrder(id) {
      const o = byId(state.orders, id);
      if (!o || o.status !== "check_pending") return fail("仅待复核可复核");
      o.checked_qty = o.qty; o.status = "checked";
      log(o.order_no, "复核通过"); emit();
      return { ok: true, message: "已复核", data: o };
    },
    checkScan(id, sku) {
      const o = byId(state.orders, id);
      if (!o || o.status !== "check_pending") return fail("该订单非待复核订单", "BIZ");
      if (sku !== o.sku && sku !== o.package_no && sku !== o.order_no) {
        const unit = findUnit(sku);
        if (!unit || (unit.sku !== o.sku && unit.order_id !== o.id)) return fail("条码与订单不符", "SKU_MISMATCH");
      }
      o.checked_qty = Number(o.checked_qty || 0) + 1;
      if (o.checked_qty >= o.qty) o.status = "checked";
      emit();
      return { ok: true, message: o.status === "checked" ? "复核完成" : ("已核 " + o.checked_qty + "/" + o.qty), data: o };
    },
    scanCheckUc(uc) {
      const unit = findUnit(uc);
      let order = null;
      if (unit && unit.order_id) order = byId(state.orders, unit.order_id);
      if (!order) order = state.orders.find((o) => o.package_no === uc || o.order_no === uc || o.sku === uc);
      if (!order && unit) order = state.orders.find((o) => o.sku === unit.sku && o.status === "check_pending");
      if (!order) return fail("找不到对应订单", "NOT_FOUND");
      if (order.status !== "check_pending") return fail("该订单非待复核订单", "BIZ");
      const r = api.checkScan(order.id, uc);
      if (r.ok && unit) unit.status = "checked";
      return r.ok ? { ok: true, message: r.message, data: { order: r.data, unit } } : r;
    },
    uncheckOrder(id) {
      const o = byId(state.orders, id);
      if (!o || o.status !== "checked") return fail("仅已复核可反复核");
      o.status = "check_pending"; o.checked_qty = 0; emit();
      return { ok: true, message: "已反复核" };
    },
    cancelOrder(id) {
      const o = byId(state.orders, id);
      if (!o || o.status !== "wait_out" || o.wave_id) return fail("不能取消");
      o.status = "cancelled"; emit();
      return { ok: true, message: "已取消" };
    },
    restoreOrder(id) {
      const o = byId(state.orders, id);
      if (!o || o.status !== "cancelled") return fail("仅已取消可恢复");
      o.status = "wait_out"; emit();
      return { ok: true, message: "已恢复" };
    },

    /* 移位 */
    createMove() {
      state.seq.mv += 1;
      const m = { id: "mv" + state.seq.mv, mv_no: seq("TL", state.seq.mv), status: "open",
        from_loc: "", to_loc: "", lines: [], creator: "Admin", created_at: nowText(), done_at: "", qty: 0 };
      state.moves.unshift(m); emit();
      return { ok: true, data: m };
    },
    scanMoveFromLoc(mvId, loc) {
      const m = byId(state.moves, mvId);
      if (!m) return fail("任务不存在");
      m.from_loc = loc; emit();
      return { ok: true, data: m };
    },
    scanMoveUc(mvId, uc) {
      const m = byId(state.moves, mvId);
      if (!m) return fail("不存在");
      if (!m.from_loc) return fail("请先扫描下架库位");
      const unit = findUnit(uc);
      if (!unit) return fail("唯一码不存在");
      if (unit.location && unit.location !== m.from_loc) return fail("唯一码不在该库位");
      if (m.lines.some((l) => l.uc === uc)) return fail("已扫描");
      m.lines.push({ uc, sku: unit.sku, from: m.from_loc, qty: 1 });
      emit();
      return { ok: true, data: m };
    },
    scanMoveToLoc(mvId, loc) {
      const m = byId(state.moves, mvId);
      if (!m) return fail("不存在");
      m.to_loc = loc; emit();
      return { ok: true, data: m };
    },
    submitMove(mvId) {
      const m = byId(state.moves, mvId);
      if (!m) return fail("不存在");
      if (!m.lines.length) return fail("没有下架内容");
      if (!m.to_loc) return fail("请扫描目标库位");
      m.lines.forEach((l) => {
        const u = findUnit(l.uc);
        if (u) u.location = m.to_loc;
        l.to = m.to_loc;
        l.from = l.from || m.from_loc;
        pushLedger({ sku: l.sku, from_loc: l.from, to_loc: m.to_loc, op: "移位上架", source_no: m.mv_no });
      });
      m.status = "done";
      m.qty = m.lines.length;
      m.done_at = nowText();
      log(m.mv_no, "移位完成"); emit();
      return { ok: true, message: "移位已提交", data: m };
    },

    submitException(body) {
      if (!body || !body.type || !body.reason) return fail("请填写类型和说明");
      state.seq.ex += 1;
      const ex = { id: "ex" + state.seq.ex, type: body.type, doc_no: body.doc_no || "", sku: body.sku || "",
        qty: Number(body.qty) || 0, reason: body.reason, at: nowText(), status: "open" };
      state.exceptions.unshift(ex); emit();
      return { ok: true, message: "异常已提交", data: ex };
    },
    listExceptions() { return state.exceptions.slice(); },
    listStocktakes(status) { return state.stocktakes.filter((t) => !status || t.status === status); },
    startStocktake(id) {
      const t = byId(state.stocktakes, id);
      if (!t) return fail("不存在");
      t.status = "doing"; emit();
      return { ok: true, message: "盘点中", data: t };
    },
    countLine(id, location, sku, qty) {
      const t = byId(state.stocktakes, id);
      if (!t) return fail("不存在");
      const lineHit = t.lines.find((l) => l.location === location && (l.sku === sku || l.barcode === sku));
      if (!lineHit) {
        /* allow scan uc → sku */
        const unit = findUnit(sku);
        const hit = unit ? t.lines.find((l) => l.location === location && l.sku === unit.sku) : null;
        if (!hit) return fail("该库位下无此 SKU", "SKU_MISMATCH");
        hit.count_qty = Number(qty); t.drafted = true; t.status = "doing"; emit();
        return { ok: true, message: "已暂存", data: hit };
      }
      lineHit.count_qty = Number(qty); t.drafted = true; t.status = "doing"; emit();
      return { ok: true, message: "已暂存", data: lineHit };
    },
    saveStocktakeDraft(id) {
      const t = byId(state.stocktakes, id);
      if (!t) return fail("不存在");
      t.drafted = true; if (t.status === "open") t.status = "doing"; emit();
      return { ok: true, message: "已暂存", data: t };
    },
    submitStocktake(id) {
      const t = byId(state.stocktakes, id);
      if (!t) return fail("不存在");
      if (t.lines.some((l) => l.count_qty == null)) return fail("仍有未盘行");
      t.diff = t.lines.some((l) => Number(l.count_qty) !== Number(l.system_qty));
      t.status = "done";
      t.phase = t.diff ? "pending_submit" : "done";
      t.drafted = false;
      if (!t.diff) { t.audit_result = "none"; t.auditor = ""; }
      log(t.st_no, t.diff ? "盘点有差异，待提交审核" : "盘点完成");
      emit();
      return { ok: true, message: t.diff ? "有差异，已转入待提交供应链审核" : "盘点完成" };
    },

    createStocktake(body) {
      body = body || {};
      const method = body.method === "sku" ? "sku" : "zone";
      if (!body.type) return fail("请选择盘点类型");
      if (method === "sku" && !body.sku) return fail("请填写 SKU");
      if (method === "zone" && !body.zone) return fail("请填写库区");
      state.seq.st += 1;
      const n = state.seq.st;
      const lines = [];
      if (method === "sku") {
        const hits = state.units.filter((u) => u.sku === body.sku && u.location).slice(0, 8);
        if (hits.length) hits.forEach((u) => lines.push({ location: u.location, sku: u.sku, name: u.name, system_qty: 1, count_qty: null }));
        else lines.push({ location: "A-01-01", sku: body.sku, name: body.sku, system_qty: 1, count_qty: null });
      } else {
        for (let i = 1; i <= 6; i++) {
          lines.push({ location: body.zone + "-01-" + String(i).padStart(2, "0"), sku: skuOf(siteName(0), "STK", body.zone || "Zone", "M"), name: body.zone + " 盘点", system_qty: i, count_qty: null });
        }
      }
      const t = {
        id: "st" + n, st_no: seq("ST", n), warehouse: whName(), zone: body.zone || "",
        status: "open", phase: "count", type: body.type, method, source_no: body.source_no || "",
        diff: false, counter: "", remark: body.remark || "", creator: "Admin", created_at: nowText(),
        auditor: "", audit_result: "", qty: lines.reduce((s, l) => s + Number(l.system_qty), 0),
        drafted: false, title: body.type, lines,
      };
      state.stocktakes.unshift(t);
      log(t.st_no, "新建盘点 " + (method === "sku" ? "按SKU" : "按库区"));
      emit();
      return { ok: true, message: "已新建盘点任务", data: t };
    },
    assignStocktake(ids, counter) {
      if (!counter) return fail("请填写盘点人");
      const list = (ids || []).map((id) => byId(state.stocktakes, id)).filter(Boolean);
      const bad = list.filter((t) => t.phase !== "count");
      if (!list.length) return fail("请选择任务");
      if (bad.length) return fail("只能分配待盘点任务");
      list.forEach((t) => { t.counter = counter; });
      log(list.map((t) => t.st_no).join(","), "分配盘点人 " + counter);
      emit();
      return { ok: true, message: "已分配 " + list.length + " 单" };
    },
    cancelStocktake(ids) {
      const list = (ids || []).map((id) => byId(state.stocktakes, id)).filter(Boolean);
      if (!list.length) return fail("请选择任务");
      if (list.some((t) => t.phase === "done" || t.phase === "auditing")) return fail("审核中或已完成的任务不能取消");
      list.forEach((t) => { t.phase = "cancelled"; t.status = "cancelled"; });
      log(list.map((t) => t.st_no).join(","), "取消盘点");
      emit();
      return { ok: true, message: "已取消" };
    },
    submitStocktakeAudit(id) {
      const t = byId(state.stocktakes, id);
      if (!t) return fail("不存在");
      if (t.phase !== "pending_submit") return fail("只有待提交供应链审核的任务可以提交");
      t.phase = "auditing";
      t.auditor = "供应链-陈工";
      log(t.st_no, "提交供应链审核");
      emit();
      return { ok: true, message: "已提交审核" };
    },
    approveStocktake(id, result) {
      const t = byId(state.stocktakes, id);
      if (!t) return fail("不存在");
      if (t.phase !== "auditing") return fail("当前不在审核中");
      t.auditor = t.auditor || "供应链-陈工";
      if (result === "recount") {
        state.seq.st += 1;
        const n = state.seq.st;
        const child = {
          id: "st" + n, st_no: seq("ST", n), warehouse: t.warehouse, zone: t.zone,
          status: "open", phase: "count", type: t.type, method: t.method, source_no: t.st_no,
          diff: false, counter: t.counter, remark: "复盘", creator: "系统", created_at: nowText(),
          auditor: "", audit_result: "", qty: t.qty, drafted: false, title: "复盘 " + t.st_no,
          lines: (t.lines || []).map((l) => Object.assign({}, l, { count_qty: null })),
        };
        state.stocktakes.unshift(child);
        t.phase = "done";
        t.audit_result = "recount";
        log(t.st_no, "审批复盘，生成 " + child.st_no);
        emit();
        return { ok: true, message: "已发起复盘 " + child.st_no, data: child };
      }
      t.phase = "done";
      t.audit_result = "none";
      log(t.st_no, "审批无异议");
      emit();
      return { ok: true, message: "盘点完成" };
    },
    listInventory() {
      const map = {};
      function touch(sku, loc) {
        const key = sku + "\0" + (loc || "");
        if (!map[key]) {
          const p = skuParts(sku);
          map[key] = {
            sku: p.sku, skc: p.skc, spu: p.spu,
            total: 0, wait_putaway: 0, bin_qty: 0, reserved: 0, wait_ship: 0,
            warehouse: whName(), zone: zoneOf(loc), location: loc || "",
            cost: costOf(sku),
          };
        }
        return map[key];
      }
      (state.units || []).forEach((u) => {
        if (u.status === "qc_pass") touch(u.sku, u.recommend_location || "").wait_putaway += 1;
        else if (u.status === "putaway") touch(u.sku, u.location || "").bin_qty += 1;
        else if (u.status === "picked") touch(u.sku, u.location || "").reserved += 1;
        else if (u.status === "checked") touch(u.sku, u.location || "").wait_ship += 1;
      });
      return Object.keys(map).map((k) => {
        const r = map[k];
        r.total = r.wait_putaway + r.bin_qty + r.reserved + r.wait_ship;
        return r;
      }).sort((a, b) => (a.sku < b.sku ? -1 : a.sku > b.sku ? 1 : (a.location < b.location ? -1 : 1)));
    },
    listEmptySkus() {
      const has = {};
      api.listInventory().forEach((r) => { has[r.sku] = true; });
      const seen = {};
      (state.units || []).forEach((u) => { if (!has[u.sku]) seen[u.sku] = true; });
      return Object.keys(seen).map((sku) => {
        const p = skuParts(sku);
        return {
          sku: p.sku, skc: p.skc, spu: p.spu,
          total: 0, wait_putaway: 0, bin_qty: 0, reserved: 0, wait_ship: 0,
          warehouse: whName(), zone: "", location: "", cost: costOf(sku),
        };
      });
    },
    listPsi(date) {
      const day = date || "";
      const inbound = { "PDA上架": 1, "移位上架": 1 };
      const outbound = { "PDA配货": 1, "调拨发货": 1, "调拨配货": 1 };
      const money = (n) => Math.round(n * 100) / 100;
      const bins = {};
      function ensure(sku, loc, zone) {
        const key = sku + "\0" + (loc || "");
        if (!bins[key]) {
          const p = skuParts(sku);
          bins[key] = {
            sku: p.sku, skc: p.skc, spu: p.spu,
            zone: zone || zoneOf(loc), location: loc || "", cost: costOf(sku),
            open_qty: 0, in_qty: 0, out_qty: 0, close_qty: 0, lines: [],
          };
        } else if (zone) bins[key].zone = zone;
        return bins[key];
      }
      api.listInventory().forEach((r) => {
        if (r.bin_qty) ensure(r.sku, r.location).close_qty += r.bin_qty;
      });
      (state.ledger || []).forEach((l) => {
        const d = String(l.at || "").slice(0, 10);
        const qty = Number(l.qty) || 0;
        if (inbound[l.op] && l.to_loc) {
          const b = ensure(l.sku, l.to_loc, l.to_zone);
          if (d === day) { b.in_qty += qty; b.lines.push(l); }
          else if (day && d > day) b.close_qty -= qty;
        }
        if (outbound[l.op] && l.from_loc) {
          const b = ensure(l.sku, l.from_loc, l.from_zone);
          if (d === day) { b.out_qty += qty; b.lines.push(l); }
          else if (day && d > day) b.close_qty += qty;
        }
      });
      return Object.keys(bins).map((k) => {
        const b = bins[k];
        if (b.close_qty < 0) b.close_qty = 0;
        b.open_qty = b.close_qty - b.in_qty + b.out_qty;
        if (b.open_qty < 0) b.open_qty = 0;
        b.open_amt = money(b.open_qty * b.cost);
        b.in_amt = money(b.in_qty * b.cost);
        b.out_amt = money(b.out_qty * b.cost);
        b.close_amt = money(b.close_qty * b.cost);
        return b;
      }).filter((b) => b.open_qty || b.in_qty || b.out_qty || b.close_qty)
        .sort((a, b) => (a.sku < b.sku ? -1 : a.sku > b.sku ? 1 : (a.location < b.location ? -1 : 1)));
    },

    /** PDA 库位查询：SKU → 分布；唯一码 → 当前库位/状态 */
    queryLoc(code) {
      const c = String(code || "").trim();
      if (!c) return fail("请扫描 SKU 或唯一码");
      const unit = findUnit(c);
      if (unit) {
        return {
          ok: true,
          data: {
            type: "uc",
            unit: {
              uc: unit.uc, sku: unit.sku, status: unit.status,
              location: unit.location || "", recommend_location: unit.recommend_location || "",
              so_no: unit.so_no || "", pick_id: unit.pick_id || "",
            },
          },
        };
      }
      const exact = api.listInventory().filter((r) => r.sku === c);
      const rows = exact.length ? exact : api.listInventory().filter((r) => String(r.sku).indexOf(c) >= 0);
      if (!rows.length) return fail("未找到匹配的 SKU 或唯一码", "NOT_FOUND");
      return {
        ok: true,
        data: {
          type: "sku",
          sku: exact.length ? c : rows[0].sku,
          rows: rows.map((r) => ({
            sku: r.sku, location: r.location, zone: r.zone,
            total: r.total, wait_putaway: r.wait_putaway, bin_qty: r.bin_qty,
            reserved: r.reserved, wait_ship: r.wait_ship, warehouse: r.warehouse,
          })),
        },
      };
    },

    /** PDA 打印唯一码：锁库位后，每扫一次 SKU 生成 1 个 UC */
    printUcAtLocation(location, sku) {
      const loc = String(location || "").trim();
      const raw = String(sku || "").trim();
      if (!loc) return fail("请先扫描并锁定库位", "NEED_LOC");
      if (!raw) return fail("请扫描 SKU");
      if (!window.WMS_SKU) return fail("SKU 规则未加载");
      const parsed = WMS_SKU.parse(raw);
      if (!parsed.valid) return fail("SKU 格式须为 站点||SPU||色系||尺码");
      const skuStr = parsed.sku;
      let maxSeq = 0;
      state.units.forEach((u) => {
        if (u.sku !== skuStr) return;
        const p = WMS_SKU.parseUc(u.uc);
        if (p.valid) maxSeq = Math.max(maxSeq, p.seq);
      });
      const n = maxSeq + 1;
      const uc = WMS_SKU.buildUc(skuStr, n);
      const unit = {
        uc, sku: skuStr, name: skuStr, so_id: "", so_no: "",
        status: "putaway", location: loc, recommend_location: loc,
        order_id: "", pick_id: "", qc_reason: "", session: false,
      };
      state.units.push(unit);
      pushLedger({ sku: skuStr, to_loc: loc, op: "打印唯一码", source_no: uc, qty: 1 });
      log(uc, "打印唯一码 @ " + loc);
      emit();
      return { ok: true, message: "已生成并打印 " + uc, data: { unit, location: loc, seq: n } };
    },
  };

  return api;
})();
