/**
 * 统一数据入口。页面只调 WMS_API，禁止直连 localStorage / fetch 业务地址。
 * MockAdapter → flow.js；HttpAdapter → 真实后端（骨架，mode=api 时启用）。
 */
window.WMS_API = (function () {
  const C = () => window.WMS_CONFIG || {};

  function sessionGet(key) {
    try { return JSON.parse(localStorage.getItem(key) || "null"); } catch (e) { return null; }
  }
  function sessionSet(key, val) {
    if (val == null) localStorage.removeItem(key);
    else localStorage.setItem(key, JSON.stringify(val));
  }

  const Session = {
    getTenant() { return sessionGet(C().tenantStorageKey); },
    setTenant(t) { sessionSet(C().tenantStorageKey, t); },
    getToken() { return localStorage.getItem(C().tokenStorageKey) || ""; },
    setToken(tok) {
      if (!tok) localStorage.removeItem(C().tokenStorageKey);
      else localStorage.setItem(C().tokenStorageKey, tok);
    },
    getUser() { return sessionGet(C().userStorageKey); },
    setUser(u) { sessionSet(C().userStorageKey, u); },
    getWarehouse() { return sessionGet(C().warehouseStorageKey); },
    setWarehouse(w) { sessionSet(C().warehouseStorageKey, w); },
    clearAuth() {
      Session.setToken("");
      Session.setUser(null);
    },
  };

  function ok(data, message) {
    return { ok: true, data, message: message || "" };
  }

  /** —— Mock：租户/登录本地；业务转调 WMS_FLOW —— */
  const MockAdapter = {
    async listTenants() {
      return ok([
        { id: "t_demo", name: "影策演示租户", code: "DEMO" },
        { id: "t_test", name: "测试仓租户", code: "TEST" },
      ]);
    },
    async login({ tenantId, username, password }) {
      if (!tenantId) return { ok: false, message: "请选择租户" };
      if (!username || !password) return { ok: false, message: "请输入账号密码" };
      const tenants = (await this.listTenants()).data;
      const tenant = tenants.find((t) => t.id === tenantId);
      if (!tenant) return { ok: false, message: "租户不存在" };
      const token = "mock-" + tenantId + "-" + Date.now();
      Session.setTenant(tenant);
      Session.setToken(token);
      Session.setUser({ id: "u1", name: username, displayName: username === "pda" ? "仓管员" : username });
      if (!Session.getWarehouse()) {
        const orgWh = window.WMS_ORG && WMS_ORG.getWarehouses()[0];
        Session.setWarehouse({
          id: orgWh ? String(orgWh.id || orgWh.warehouse_code || "wh1") : "wh1",
          name: (window.WMS_ORG && WMS_ORG.warehouseName()) || "杭州一号仓",
        });
      } else if (window.WMS_ORG) {
        const cur = Session.getWarehouse();
        const name = WMS_ORG.warehouseName();
        if (cur && cur.name !== name) Session.setWarehouse(Object.assign({}, cur, { name }));
      }
      return { ok: true, message: "登录成功", data: { token, user: Session.getUser(), tenant } };
    },
    async logout() {
      Session.clearAuth();
      return { ok: true, message: "已退出" };
    },
    async me() {
      const user = Session.getUser();
      const tenant = Session.getTenant();
      if (!Session.getToken() || !user) return { ok: false, message: "未登录" };
      return ok({ user, tenant, warehouse: Session.getWarehouse() });
    },
    async listWarehouses() {
      const org = window.WMS_ORG && WMS_ORG.getWarehouses();
      if (org && org.length) {
        return ok(org.map((w) => ({
          id: String(w.id || w.warehouse_code),
          name: w.warehouse_name || w.name,
        })));
      }
      return ok([{ id: "wh1", name: "杭州一号仓" }]);
    },
    async setWarehouse(id) {
      const list = (await this.listWarehouses()).data;
      const w = list.find((x) => x.id === id);
      if (!w) return { ok: false, message: "仓库不存在" };
      Session.setWarehouse(w);
      return { ok: true, message: "已切换仓库", data: w };
    },

    async getState() { return ok(window.WMS_FLOW.get()); },
    async listReceiving(status) {
      return ok(window.WMS_FLOW.get().receiving.filter((r) => !status || r.status === status));
    },
    async listInbound(status) {
      return ok(window.WMS_FLOW.get().inbound.filter((r) => !status || r.status === status));
    },
    async listPutaway(status) {
      return ok(window.WMS_FLOW.get().putaway.filter((r) => !status || r.status === status));
    },
    async listPicks(status) {
      return ok(window.WMS_FLOW.get().picks.filter((r) => !status || r.status === status));
    },
    async listOrders(status) {
      return ok(window.WMS_FLOW.get().orders.filter((r) => !status || r.status === status));
    },
    async findReceivingByNo(soNo) {
      const hit = window.WMS_FLOW.get().receiving.find((r) => r.so_no === soNo);
      return hit ? ok(hit) : { ok: false, message: "收货单不存在" };
    },
    async findInboundByNo(rkNo) {
      const hit = window.WMS_FLOW.get().inbound.find((r) => r.rk_no === rkNo);
      return hit ? ok(hit) : { ok: false, message: "入库单不存在" };
    },
    async findPutawayByNo(sjNo) {
      const hit = window.WMS_FLOW.get().putaway.find((r) => r.sj_no === sjNo);
      return hit ? ok(hit) : { ok: false, message: "上架任务不存在" };
    },
    async findPickByNo(phNo) {
      const hit = window.WMS_FLOW.get().picks.find((r) => r.ph_no === phNo);
      return hit ? ok(hit) : { ok: false, message: "配货单不存在" };
    },
    async findOrderByNo(orderNo) {
      const hit = window.WMS_FLOW.get().orders.find((r) => r.order_no === orderNo);
      return hit ? ok(hit) : { ok: false, message: "出库单不存在" };
    },
    async getReceiving(id) {
      const hit = window.WMS_FLOW.get().receiving.find((r) => r.id === id);
      return hit ? ok(hit) : { ok: false, message: "收货单不存在" };
    },
    async getPick(id) {
      const hit = window.WMS_FLOW.get().picks.find((r) => r.id === id);
      return hit ? ok(hit) : { ok: false, message: "配货单不存在" };
    },
    async getStocktake(id) {
      const hit = window.WMS_FLOW.get().stocktakes.find((r) => r.id === id);
      return hit ? ok(hit) : { ok: false, message: "盘点任务不存在" };
    },

    async arrive(id) { return window.WMS_FLOW.arrive(id); },
    async confirmArrive(id) { return window.WMS_FLOW.confirmArrive(id); },
    async receive(id, qty, reason) { return window.WMS_FLOW.receive(id, qty, reason); },
    async receiveLine(id, sku, qty, reason) { return window.WMS_FLOW.receiveLine(id, sku, qty, reason); },
    async scanReceiveUc(soId, code) { return window.WMS_FLOW.scanReceiveUc(soId, code); },
    async clearReceiveSession(soId) { return window.WMS_FLOW.clearReceiveSession(soId); },
    async saveReceiveDraft(soId) { return window.WMS_FLOW.saveReceiveDraft(soId); },
    async commitReceive(soId, opts) { return window.WMS_FLOW.commitReceive(soId, opts); },
    async finishPartial(id, reason) { return window.WMS_FLOW.finishPartial(id, reason); },
    async unreceive(id, qty) { return window.WMS_FLOW.unreceive(id, qty); },
    async startQc(id) { return window.WMS_FLOW.startQc(id); },
    async scanQcUc(soId, uc, result, reason) { return window.WMS_FLOW.scanQcUc(soId, uc, result, reason); },
    async submitQc(id, passQty, failQty, repairQty) { return window.WMS_FLOW.submitQc(id, passQty, failQty, repairQty); },
    async submitQcForSo(soId) { return window.WMS_FLOW.submitQcForSo(soId); },
    async revertQc(id) { return window.WMS_FLOW.revertQc(id); },
    async confirmInbound(id) { return window.WMS_FLOW.confirmInbound(id); },
    async putaway(id, qty) { return window.WMS_FLOW.putaway(id, qty); },
    async putawayDo(id, body) { return window.WMS_FLOW.putawayDo(id, body); },
    async scanPutawayUc(uc) { return window.WMS_FLOW.scanPutawayUc(uc); },
    async scanPutawayLoc(uc, loc) { return window.WMS_FLOW.scanPutawayLoc(uc, loc); },
    async unputaway(id, qty) { return window.WMS_FLOW.unputaway(id, qty); },
    async advancePick(id) { return window.WMS_FLOW.advancePick(id); },
    async pickLine(id, location, sku, qty) { return window.WMS_FLOW.pickLine(id, location, sku, qty); },
    async scanPickCode(pickId, code) { return window.WMS_FLOW.scanPickCode(pickId, code); },
    async submitPick(pickId, opts) { return window.WMS_FLOW.submitPick(pickId, opts); },
    async revertPick(id) { return window.WMS_FLOW.revertPick(id); },
    async shortagePick(id) { return window.WMS_FLOW.shortagePick(id); },
    async resumePick(id) { return window.WMS_FLOW.resumePick(id); },
    async checkOrder(id) { return window.WMS_FLOW.checkOrder(id); },
    async checkScan(id, sku) { return window.WMS_FLOW.checkScan(id, sku); },
    async scanCheckUc(uc) { return window.WMS_FLOW.scanCheckUc(uc); },
    async uncheckOrder(id) { return window.WMS_FLOW.uncheckOrder(id); },
    async createMove() { return window.WMS_FLOW.createMove(); },
    async scanMoveFromLoc(id, loc) { return window.WMS_FLOW.scanMoveFromLoc(id, loc); },
    async scanMoveUc(id, uc) { return window.WMS_FLOW.scanMoveUc(id, uc); },
    async scanMoveToLoc(id, loc) { return window.WMS_FLOW.scanMoveToLoc(id, loc); },
    async submitMove(id) { return window.WMS_FLOW.submitMove(id); },
    async findUnit(uc) { return window.WMS_FLOW.findUnit(uc); },
    async listUnits(filter) { return ok(window.WMS_FLOW.listUnits(filter)); },
    async queryLoc(code) { return window.WMS_FLOW.queryLoc(code); },
    async printUcAtLocation(location, sku) { return window.WMS_FLOW.printUcAtLocation(location, sku); },
    async submitException(body) { return window.WMS_FLOW.submitException(body); },
    async listExceptions() { return ok(window.WMS_FLOW.listExceptions()); },
    async listStocktakes(status) { return ok(window.WMS_FLOW.listStocktakes(status)); },
    async startStocktake(id) { return window.WMS_FLOW.startStocktake(id); },
    async countLine(id, location, sku, qty) { return window.WMS_FLOW.countLine(id, location, sku, qty); },
    async saveStocktakeDraft(id) { return window.WMS_FLOW.saveStocktakeDraft(id); },
    async submitStocktake(id) { return window.WMS_FLOW.submitStocktake(id); },
    async resetDemo() { return window.WMS_FLOW.reset(); },
  };

  /** —— Http：上线替换；方法签名与 Mock 保持一致 —— */
  const HttpAdapter = {
    async request(path, { method = "GET", body, query } = {}) {
      const cfg = C();
      let url = (cfg.apiBaseUrl || "").replace(/\/$/, "") + path;
      if (query) {
        const clean = {};
        Object.keys(query).forEach((k) => {
          if (query[k] != null && query[k] !== "") clean[k] = query[k];
        });
        const qs = new URLSearchParams(clean).toString();
        if (qs) url += (url.includes("?") ? "&" : "?") + qs;
      }
      const headers = { "Content-Type": "application/json" };
      const tenant = Session.getTenant();
      const token = Session.getToken();
      const warehouse = Session.getWarehouse();
      if (tenant && tenant.id) headers[cfg.tenantHeader || "X-Tenant-Id"] = tenant.id;
      if (token) headers[cfg.authHeader || "Authorization"] = "Bearer " + token;
      if (warehouse && warehouse.id) headers[cfg.warehouseHeader || "X-Warehouse-Id"] = warehouse.id;
      let res;
      try {
        res = await fetch(url, {
          method,
          headers,
          body: body != null ? JSON.stringify(body) : undefined,
        });
      } catch (e) {
        return { ok: false, message: "网络异常，请重试" };
      }
      if (res.status === 401) {
        Session.clearAuth();
        return { ok: false, message: "登录已过期", code: 401 };
      }
      let payload = null;
      try { payload = await res.json(); } catch (e) { payload = null; }
      if (!res.ok) {
        return { ok: false, message: (payload && payload.message) || ("HTTP " + res.status), data: payload };
      }
      if (payload && typeof payload.ok === "boolean") return payload;
      return { ok: true, data: payload };
    },
    async listTenants() { return this.request("/api/v1/tenants"); },
    async login(body) {
      const r = await this.request("/api/v1/auth/login", { method: "POST", body });
        if (r.ok && r.data) {
        Session.setToken(r.data.token);
        Session.setUser(r.data.user);
        Session.setTenant(r.data.tenant);
        if (r.data.warehouse) Session.setWarehouse(r.data.warehouse);
      }
      return r;
    },
    async logout() {
      try { await this.request("/api/v1/auth/logout", { method: "POST" }); } catch (e) { /* ignore */ }
      Session.clearAuth();
      return { ok: true, message: "已退出" };
    },
    async me() { return this.request("/api/v1/auth/me"); },
    async listWarehouses() { return this.request("/api/v1/warehouses"); },
    async setWarehouse(id) {
      const r = await this.request("/api/v1/me/warehouse", { method: "PUT", body: { warehouseId: id } });
      if (r.ok && r.data) Session.setWarehouse(r.data);
      return r;
    },
    async getState() { return this.request("/api/v1/wms/snapshot"); },
    async listReceiving(status) { return this.request("/api/v1/receiving", { query: { status } }); },
    async listInbound(status) { return this.request("/api/v1/inbound", { query: { status } }); },
    async listPutaway(status) { return this.request("/api/v1/putaway", { query: { status } }); },
    async listPicks(status) { return this.request("/api/v1/picks", { query: { status } }); },
    async listOrders(status) { return this.request("/api/v1/outbound-orders", { query: { status } }); },
    async findReceivingByNo(soNo) { return this.request("/api/v1/receiving/by-no/" + encodeURIComponent(soNo)); },
    async findInboundByNo(rkNo) { return this.request("/api/v1/inbound/by-no/" + encodeURIComponent(rkNo)); },
    async findPutawayByNo(sjNo) { return this.request("/api/v1/putaway/by-no/" + encodeURIComponent(sjNo)); },
    async findPickByNo(phNo) { return this.request("/api/v1/picks/by-no/" + encodeURIComponent(phNo)); },
    async findOrderByNo(orderNo) { return this.request("/api/v1/outbound-orders/by-no/" + encodeURIComponent(orderNo)); },
    async getReceiving(id) { return this.request("/api/v1/receiving/" + encodeURIComponent(id)); },
    async getPick(id) { return this.request("/api/v1/picks/" + encodeURIComponent(id)); },
    async getStocktake(id) { return this.request("/api/v1/stocktakes/" + encodeURIComponent(id)); },
    async arrive(id) { return this.request("/api/v1/receiving/" + id + "/arrive", { method: "POST" }); },
    async confirmArrive(id) { return this.arrive(id); },
    async receive(id, qty, reason) { return this.request("/api/v1/receiving/" + id + "/receive", { method: "POST", body: { qty, reason } }); },
    async receiveLine(id, sku, qty, reason) {
      return this.request("/api/v1/receiving/" + id + "/receive-line", { method: "POST", body: { sku, qty, reason } });
    },
    async scanReceiveUc(id, code) { return this.request("/api/v1/receiving/" + id + "/scan", { method: "POST", body: { code } }); },
    async clearReceiveSession(id) { return this.request("/api/v1/receiving/" + id + "/scan/clear", { method: "POST" }); },
    async saveReceiveDraft(id) { return this.request("/api/v1/receiving/" + id + "/draft", { method: "POST" }); },
    async commitReceive(id, opts) { return this.request("/api/v1/receiving/" + id + "/commit", { method: "POST", body: opts || {} }); },
    async finishPartial(id, reason) {
      return this.request("/api/v1/receiving/" + id + "/finish-partial", { method: "POST", body: { reason } });
    },
    async unreceive(id, qty) { return this.request("/api/v1/receiving/" + id + "/unreceive", { method: "POST", body: { qty } }); },
    async startQc(id) { return this.request("/api/v1/inbound/" + id + "/qc/start", { method: "POST" }); },
    async scanQcUc(id, uc, result, reason) {
      return this.request("/api/v1/receiving/" + id + "/qc/scan", { method: "POST", body: { uc, result, reason: reason || "" } });
    },
    async submitQc(id, passQty, failQty, repairQty) {
      return this.request("/api/v1/inbound/" + id + "/qc/submit", { method: "POST", body: { passQty, failQty, repairQty } });
    },
    async submitQcForSo(id) { return this.request("/api/v1/receiving/" + id + "/qc/submit", { method: "POST" }); },
    async revertQc(id) { return this.request("/api/v1/inbound/" + id + "/qc/revert", { method: "POST" }); },
    async confirmInbound(id) { return this.request("/api/v1/inbound/" + id + "/confirm", { method: "POST" }); },
    async putaway(id, qty) { return this.request("/api/v1/putaway/" + id + "/do", { method: "POST", body: { qty } }); },
    async putawayDo(id, body) { return this.request("/api/v1/putaway/" + id + "/do", { method: "POST", body }); },
    async scanPutawayUc(uc) { return this.request("/api/v1/putaway/scan-uc", { method: "POST", body: { uc } }); },
    async scanPutawayLoc(uc, location) { return this.request("/api/v1/putaway/scan-loc", { method: "POST", body: { uc, location } }); },
    async unputaway(id, qty) { return this.request("/api/v1/putaway/" + id + "/undo", { method: "POST", body: { qty } }); },
    async advancePick(id) { return this.request("/api/v1/picks/" + id + "/advance", { method: "POST" }); },
    async pickLine(id, location, sku, qty) {
      return this.request("/api/v1/picks/" + id + "/pick-line", { method: "POST", body: { location, sku, qty } });
    },
    async scanPickCode(id, code) { return this.request("/api/v1/picks/" + id + "/scan", { method: "POST", body: { code } }); },
    async submitPick(id, opts) { return this.request("/api/v1/picks/" + id + "/submit", { method: "POST", body: opts || {} }); },
    async revertPick(id) { return this.request("/api/v1/picks/" + id + "/revert", { method: "POST" }); },
    async shortagePick(id) { return this.request("/api/v1/picks/" + id + "/shortage", { method: "POST" }); },
    async resumePick(id) { return this.request("/api/v1/picks/" + id + "/resume", { method: "POST" }); },
    async checkOrder(id) { return this.request("/api/v1/outbound-orders/" + id + "/check", { method: "POST" }); },
    async checkScan(id, sku) {
      return this.request("/api/v1/outbound-orders/" + id + "/check-scan", { method: "POST", body: { sku } });
    },
    async scanCheckUc(uc) { return this.request("/api/v1/checks/scan", { method: "POST", body: { uc } }); },
    async uncheckOrder(id) { return this.request("/api/v1/outbound-orders/" + id + "/uncheck", { method: "POST" }); },
    async createMove() { return this.request("/api/v1/moves", { method: "POST" }); },
    async scanMoveFromLoc(id, location) { return this.request("/api/v1/moves/" + id + "/from-loc", { method: "POST", body: { location } }); },
    async scanMoveUc(id, uc) { return this.request("/api/v1/moves/" + id + "/units", { method: "POST", body: { uc } }); },
    async scanMoveToLoc(id, location) { return this.request("/api/v1/moves/" + id + "/to-loc", { method: "POST", body: { location } }); },
    async submitMove(id) { return this.request("/api/v1/moves/" + id + "/submit", { method: "POST" }); },
    async findUnit(uc) { return this.request("/api/v1/units/by-uc/" + encodeURIComponent(uc)); },
    async listUnits(filter) { return this.request("/api/v1/units", { query: filter || {} }); },
    async queryLoc(code) { return this.request("/api/v1/inventory/query-loc", { method: "POST", body: { code } }); },
    async printUcAtLocation(location, sku) {
      return this.request("/api/v1/units/print", { method: "POST", body: { location, sku } });
    },
    async submitException(body) { return this.request("/api/v1/exceptions", { method: "POST", body }); },
    async listExceptions() { return this.request("/api/v1/exceptions"); },
    async listStocktakes(status) { return this.request("/api/v1/stocktakes", { query: { status } }); },
    async startStocktake(id) { return this.request("/api/v1/stocktakes/" + id + "/start", { method: "POST" }); },
    async countLine(id, location, sku, qty) {
      return this.request("/api/v1/stocktakes/" + id + "/count", { method: "POST", body: { location, sku, qty } });
    },
    async saveStocktakeDraft(id) { return this.request("/api/v1/stocktakes/" + id + "/draft", { method: "POST" }); },
    async submitStocktake(id) { return this.request("/api/v1/stocktakes/" + id + "/submit", { method: "POST" }); },
    async resetDemo() { return { ok: false, message: "生产环境不支持重置演示数据" }; },
  };

  function adapter() {
    return C().mode === "api" ? HttpAdapter : MockAdapter;
  }

  return new Proxy({}, {
    get(_, prop) {
      if (prop === "Session") return Session;
      if (prop === "mode") return C().mode || "mock";
      const ad = adapter();
      const fn = ad[prop];
      if (typeof fn === "function") return fn.bind(ad);
      return fn;
    },
  });
})();
