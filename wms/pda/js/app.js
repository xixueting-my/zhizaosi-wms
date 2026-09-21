/**
 * WMS PDA — 严格按需求原型（岗位流水线 + 唯一码）
 */
(function () {
  const API = () => window.WMS_API;
  const $ = (s, r) => (r || document).querySelector(s);
  const $$ = (s, r) => Array.from((r || document).querySelectorAll(s));
  const root = () => $("#app");

  let session = null;
  let meCache = null;
  let errMsg = "";

  function hash() {
    const raw = (location.hash || "#/home").replace(/^#\/?/, "");
    const [path, qs] = raw.split("?");
    const parts = path.split("/").filter(Boolean);
    const query = {};
    (qs || "").split("&").filter(Boolean).forEach((p) => {
      const [k, v] = p.split("=");
      query[decodeURIComponent(k)] = decodeURIComponent(v || "");
    });
    return { name: parts[0] || "home", id: parts[1] || "", query };
  }
  function go(path) {
    const p = path.startsWith("/") ? path : "/" + path;
    if (location.hash === "#" + p) route();
    else location.hash = p;
  }
  function esc(s) {
    return String(s == null ? "" : s).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;");
  }
  function layer() { return document.querySelector(".device-screen") || document.body; }
  function copyBtn(text) {
    if (!text) return "—";
    return `<button type="button" class="copy" data-copy="${esc(text)}">${esc(text)}</button>`;
  }
  function writeCopy(text) {
    const t = String(text || "").replace(/\s+/g, " ").trim();
    if (!t || t === "—" || t === "暂无" || t === "暂无任务") return;
    const ta = document.createElement("textarea");
    ta.value = t;
    ta.setAttribute("readonly", "");
    ta.style.position = "absolute";
    ta.style.left = "-9999px";
    layer().appendChild(ta);
    ta.select();
    let ok = false;
    try { ok = document.execCommand("copy"); } catch (e) { ok = false; }
    ta.remove();
    if (ok) { toast("已复制", "ok"); return; }
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(t).then(() => toast("已复制", "ok"), () => toast("复制失败", "err"));
      return;
    }
    toast("复制失败", "err");
  }
  function lightbox(html) {
    const mask = document.createElement("div");
    mask.className = "lightbox";
    mask.innerHTML = `<div class="sheet">${html}<button type="button" class="btn btn-primary lb-close">关闭</button></div>`;
    mask.addEventListener("click", (e) => { if (e.target === mask) mask.remove(); });
    layer().appendChild(mask);
    $(".lb-close", mask).onclick = () => mask.remove();
  }
  function bindCopy() {
    $$("[data-copy]").forEach((b) => {
      b.onclick = async (e) => {
        e.stopPropagation();
        writeCopy(b.getAttribute("data-copy") || "");
      };
    });
  }
  function sizeOfSku(sku) {
    if (window.WMS_SKU) {
      const p = WMS_SKU.parse(sku);
      if (p.valid && p.size) return p.size;
    }
    const parts = String(sku || "").split("||");
    if (parts.length >= 4) return parts[3];
    const m = String(sku || "").match(/\|\|([^|]+)\|\|/);
    return m ? m[1] : "";
  }
  function taskTable(headers, rows, opts) {
    const o = opts || {};
    return `<div class="tbl-wrap"><table class="tbl tbl-list"><thead><tr>${headers.map((h, i) => {
      const cls = (o.numCols && o.numCols.indexOf(i) >= 0) ? " class=\"num\""
        : (o.opsCol === i || h === "操作") ? " class=\"ops\"" : "";
      return `<th${cls}>${h}</th>`;
    }).join("")}</tr></thead>
      <tbody>${rows.join("") || `<tr><td colspan="${headers.length}">暂无任务</td></tr>`}</tbody></table></div>`;
  }
  function sizeChartHtml(active) {
    const rows = [
      ["XS", "78", "60", "84", "86"], ["S", "82", "64", "88", "88"], ["M", "86", "68", "92", "90"],
      ["L", "90", "72", "96", "92"], ["XL", "94", "76", "100", "93"], ["2XL", "100", "82", "106", "94"],
      ["3XL", "106", "88", "112", "95"], ["4XL", "112", "94", "118", "96"],
    ];
    const table = `<table class="tbl"><thead><tr><th>尺码</th><th>胸围</th><th>腰围</th><th>臀围</th><th>衣长</th></tr></thead><tbody>
        ${rows.map((r) => `<tr class="${r[0] === active ? "on" : ""}"><td>${r[0]}</td><td>${r[1]}</td><td>${r[2]}</td><td>${r[3]}</td><td>${r[4]}</td></tr>`).join("")}
      </tbody></table>`;
    return `<div class="std-card zoomable" id="sizeCard" data-zoom="size">
      <div class="hd"><span>尺码表</span></div>
      <div class="tbl-wrap">${table}</div>
      <div class="section-title">公差 ±1.5cm · 当前高亮 ${active || "—"}</div>
    </div>
    <div class="std-card">
      <div class="hd"><span>样衣图片</span></div>
      <div class="sample-row">
        <button type="button" class="ph" data-sample="正面">正面</button>
        <button type="button" class="ph" data-sample="背面">背面</button>
        <button type="button" class="ph" data-sample="细节">细节</button>
      </div>
    </div>`;
  }
  function toast(msg, type) {
    const wrap = $("#toasts"); if (!wrap) return;
    const el = document.createElement("div");
    el.className = "toast" + (type === "ok" ? " ok" : type === "err" ? " err" : "");
    el.textContent = msg; wrap.appendChild(el);
    setTimeout(() => el.remove(), 1800);
  }
  function modal({ title, message, html, okText, cancelText }) {
    return new Promise((resolve) => {
      const mask = document.createElement("div");
      mask.className = "modal-mask";
      mask.innerHTML = `<div class="modal">
        <div class="m-hd"><span class="warn">⚠</span>${esc(title || "提示")}</div>
        <div class="m-msg">${html || esc(message || "")}</div>
        <div class="m-actions">
          ${cancelText ? `<button type="button" class="cancel">${esc(cancelText)}</button>` : ""}
          <button type="button" class="ok">${esc(okText || "确定")}</button>
        </div></div>`;
      layer().appendChild(mask);
      const done = (v) => { mask.remove(); resolve(v); };
      $(".ok", mask).onclick = () => done(true);
      const c = $(".cancel", mask); if (c) c.onclick = () => done(false);
    });
  }
  function showErr(msg) { errMsg = msg || ""; const b = $("#errBanner"); if (b) { b.textContent = errMsg; b.classList.toggle("show", !!errMsg); } }
  function clearErr() { showErr(""); }

  function header(title, back) {
    const wh = (meCache && meCache.warehouse && meCache.warehouse.name)
      || (window.WMS_ORG && WMS_ORG.warehouseName())
      || "杭州一号仓";
    const user = (meCache && meCache.user && (meCache.user.name || meCache.user.displayName)) || "pda";
    return `<header class="pda-header">
      ${back !== false ? `<button type="button" class="back" id="btnBack">‹</button>` : ""}
      <div class="title">${esc(title)}</div>
      <div class="hdr-meta">
        <span class="tag-test">测试</span>
        <span class="wh">${esc(wh)}</span>
        <span class="user">${esc(user)}</span>
      </div>
    </header>`;
  }
  function errBanner() { return `<div class="err-banner ${errMsg ? "show" : ""}" id="errBanner">${esc(errMsg)}</div>`; }
  function scanField({ id, label, placeholder, value, boxClass, labClass }) {
    return `<div class="scan-field" id="${id || ""}Wrap">
      <div class="lab ${labClass || ""}"><span class="ico">▦</span>${esc(label)}</div>
      <div class="scan-box ${boxClass || ""}">
        <input id="${id || "scanInput"}" type="text" enterkeyhint="done" autocomplete="off"
          placeholder="${esc(placeholder || "")}" value="${esc(value || "")}" />
        <button type="button" class="scan-btn" data-scan="${id || "scanInput"}">扫码</button>
      </div>
    </div>`;
  }
  function bindScan(inputId, handler) {
    const input = $("#" + (inputId || "scanInput"));
    if (!input) return;
    const run = async () => {
      const v = (input.value || "").trim();
      if (!v) { showErr("请扫描或输入后再点扫码"); return; }
      clearErr();
      input.disabled = true;
      try { await handler(v, input); } finally { input.disabled = false; focusInput(inputId); }
    };
    $$('[data-scan="' + (inputId || "scanInput") + '"]').forEach((b) => { b.onclick = run; });
    input.onkeydown = (e) => { if (e.key === "Enter") { e.preventDefault(); run(); } };
    focusInput(inputId);
  }
  function focusInput(id) {
    const input = $("#" + (id || "scanInput"));
    if (!input) return;
    setTimeout(() => { try { input.focus(); input.select(); } catch (e) {} }, 50);
  }
  function foot(html) { return `<div class="foot-bar">${html}</div>`; }
  function wireBack(to) {
    const b = $("#btnBack");
    if (b) b.onclick = () => { if (typeof to === "function") to(); else go(to || "/home"); };
  }

  async function route() {
    const r = hash();
    errMsg = "";
    document.querySelectorAll(".modal-mask").forEach((el) => el.remove());
    if (r.name === "tenant") return viewTenant();
    if (r.name === "login") return viewLogin();
    const me = await API().me();
    if (!me.ok) return go("/login");
    meCache = me.data;
    if (me.data && me.data.warehouse) API().Session.setWarehouse(me.data.warehouse);
    if (r.name === "warehouse") return viewWarehouse();
    if (!API().Session.getWarehouse()) return go("/warehouse");
    if (!session || session.module !== r.name) session = { module: r.name, step: "entry", doc: null, draft: {} };
    document.body.classList.remove("wide");
    if (r.name === "settings") return viewSettings();
    const map = {
      arrive: jobArrive, receive: jobReceive, qc: jobQc, putaway: jobPutaway,
      pick: jobPick, sort: jobSort, check: jobCheck, stocktake: jobStocktake,
      move: jobMove, exception: jobException,
      locquery: jobLocQuery, printuc: jobPrintUc,
    };
    if (map[r.name]) return map[r.name]();
    return viewHome();
  }

  async function viewTenant() {
    const list = (await API().listTenants()).data || [];
    root().innerHTML = `<div class="auth-wrap"><div class="hello">您好！</div><div class="welcome">欢迎使用织造司PDA</div>
      <div class="sub">选择租户</div>
      ${list.map((t) => `<button class="btn-block" style="margin-bottom:10px" data-tid="${esc(t.id)}">${esc(t.name)}</button>`).join("")}</div>`;
    $$("[data-tid]").forEach((b) => b.onclick = () => { sessionStorage.setItem("pda_tenant", b.dataset.tid); go("/login"); });
  }
  async function viewLogin() {
    const tenants = (await API().listTenants()).data || [];
    const pick = sessionStorage.getItem("pda_tenant") || (tenants[0] && tenants[0].id) || "";
    root().innerHTML = `<div class="auth-wrap login-page">
      <div class="hello">您好！</div>
      <div class="welcome">欢迎使用织造司PDA</div>
      <div class="logo-mark" aria-hidden="true">织</div>
      <div class="field"><label>租户</label><select id="tenant">${tenants.map((t) =>
        `<option value="${esc(t.id)}" ${t.id===pick?"selected":""}>${esc(t.name)}</option>`).join("")}</select></div>
      <div class="field field-icon"><span class="fi">👤</span><input id="user" placeholder="请输入手机号/用户名/邮箱" value="pda" /></div>
      <div class="field field-icon"><span class="fi">🔒</span><input id="pwd" type="password" placeholder="请输入密码" value="pda123" />
        <button type="button" class="eye" id="eye" aria-label="显示密码">👁</button></div>
      <button class="btn-block" id="login">登录</button>
    </div>`;
    $("#eye").onclick = () => {
      const i = $("#pwd");
      i.type = i.type === "password" ? "text" : "password";
    };
    $("#login").onclick = async () => {
      const res = await API().login({ tenantId: $("#tenant").value, username: $("#user").value.trim(), password: $("#pwd").value });
      if (res.ok) { toast("登录成功", "ok"); go("/warehouse"); } else toast(res.message || "失败", "err");
    };
  }
  async function viewWarehouse() {
    const whs = (await API().listWarehouses()).data || [];
    const cur = API().Session.getWarehouse() || {};
    const q = (session && session.draft && session.draft.whQ) || "";
    const tab = (session && session.draft && session.draft.whTab) || "local";
    const list = whs.filter((w) => {
      if (tab === "overseas") return false;
      if (!q) return true;
      return String(w.name || "").toLowerCase().indexOf(q.toLowerCase()) >= 0;
    });
    root().innerHTML = `${header("选择仓库", false)}<div class="pda-body no-foot">
      <div class="wh-tabs">
        <button type="button" class="wh-tab ${tab==="local"?"on":""}" data-tab="local">本地仓</button>
        <button type="button" class="wh-tab ${tab==="overseas"?"on":""}" data-tab="overseas">自建海外仓</button>
      </div>
      <div class="wh-search"><input id="whQ" placeholder="搜索仓库" value="${esc(q)}" /></div>
      <div class="wh-list">
        ${list.map((w) => `<button type="button" class="wh-item ${w.id===cur.id?"on":""}" data-id="${esc(w.id)}">
          <span>${esc(w.name)}</span><span class="chev">›</span></button>`).join("")
          || `<div class="empty"><div class="et">${tab==="overseas"?"暂无海外仓":"暂无仓库"}</div></div>`}
      </div>
    </div>`;
    if (!session) session = { module: "warehouse", step: "entry", doc: null, draft: {} };
    session.module = "warehouse";
    $$("[data-tab]").forEach((b) => b.onclick = () => {
      session.draft = session.draft || {};
      session.draft.whTab = b.dataset.tab;
      viewWarehouse();
    });
    $("#whQ").oninput = () => {
      session.draft = session.draft || {};
      session.draft.whQ = $("#whQ").value.trim();
    };
    $("#whQ").onkeydown = (e) => { if (e.key === "Enter") viewWarehouse(); };
    $$("[data-id]").forEach((b) => b.onclick = async () => {
      const res = await API().setWarehouse(b.dataset.id);
      if (!res.ok) { toast(res.message || "切换失败", "err"); return; }
      meCache = Object.assign({}, meCache || {}, { warehouse: res.data });
      toast("已选择 " + (res.data && res.data.name), "ok");
      go("/home");
    });
  }
  function viewHome() {
    const tiles = [
      ["arrive","到货","到货确认"],["receive","收货","唯一码收货"],["qc","质检","合格/不合格"],
      ["putaway","上架","唯一码上架"],["pick","配货","配货详情"],["check","复核","唯一码复核"],
      ["stocktake","盘点","库位盘点"],["move","移位","移位下架"],["exception","异常","异常上报"],
      ["locquery","库位","库位查询"],["printuc","打印","打印唯一码"],
    ];
    const u = meCache.user || {};
    const wh = meCache.warehouse || {};
    root().innerHTML = `<div class="home-hero">
      <div class="wh">${esc(wh.name||"")} · ${esc((meCache.tenant&&meCache.tenant.name)||"")}</div>
      <div class="hi">${esc(u.displayName||u.name||"仓管员")}</div>
      <div class="role-hint">织造司 PDA · 各岗位独立流水线</div></div>
      <div class="grid">${tiles.map(([id,n,s]) =>
        `<button class="tile" data-go="/${id}"><div class="ico">${n[0]}</div><div class="tn">${n}</div><div class="ts">${s}</div></button>`
      ).join("")}</div>
      <div class="home-actions">
        <button type="button" class="btn" data-go="/warehouse">切换仓库</button>
        <button type="button" class="btn" data-go="/settings">设置</button>
      </div>`;
    $$("[data-go]").forEach((el) => el.onclick = () => go(el.dataset.go));
  }
  async function viewSettings() {
    const whs = (await API().listWarehouses()).data || [];
    const cur = meCache.warehouse || {};
    const cfg = window.WMS_CONFIG || {};
    const mode = cfg.mode === "api" ? "api" : "mock";
    root().innerHTML = `${header("设置")}<div class="pda-body no-foot">
      <div class="field"><label>仓库</label><select id="wh">${whs.map((w)=>
        `<option value="${esc(w.id)}" ${w.id===cur.id?"selected":""}>${esc(w.name)}</option>`).join("")}</select></div>
      <div class="field"><label>数据来源</label><select id="mode">
        <option value="mock" ${mode==="mock"?"selected":""}>演示数据</option>
        <option value="api" ${mode==="api"?"selected":""}>对接 WMS</option>
      </select></div>
      <div class="field"><label>后台地址</label><input id="base" placeholder="https://wms.example.com" value="${esc(cfg.apiBaseUrl||"")}" /></div>
      <div class="section-title">对接时按 docs/plans/2026-09-21-wms-pda-api.md 联调。保存后会重新进入登录。</div>
      <button class="btn-block" id="save">保存</button>
      ${mode==="mock"?`<button class="btn-block" id="reset" style="margin-top:10px;background:#fff;color:var(--primary);border:1px solid var(--primary)">重置演示数据</button>`:""}
      <button class="btn-block" id="out" style="margin-top:10px;background:#fff;color:#e85a6b;border:1px solid #e85a6b">退出</button>
    </div>`;
    wireBack("/home");
    $("#save").onclick = async () => {
      const nextMode = $("#mode").value === "api" ? "api" : "mock";
      const base = ($("#base").value || "").trim().replace(/\/$/, "");
      if (nextMode === "api" && !base) { toast("对接 WMS 时请填写后台地址", "err"); return; }
      await API().setWarehouse($("#wh").value);
      localStorage.setItem("wms_pda_mode", nextMode);
      localStorage.setItem("wms_pda_api_base", base);
      window.WMS_CONFIG.mode = nextMode;
      window.WMS_CONFIG.apiBaseUrl = base;
      await API().logout();
      location.reload();
    };
    const reset = $("#reset");
    if (reset) reset.onclick = async () => { if (await modal({title:"重置",message:"清空本地演示进度",okText:"重置",cancelText:"取消"})) { await API().resetDemo(); toast("已重置","ok"); } };
    $("#out").onclick = async () => { await API().logout(); go("/login"); };
  }

  async function loadList(method, arg) {
    const r = await API()[method](arg);
    if (!r || !r.ok) {
      showErr((r && r.message) || "加载失败");
      return [];
    }
    return r.data || [];
  }
  async function loadOne(method, id) {
    const r = await API()[method](id);
    if (!r || !r.ok) {
      showErr((r && r.message) || "单据不存在");
      return null;
    }
    return r.data;
  }

  /* —— 到货确认 —— */
  async function jobArrive() {
    const receiving = await loadList("listReceiving");
    if (session.step === "preview" && session.doc) {
      const so = session.doc;
      root().innerHTML = `${header("到货确认")}<div class="pda-body">
        ${errBanner()}
        ${scanField({ id: "scanInput", label: "收货单号扫描", value: so.so_no, placeholder: "请扫描收货单号" })}
        <div class="info-card">
          <div class="hd"><span>订单信息</span><span class="badge warn">待到货</span></div>
          <div class="row"><span class="k">收货单号</span><span class="v">${copyBtn(so.so_no)}</span></div>
          <div class="row"><span class="k">采购单号</span><span class="v">${esc(so.po_no)}</span></div>
          <div class="row"><span class="k">工厂</span><span class="v">${esc(so.factory)}</span></div>
          <div class="row"><span class="k">送货件数</span><span class="v">${so.ship_qty} 件</span></div>
          <div class="row"><span class="k">发货时间</span><span class="v">${esc(so.ship_time)}</span></div>
        </div></div>
        ${foot(`<button class="btn btn-ghost" id="clear">清空</button><button class="btn btn-primary" id="ok">确认到货</button>`)}`;
      wireBack("/home");
      $("#clear").onclick = () => { session.step = "entry"; session.doc = null; route(); };
      $("#ok").onclick = async () => {
        const res = await API().confirmArrive(so.id);
        if (!res.ok) { showErr(res.message); return; }
        toast("到货已确认", "ok");
        session.step = "entry"; session.doc = null; route();
      };
      bindScan("scanInput", async (code) => { await loadArrive(code); });
      bindCopy();
      return;
    }
    const pendingArrive = receiving.filter((r) => !r.arrived_at && r.status !== "void" && r.status !== "received");
    root().innerHTML = `${header("到货确认")}<div class="pda-body">
      ${errBanner()}
      ${scanField({ id: "scanInput", label: "收货单号扫描", placeholder: "请扫描或输入收货单号" })}
      <div class="section-title">待到货（${pendingArrive.length}）</div>
      ${taskTable(["收货单号", "工厂", "送货件数", "发货时间", "操作"], pendingArrive.map((r) =>
        `<tr><td>${copyBtn(r.so_no)}</td><td>${esc(r.factory)}</td><td class="num">${r.ship_qty}</td><td>${esc(r.ship_time)}</td>
        <td class="ops"><button type="button" class="btn btn-primary" data-open="${esc(r.so_no)}">去确认</button></td></tr>`))}
    </div>`;
    wireBack("/home");
    $$("[data-open]").forEach((b) => b.onclick = () => loadArrive(b.getAttribute("data-open")));
    bindCopy();
    bindScan("scanInput", async (code) => { await loadArrive(code); });

    async function loadArrive(code) {
      const hit = receiving.find((r) => r.so_no === code || r.tracking_no === code);
      if (!hit) { showErr("收货单不存在"); return; }
      if (hit.status === "void" || hit.status === "received") { showErr("当前收货单已完成或关闭，不可操作"); return; }
      if (hit.arrived_at) { showErr("该单已到货确认"); return; }
      session.doc = hit; session.step = "preview"; route();
    }
  }

  /* —— 收货（唯一码） —— */
  async function jobReceive() {
    const receiving = await loadList("listReceiving");
    if (session.step === "entry" || !session.doc) {
      root().innerHTML = `${header("收货")}<div class="pda-body">
        ${errBanner()}
        ${scanField({ id: "scanInput", label: "收货单号", placeholder: "请扫描收货单号" })}
        <div class="section-title">已到货待收</div>
        ${taskTable(["收货单号", "工厂", "已收/送货", "状态", "操作"],
          receiving.filter((x)=>x.arrived_at&&x.status!=="received"&&x.status!=="void").map((x)=>
          `<tr><td>${copyBtn(x.so_no)}</td><td>${esc(x.factory)}</td><td class="num">${x.received_qty}/${x.ship_qty}</td>
          <td><span class="badge warn">待收货</span></td><td class="ops"><button type="button" class="btn btn-primary" data-id="${esc(x.id)}">收货</button></td></tr>`))}
      </div>`;
      wireBack("/home");
      $$("[data-id]").forEach((el) => el.onclick = () => openSo(el.dataset.id));
      bindCopy();
      bindScan("scanInput", async (code) => {
        const hit = receiving.find((x)=>x.so_no===code);
        if (!hit) { showErr("收货单不存在"); return; }
        if (hit.status==="received"||hit.status==="void") { showErr("当前收货单已完成或关闭，不可操作"); return; }
        if (!hit.arrived_at) { showErr("请先由到货岗确认到货"); return; }
        openSo(hit.id);
      });
      return;
    }
    function openSo(id) {
      const so = receiving.find((x)=>x.id===id);
      session.doc = so; session.step = "work"; session.draft = {}; route();
    }

    const so = await loadOne("getReceiving", session.doc.id);
    if (!so) { session.step = "entry"; session.doc = null; route(); return; }
    session.doc = so;
    const lines = so.lines || [];
    if (session.step === "units") {
      const units = ((await API().listUnits({ so_id: so.id })).data || []);
      const st = (u) => u.session ? "本次已扫" : u.status === "received" ? "已收" : u.status === "expected" ? "未收" : u.status;
      root().innerHTML = `${header("收货明细")}<div class="pda-body no-foot">
        <div class="doc-top"><div class="no">收货单号：${copyBtn(so.so_no)}</div></div>
        <div class="section-title">每一件的唯一码。点唯一码可复制，扫码枪故障时粘贴到唯一码框。</div>
        <div class="tbl-wrap"><table class="tbl"><thead><tr><th>sku</th><th>唯一码</th><th>状态</th></tr></thead><tbody>
          ${units.map((u)=>`<tr><td class="sku">${copyBtn(u.sku)}</td><td class="sku">${copyBtn(u.uc)}</td><td>${st(u)}</td></tr>`).join("") || "<tr><td colspan='3'>暂无</td></tr>"}
        </tbody></table></div>
      </div>`;
      wireBack(()=>{ session.step="work"; route(); });
      bindCopy();
      return;
    }
    root().innerHTML = `${header("收货")}<div class="pda-body">
      <div class="doc-top"><div class="no">收货单号：${copyBtn(so.so_no)}</div></div>
      ${errBanner()}
      ${scanField({ id: "ucInput", label: "唯一码：", placeholder: "请扫描唯一码" })}
      <div class="tbl-wrap"><table class="tbl"><thead><tr>
        <th>sku</th><th class="num">送货件数</th><th class="num">已收件数</th><th class="num">本次收货件数</th>
      </tr></thead><tbody>
        ${lines.map((l)=>`<tr><td class="sku">${copyBtn(l.sku)}</td>
          <td class="num">${l.ship_qty}</td><td class="num">${l.received_qty}</td>
          <td class="num hi">${l.session_qty||0}</td></tr>`).join("")}
      </tbody></table></div>
    </div>
    ${foot(`<button class="btn btn-ghost" id="detail">收货明细</button>
      <button class="btn btn-ghost" id="draft">暂存</button>
      <button class="btn btn-primary" id="submit">提交</button>`)}`;
    wireBack(() => { session.step="entry"; session.doc=null; route(); });
    $("#draft").onclick = async () => { await API().saveReceiveDraft(so.id); toast("已暂存","ok"); };
    $("#detail").onclick = () => { session.step = "units"; route(); };
    $("#submit").onclick = async () => {
      const sessionTotal = lines.reduce((s,l)=>s+Number(l.session_qty||0),0);
      const after = so.received_qty + sessionTotal;
      if (after < so.ship_qty) {
        const ok = await modal({
          title: "确认收货结果",
          message: `本次收货后共收 ${after} 件，发货件数 ${so.ship_qty} 件，数量不足`,
          cancelText: "部分收货",
          okText: "收货完成",
        });
        if (ok === false) {
          const reason = "尾数未到";
          const r = await API().commitReceive(so.id, { mode: "partial", reason });
          if (!r.ok) { showErr(r.message); return; }
          toast("部分收货已提交","ok");
          session.step="entry"; session.doc=null; route();
          return;
        }
        if (ok === true) {
          const r = await API().commitReceive(so.id, { mode: "complete", reason: "收货完成(短收)" });
          if (!r.ok) { showErr(r.message); return; }
          toast("收货完成","ok");
          session.step="entry"; session.doc=null; route();
        }
        return;
      }
      const r = await API().commitReceive(so.id, { mode: "complete" });
      if (!r.ok) { showErr(r.message); return; }
      toast("收货完成","ok");
      session.step="entry"; session.doc=null; route();
    };
    bindScan("ucInput", async (code, input) => {
      const r = await API().scanReceiveUc(so.id, code);
      if (!r.ok) { showErr(r.message); return; }
      toast("已扫", "ok");
      input.value = "";
      route();
    });
    bindCopy();
  }

  /* —— 质检 —— */
  async function jobQc() {
    const receiving = await loadList("listReceiving");
    if (session.step === "entry" || !session.doc) {
      root().innerHTML = `${header("质检")}<div class="pda-body">
        ${errBanner()}
        ${scanField({ id: "scanInput", label: "收货单号", placeholder: "请扫描收货单号" })}
        <div class="section-title">待质检</div>
        ${taskTable(["收货单号", "工厂", "实收", "操作"],
          receiving.filter((x)=>x.received_qty>0&&x.status!=="void").map((x)=>
          `<tr><td>${copyBtn(x.so_no)}</td><td>${esc(x.factory)}</td><td class="num">${x.received_qty}</td>
          <td class="ops"><button type="button" class="btn btn-primary" data-id="${esc(x.id)}">质检</button></td></tr>`))}
      </div>`;
      wireBack("/home");
      $$("[data-id]").forEach((el)=>el.onclick=()=>{ session.doc=receiving.find(x=>x.id===el.dataset.id); session.step="work"; route(); });
      bindCopy();
      bindScan("scanInput", async (code) => {
        const hit = receiving.find((x)=>x.so_no===code);
        if (!hit) { showErr("收货单不存在"); return; }
        if (!Number(hit.received_qty)) { showErr(hit.so_no + " 还没有收货，没有待质检件数"); return; }
        session.doc = hit; session.step = "work"; route();
      });
      return;
    }
    const so = await loadOne("getReceiving", session.doc.id);
    if (!so) { session.step = "entry"; session.doc = null; route(); return; }
    if (!Number(so.received_qty)) {
      root().innerHTML = `${header("质检")}<div class="pda-body"><div class="empty"><div class="et">这单还没有收货</div>
        <div class="es">质检只能处理已经收货的件数。请回到列表，打开待质检的收货单。</div></div></div>`;
      wireBack(()=>{ session.step="entry"; session.doc=null; route(); });
      return;
    }
    const units = ((await API().listUnits({ so_id: so.id })).data || []);
    const lines = so.lines || [];
    const qcOf = (u) => u.status === "qc_pass" || u.status === "qc_fail" || u.status === "qc_repair" || u.status === "putaway";
    const bySku = {};
    lines.forEach((l) => {
      const us = units.filter((u)=>u.sku===l.sku);
      bySku[l.sku] = {
        recv: us.filter((u)=>u.status!=="expected").length,
        pass: us.filter((u)=>u.status==="qc_pass"||u.status==="putaway").length,
        fail: us.filter((u)=>u.status==="qc_fail").length,
        repair: us.filter((u)=>u.status==="qc_repair").length,
        done: us.filter(qcOf).length,
        reasons: us.filter((u)=>u.qc_reason).map((u)=>u.qc_reason),
      };
    });
    const inspected = units.filter(qcOf).length;
    const pendingN = units.filter((u)=>u.status==="received").length;

    if (session.step === "units") {
      const stLabel = { received: "待质检", qc_pass: "合格", qc_fail: "不合格", qc_repair: "仓内维修", putaway: "已上架", expected: "未收" };
      const stCls = { received: "gray", qc_pass: "ok", qc_fail: "danger", qc_repair: "warn", putaway: "blue", expected: "gray" };
      root().innerHTML = `${header("质检明细")}<div class="pda-body no-foot">
        <div class="doc-top"><div class="no">${esc(so.so_no)}</div></div>
        <div class="tbl-wrap"><table class="tbl tbl-list"><thead><tr>
          <th>sku</th><th>唯一码</th><th>状态</th><th>不合格/维修原因</th><th class="ops">操作</th>
        </tr></thead><tbody>
          ${units.map((u)=>`<tr>
            <td class="sku">${esc(u.sku)}</td>
            <td class="sku">${copyBtn(u.uc)}</td>
            <td><span class="badge ${stCls[u.status]||"gray"}">${stLabel[u.status]||u.status}</span></td>
            <td>${esc(u.qc_reason||"—")}</td>
            <td class="ops"><button type="button" class="btn btn-primary" data-print="${esc(u.uc)}">打印唯一码</button></td>
          </tr>`).join("")}
        </tbody></table></div>
      </div>`;
      wireBack(()=>{ session.step="work"; route(); });
      $$("[data-print]").forEach((b)=>b.onclick=()=>toast("已发送打印："+b.dataset.print,"ok"));
      bindCopy();
      return;
    }

    const activeSize = sizeOfSku((lines.find((l)=> (bySku[l.sku]||{}).recv > (bySku[l.sku]||{}).done) || lines[0] || {}).sku);
    root().innerHTML = `${header("质检（备货款）")}<div class="pda-body"><div class="qc-split"><div class="qc-main">
      <div class="doc-top"><div class="no">收货单号 ${copyBtn(so.so_no)}</div><span>待质检 ${pendingN} 件</span></div>
      ${errBanner()}
      ${scanField({ id: "passUc", label: "合格唯一码", placeholder: "扫描唯一码，判定为合格", boxClass: "ok-box", labClass: "green" })}
      ${scanField({ id: "failUc", label: "不合格唯一码", placeholder: "扫描唯一码，再选不合格原因", boxClass: "fail-box", labClass: "red" })}
      ${scanField({ id: "repairUc", label: "仓内维修唯一码", placeholder: "扫描唯一码，再选维修类型", boxClass: "repair-box", labClass: "brown" })}
      <div class="section-title">SKU列表 共 ${lines.length} 项</div>
      <div class="tbl-wrap"><table class="tbl tbl-list"><thead><tr>
        <th>SKU</th><th>质检进度<br/>已收/待检/已检</th><th>本次合格</th><th>本次不合格</th><th>仓内维修</th><th>历史不合格原因</th>
      </tr></thead><tbody>
        ${lines.map((l)=>{ const s=bySku[l.sku]||{}; const pending=Math.max(0,(s.recv||0)-(s.done||0));
          const hist = (s.reasons||[]).length;
          return `<tr><td class="sku">${copyBtn(l.sku)}</td>
          <td class="num">${s.recv||0} / ${pending} / ${s.done||0}</td>
          <td class="num" style="color:#389e0d">${s.pass||0}</td>
          <td class="num" style="color:#e85a6b">${s.fail||0}</td>
          <td class="num" style="color:#d48806">${s.repair||0}</td>
          <td class="ops">${hist?`<button type="button" class="btn btn-primary" data-hist="${esc(l.sku)}">查看</button>`:"—"}</td></tr>`; }).join("")}
      </tbody></table></div>
      <div class="stat-row">累计已质检：<b>${inspected}</b> 件 / 共 ${so.received_qty} 件（待质检：${pendingN} 件）</div>
    </div><aside>${sizeChartHtml(activeSize)}</aside></div></div>
    ${foot(`<button class="btn btn-ghost" id="detail">质检明细</button><button class="btn btn-primary" id="submit">提交</button>`)}`;
    wireBack(()=>{ session.step="entry"; session.doc=null; route(); });
    $$("[data-hist]").forEach((b)=>b.onclick=async()=>{
      const sku = b.dataset.hist;
      const rows = units.filter((u)=>u.sku===sku && u.qc_reason);
      await modal({
        title: "历史不合格原因",
        html: `<div class="tbl-wrap"><table class="tbl"><thead><tr><th>唯一码</th><th>原因</th></tr></thead><tbody>
          ${rows.map((u)=>`<tr><td class="sku">${esc(u.uc)}</td><td>${esc(u.qc_reason)}</td></tr>`).join("") || "<tr><td colspan='2'>无</td></tr>"}
        </tbody></table></div>`,
        okText: "关闭",
      });
    });
    async function askReason(kind) {
      const opts = kind === "fail" ? ["线头","色差","破洞","污渍","尺寸不符"] : ["开线","掉扣","抽丝"];
      return new Promise((resolve) => {
        const mask = document.createElement("div");
        mask.className = "modal-mask";
        mask.innerHTML = `<div class="modal"><div class="m-hd">${kind==="fail"?"选择不合格原因":"选择维修类型"}</div>
          <div class="field"><select id="qcReason">${opts.map((o)=>`<option>${o}</option>`).join("")}</select></div>
          <div class="m-actions"><button type="button" class="cancel">取消</button><button type="button" class="ok">确定</button></div></div>`;
        layer().appendChild(mask);
        $(".cancel", mask).onclick = () => { mask.remove(); resolve(null); };
        $(".ok", mask).onclick = () => {
          const v = $("#qcReason", mask).value;
          mask.remove();
          resolve(v);
        };
      });
    }
    const scanResult = (result) => async (code) => {
      let reason = "";
      if (result !== "pass") {
        reason = await askReason(result);
        if (!reason) return;
      }
      const r = await API().scanQcUc(so.id, code, result, reason);
      if (!r.ok) { showErr(r.message); return; }
      toast("已记录","ok"); route();
    };
    bindScan("passUc", scanResult("pass"));
    bindScan("failUc", scanResult("fail"));
    bindScan("repairUc", scanResult("repair"));
    bindCopy();
    const sizeCard = $("#sizeCard");
    if (sizeCard) sizeCard.onclick = () => lightbox(`<div class="hd" style="font-weight:600;margin-bottom:8px">尺码表</div>${sizeCard.querySelector(".tbl-wrap").innerHTML}<div class="section-title">公差 ±1.5cm</div>`);
    $$("[data-sample]").forEach((b) => {
      b.onclick = () => lightbox(`<div class="sample-row"><div class="ph big">${esc(b.dataset.sample)}</div></div>`);
    });
    $("#detail").onclick = () => { session.step = "units"; route(); };
    $("#submit").onclick = async () => {
      const us = ((await API().listUnits({ so_id: so.id })).data || []);
      const pass = us.filter((u)=>u.status==="qc_pass"||u.status==="putaway").length;
      const fail = us.filter((u)=>u.status==="qc_fail").length;
      const repair = us.filter((u)=>u.status==="qc_repair").length;
      const ok = await modal({
        title: "确认提交质检",
        html: `<div class="m-sum"><div>合格数量：<span class="g">${pass} 件</span></div>
          <div>不合格数量：<span class="r">${fail} 件</span></div>
          <div>仓内维修数量：<span class="o">${repair} 件</span></div>
          <div>本次质检总计：${pass+fail+repair} 件</div></div>`,
        okText: "确认提交", cancelText: "取消",
      });
      if (!ok) return;
      const r = await API().submitQcForSo(so.id);
      if (!r.ok) { showErr(r.message); return; }
      toast("质检已提交","ok");
      session.step="entry"; session.doc=null; route();
    };
  }

  /* —— 上架：先选任务，再扫码 —— */
  async function jobPutaway() {
    if (!session.draft) session.draft = {};
    const receiving = await loadList("listReceiving");
    const waiting = ((await API().listUnits({ status: "qc_pass" })).data || []);
    if (session.step !== "work" || !session.doc) {
      const groups = {};
      waiting.forEach((u) => {
        if (!groups[u.so_id]) {
          const so = receiving.find((x) => x.id === u.so_id);
          groups[u.so_id] = { id: u.so_id, so_no: u.so_no || (so && so.so_no) || "", factory: so ? so.factory : "", n: 0 };
        }
        groups[u.so_id].n += 1;
      });
      const rows = Object.values(groups);
      root().innerHTML = `${header("上架")}<div class="pda-body">
        ${errBanner()}
        ${scanField({ id: "scanInput", label: "收货单号", placeholder: "请扫描收货单号" })}
        <div class="section-title">待上架任务</div>
        ${taskTable(["收货单号", "工厂", "待上架", "操作"], rows.map((g) =>
          `<tr><td>${copyBtn(g.so_no)}</td><td>${esc(g.factory)}</td><td class="num">${g.n}</td>
          <td class="ops"><button type="button" class="btn btn-primary" data-id="${esc(g.id)}">上架</button></td></tr>`))}
      </div>`;
      wireBack("/home");
      bindCopy();
      const openTask = (id) => {
        const g = rows.find((x) => x.id === id);
        if (!g) return;
        session.doc = { id: g.id, so_no: g.so_no };
        session.step = "work";
        session.draft = { recent: [], lockLoc: "", uc: "", unit: null };
        route();
      };
      $$("[data-id]").forEach((el) => el.onclick = () => openTask(el.dataset.id));
      bindScan("scanInput", async (code) => {
        const g = rows.find((x) => x.so_no === code);
        if (!g) { showErr("这张收货单没有待上架的合格件"); return; }
        openTask(g.id);
      });
      return;
    }
    const so = receiving.find((x) => x.id === session.doc.id) || session.doc;
    const mine = waiting.filter((u) => u.so_id === so.id);
    const locked = session.draft.lockLoc || "";
    const curUc = session.draft.uc || "";
    const curUnit = session.draft.unit || null;
    const recent = session.draft.recent || [];
    root().innerHTML = `${header("上架")}<div class="pda-body">
      <div class="doc-top"><div class="no">收货单号 ${copyBtn(so.so_no)}</div><span>待上架 ${mine.length} 件</span></div>
      ${errBanner()}
      ${scanField({ id: "ucInput", label: "唯一码", placeholder: "请扫描本单唯一码", value: curUc })}
      ${scanField({ id: "locInput", label: "库位", placeholder: curUc ? "请扫描库位" : "请先扫描唯一码", boxClass: curUc ? "" : "muted" })}
      <label class="lock-row"><input type="checkbox" id="lockLoc" ${locked?"checked":""}/> 锁定库位 ${locked?("(" + esc(locked) + ")"):""}</label>
      ${curUnit ? `<div class="info-card"><div class="row"><span class="k">当前唯一码</span><span class="v">${copyBtn(curUnit.uc)}</span></div>
        <div class="row"><span class="k">SKU</span><span class="v">${copyBtn(curUnit.sku)}</span></div>
        <div class="row"><span class="k">推荐库位</span><span class="v">${esc(curUnit.recommend_location)}</span></div></div>` : ""}
      <div class="section-title">本单待上架</div>
      ${taskTable(["唯一码", "SKU", "推荐库位"], mine.map((u) =>
        `<tr><td class="sku">${copyBtn(u.uc)}</td><td class="sku">${copyBtn(u.sku)}</td><td>${esc(u.recommend_location)}</td></tr>`))}
      ${recent.length ? `<div class="section-title">本次已上架</div><div class="tbl-wrap"><table class="tbl"><thead><tr><th>唯一码</th><th>库位</th><th>状态</th></tr></thead>
        <tbody>${recent.map((r)=>`<tr><td class="sku">${copyBtn(r.uc)}</td><td>${esc(r.location)}</td><td><span class="badge ok">已上架</span></td></tr>`).join("")}</tbody></table></div>` : ""}
    </div>`;
    wireBack(() => { session.step = "entry"; session.doc = null; session.draft = {}; route(); });
    bindCopy();
    $("#lockLoc").onchange = () => { session.draft.lockLoc = $("#lockLoc").checked ? (locked || "") : ""; };
    bindScan("ucInput", async (code) => {
      const r = await API().scanPutawayUc(code);
      if (!r.ok) { showErr(r.message); return; }
      if (r.data.so_id !== so.id) { showErr("这件属于收货单 " + (r.data.so_no || "") + "，请回到列表打开那一单"); return; }
      session.draft.uc = r.data.uc;
      session.draft.unit = r.data;
      if (session.draft.lockLoc) {
        const r2 = await API().scanPutawayLoc(r.data.uc, session.draft.lockLoc);
        if (!r2.ok) { showErr(r2.message); route(); return; }
        session.draft.recent = [{ uc: r.data.uc, sku: r.data.sku, recommend: r.data.recommend_location, location: session.draft.lockLoc }].concat(session.draft.recent || []).slice(0, 20);
        session.draft.uc = ""; session.draft.unit = null;
        toast("上架成功", "ok");
      } else toast("请扫库位", "ok");
      route();
    });
    bindScan("locInput", async (code) => {
      if (!session.draft.uc) { showErr("请先扫描唯一码"); return; }
      const r = await API().scanPutawayLoc(session.draft.uc, code);
      if (!r.ok) { showErr(r.message); return; }
      if ($("#lockLoc").checked) session.draft.lockLoc = code;
      session.draft.recent = [{ uc: session.draft.uc, sku: session.draft.unit.sku, recommend: session.draft.unit.recommend_location, location: code }].concat(session.draft.recent || []).slice(0, 20);
      session.draft.uc = ""; session.draft.unit = null;
      toast("上架成功", "ok");
      route();
    });
  }

  /* —— 配货 —— */
  async function jobPick() {
    const picks = await loadList("listPicks");
    if (session.step === "entry" || !session.doc) {
      root().innerHTML = `${header("配货")}<div class="pda-body">
        ${errBanner()}
        ${scanField({ id: "scanInput", label: "配货单号", placeholder: "请扫描配货单号" })}
        <div class="section-title">待配货</div>
        ${taskTable(["配货单号", "进度", "类型", "操作"],
          picks.filter((p)=>p.status==="to_pick"||p.status==="shortage").map((p)=>
            `<tr><td>${copyBtn(p.ph_no)}</td><td class="num">${p.picked_qty||0}/${p.qty}</td><td>${esc(p.type||"")}</td>
            <td class="ops"><button type="button" class="btn btn-primary" data-id="${esc(p.id)}">去配货</button></td></tr>`))}
      </div>`;
      wireBack("/home");
      bindCopy();
      $$("[data-id]").forEach((el)=>el.onclick=()=>{ session.doc=picks.find(x=>x.id===el.dataset.id); session.step="work"; route(); });
      bindScan("scanInput", async (code) => {
        const hit = picks.find((p)=>p.ph_no===code);
        if (!hit) { showErr("配货单不存在"); return; }
        if (hit.status!=="to_pick"&&hit.status!=="shortage") { showErr("当前状态不可配货"); return; }
        session.doc = hit; session.step = "work"; route();
      });
      return;
    }
    const pick = await loadOne("getPick", session.doc.id);
    if (!pick) { session.step = "entry"; session.doc = null; route(); return; }
    session.doc = pick;
    const pending = (pick.lines||[]).filter((l)=>Number(l.picked_qty)<Number(l.qty)&&!l.shortage).length;
    root().innerHTML = `${header("配货详情")}<div class="pda-body">
      <div class="stat-row">
        <span>配货单号 <b>${esc(pick.ph_no)}</b></span>
        <span style="color:#fa8c16">配货中</span>
        <span>扫描进度 <b>${pick.picked_qty||0}/${pick.qty}</b></span>
        <span>待扫描 ${pending}</span>
      </div>
      ${errBanner()}
      ${scanField({ id: "scanInput", label: "唯一码/SKU扫描", placeholder: "请扫描唯一码或SKU" })}
      <div class="tbl-wrap"><table class="tbl tbl-list"><thead><tr>
        <th>SKU</th><th>库位</th><th>唯一码</th><th>出库单</th><th>已拣/应拣</th><th>状态</th><th class="ops">操作</th>
      </tr></thead><tbody>
        ${(pick.lines||[]).map((l)=>{
          const done = Number(l.picked_qty)>=Number(l.qty) || l.shortage;
          return `<tr>
            <td class="sku">${copyBtn(l.sku)}</td>
            <td>${esc(l.location)}</td>
            <td class="sku">${l.uc ? copyBtn(l.uc) : "—"}</td>
            <td>${esc(l.order_no||"—")}</td>
            <td class="num">${l.picked_qty}/${l.qty}</td>
            <td>${l.shortage?'<span class="badge danger">缺货</span>':done?'<span class="badge ok">已扫描</span>':'<span class="badge gray">未扫描</span>'}</td>
            <td class="ops">${!done?`<button type="button" class="btn btn-primary" data-short="${esc(l.line_id)}">标记缺货</button>`:"—"}</td>
          </tr>`;
        }).join("")}
      </tbody></table></div>
    </div>
    ${foot(`<div class="meta">已扫描: ${pick.picked_qty||0}/${pick.qty}（${pending}项待扫描）</div>
      <button class="btn btn-primary" id="submit">提交</button>`)}`;
    wireBack(()=>{ session.step="entry"; session.doc=null; route(); });
    bindCopy();
    $$("[data-short]").forEach((b)=>b.onclick=async()=>{
      const line = pick.lines.find((l)=>l.line_id===b.dataset.short);
      if (line) line.shortage = true;
      await API().shortagePick(pick.id);
      toast("已标记缺货","ok"); route();
    });
    $("#submit").onclick = async () => {
      const open = (pick.lines||[]).filter((l)=>Number(l.picked_qty)<Number(l.qty)&&!l.shortage);
      if (open.length) {
        const ok = await modal({
          title: "提交缺货",
          message: `当前还有 ${open.length} 项未处理未扫描明细，提交后将标记为主动缺货。`,
          cancelText: "继续扫描", okText: "提交",
        });
        if (!ok) return;
        const r = await API().submitPick(pick.id, { forceShortage: true });
        if (!r.ok) { showErr(r.message); return; }
        toast("已提交","ok"); session.step="entry"; session.doc=null; route(); return;
      }
      const r = await API().submitPick(pick.id, {});
      if (!r.ok) { showErr(r.message); return; }
      toast("配货完成","ok"); session.step="entry"; session.doc=null; route();
    };
    bindScan("scanInput", async (code, input) => {
      const r = await API().scanPickCode(pick.id, code);
      if (!r.ok) { showErr(r.message); return; }
      toast("已扫描","ok"); input.value=""; route();
    });
  }

  async function jobSort() {
    root().innerHTML = `${header("分拣")}<div class="pda-body"><div class="empty"><div class="et">分拣岗</div>
      <div class="es">多件单在配货提交后进入本岗。本期演示主路径以配货/复核为主。</div></div></div>`;
    wireBack("/home");
  }

  /* —— 复核 —— */
  async function jobCheck() {
    root().innerHTML = `${header("复核")}<div class="pda-body">
      ${errBanner()}
      ${scanField({ id: "scanInput", label: "唯一码扫描", placeholder: "请扫描唯一码" })}
      <div class="empty" id="emptyHint"><div class="ico">▦</div><div class="et">请扫描唯一码</div>
        <div class="es">扫描唯一码后将自动进入复核流程</div></div>
      <div id="orderPanel"></div>
    </div>
    ${foot(`<button class="btn btn-primary" id="ok" style="flex:1">确认</button>
      <button class="btn btn-ghost" id="clear" style="flex:1">清空输入</button>`)}`;
    wireBack("/home");
    let lastOrder = null;
    $("#clear").onclick = () => { $("#scanInput").value=""; clearErr(); $("#orderPanel").innerHTML=""; $("#emptyHint").style.display=""; focusInput(); };
    $("#ok").onclick = () => { const v=($("#scanInput").value||"").trim(); if(v) $$('[data-scan="scanInput"]')[0].click(); };
    bindScan("scanInput", async (code) => {
      const r = await API().scanCheckUc(code);
      if (!r.ok) { showErr(r.message); $("#orderPanel").innerHTML=""; return; }
      lastOrder = r.data.order || r.data;
      $("#emptyHint").style.display = "none";
      const o = lastOrder;
      $("#orderPanel").innerHTML = `
        <div class="section-title">订单信息</div>
        <div class="tbl-wrap"><table class="tbl"><tbody>
          <tr><td>订单编号</td><td>${esc(o.customer_order_no||o.order_no)}</td></tr>
          <tr><td>内部单号</td><td>${esc(o.order_no)}</td></tr>
          <tr><td>站点</td><td>${esc(o.site||"")}</td></tr>
          <tr><td>物流渠道</td><td>${esc(o.channel||"—")}</td></tr>
          <tr><td>货运单号</td><td>${esc(o.tracking_no||"—")}</td></tr>
          <tr><td>状态</td><td>${o.status==="checked"?"已复核":"待复核"}</td></tr>
        </tbody></table></div>
        <div class="section-title">商品信息</div>
        <div class="tbl-wrap"><table class="tbl"><thead><tr><th>SKU</th><th>数量</th><th>已核</th></tr></thead>
          <tbody><tr><td class="sku">${esc(o.sku)}</td><td class="num">${o.qty}</td><td class="num">${o.checked_qty||0}</td></tr></tbody></table></div>`;
      if (o.status === "checked") toast("复核完成","ok");
      else toast(r.message,"ok");
    });
  }

  /* —— 盘点 —— */
  async function jobStocktake() {
    const stocktakes = await loadList("listStocktakes");
    if (session.step === "entry" || !session.doc) {
      root().innerHTML = `${header("盘点")}<div class="pda-body">
        <div class="section-title">待盘点</div>
        ${taskTable(["盘点单号", "库区", "行数", "操作"],
          stocktakes.filter((t)=>t.status==="open"||t.status==="doing").map((t)=>
            `<tr><td>${copyBtn(t.st_no)}</td><td>${esc(t.zone)}</td><td class="num">${(t.lines||[]).length}</td>
            <td class="ops"><button type="button" class="btn btn-primary" data-id="${esc(t.id)}">盘点</button></td></tr>`))}
      </div>`;
      wireBack("/home");
      bindCopy();
      $$("[data-id]").forEach((b)=>b.onclick=()=>{ session.doc=stocktakes.find(x=>x.id===b.dataset.id); session.step="work"; session.draft={}; route(); });
      return;
    }
    const task = await loadOne("getStocktake", session.doc.id);
    if (!task) { session.step = "entry"; session.doc = null; route(); return; }
    const before = task.lines.reduce((s,l)=>s+Number(l.system_qty),0);
    const actual = task.lines.reduce((s,l)=>s+(l.count_qty==null?0:Number(l.count_qty)),0);
    const diff = before - actual;
    const loc = session.draft.loc || "";
    root().innerHTML = `${header("盘点")}<div class="pda-body">
      <div class="info-card">
        <div class="row"><span class="k">盘点任务号</span><span class="v">${esc(task.st_no)}</span></div>
        <div class="row"><span class="k">库区</span><span class="v">${esc(task.zone)}</span></div>
        <div class="stat-row"><span>盘前: <b>${before}</b></span><span>实盘: <b>${actual}</b></span><span class="diff">差异: ${diff}</span></div>
      </div>
      ${errBanner()}
      ${scanField({ id: "locInput", label: "库位", placeholder: "请扫描库位条码", value: loc })}
      ${scanField({ id: "skuInput", label: "SKU / 唯一码扫描", placeholder: loc ? "请扫描SKU或唯一码" : "请先扫描库位", boxClass: loc?"":"muted" })}
      <div class="tbl-wrap"><table class="tbl"><thead><tr><th>SKU / 库位</th><th class="num">盘前</th><th class="num">实盘</th></tr></thead>
        <tbody>${task.lines.map((l)=>`<tr><td class="sku">${copyBtn(l.sku)}<br/><span style="color:#8c8c8c">${copyBtn(l.location)}</span></td>
          <td class="num">${l.system_qty}</td><td class="num hi">${l.count_qty==null?0:l.count_qty}</td></tr>`).join("")}</tbody></table></div>
    </div>
    ${foot(`<button class="btn btn-ghost" id="draft">暂存</button><button class="btn btn-primary" id="submit">提交</button>`)}`;
    wireBack(()=>{ session.step="entry"; session.doc=null; route(); });
    bindCopy();
    $("#draft").onclick = async ()=>{ await API().saveStocktakeDraft(task.id); toast("已暂存","ok"); };
    $("#submit").onclick = async ()=>{
      const r = await API().submitStocktake(task.id);
      if (!r.ok) { showErr(r.message); return; }
      toast("已提交","ok"); session.step="entry"; session.doc=null; route();
    };
    bindScan("locInput", async (code) => { session.draft.loc = code; toast("请扫SKU","ok"); route(); });
    bindScan("skuInput", async (code) => {
      if (!session.draft.loc) { showErr("请先扫描库位"); return; }
      let sku = code;
      const fu = await API().findUnit(code);
      if (fu.ok) sku = fu.data.sku;
      const line = task.lines.find((l)=>l.location===session.draft.loc && l.sku===sku);
      if (!line) { showErr("该库位下无此 SKU"); return; }
      const next = Number(line.count_qty || 0) + 1;
      await API().startStocktake(task.id);
      const r = await API().countLine(task.id, session.draft.loc, sku, next);
      if (!r.ok) { showErr(r.message); return; }
      toast("实盘 +1","ok"); route();
    });
  }

  /* —— 移位 —— */
  async function jobMove() {
    if (!session.doc) {
      const r = await API().createMove();
      session.doc = r.data; session.step = "from";
    }
    const m = session.doc;
    root().innerHTML = `${header("移位下架")}<div class="pda-body">
      <div class="info-card">
        <div class="row"><span class="k">任务单号</span><span class="v">${esc(m.mv_no||"新建任务单")}</span></div>
        <div class="row"><span class="k">状态</span><span class="v">待操作</span></div>
      </div>
      ${errBanner()}
      ${scanField({ id: "fromLoc", label: "1. 下架库位扫描", placeholder: "请输入或扫描下架库位条码", value: m.from_loc||"" })}
      ${scanField({ id: "ucInput", label: "2. 唯一码扫描", placeholder: m.from_loc?"请扫描唯一码":"请先扫描库位", boxClass: m.from_loc?"":"muted" })}
      ${m.to_loc || (m.lines&&m.lines.length) ? scanField({ id: "toLoc", label: "3. 目标库位扫描", placeholder: "请扫描上架库位", value: m.to_loc||"" }) : ""}
      ${(m.lines&&m.lines.length) ? `<div class="tbl-wrap"><table class="tbl"><thead><tr><th>唯一码/SKU</th><th>来源库位</th><th>数量</th></tr></thead>
        <tbody>${m.lines.map((l)=>`<tr><td class="sku">${esc(l.uc)}<br/>${esc(l.sku)}</td><td>${esc(l.from)}</td><td class="num">1</td></tr>`).join("")}</tbody></table></div>`
        : `<div class="empty"><div class="et">没有下架内容</div><div class="es">请先扫描唯一码开始下架</div></div>`}
    </div>
    ${foot(`<div class="meta">待移位：${(m.lines&&m.lines.length)||0} 件</div>
      <button class="btn btn-primary" id="submit" ${(m.lines&&m.lines.length&&m.to_loc)?"":"disabled"}>提交下架</button>`)}`;
    wireBack("/home");
    $("#submit").onclick = async () => {
      const r = await API().submitMove(m.id);
      if (!r.ok) { showErr(r.message); return; }
      toast("移位已提交","ok"); session.doc=null; route();
    };
    bindScan("fromLoc", async (code) => {
      const r = await API().scanMoveFromLoc(m.id, code);
      if (!r.ok) { showErr(r.message); return; }
      session.doc = r.data; route();
    });
    bindScan("ucInput", async (code) => {
      const r = await API().scanMoveUc(m.id, code);
      if (!r.ok) { showErr(r.message); return; }
      session.doc = r.data; route();
    });
    if ($("#toLoc")) bindScan("toLoc", async (code) => {
      const r = await API().scanMoveToLoc(m.id, code);
      if (!r.ok) { showErr(r.message); return; }
      session.doc = r.data; route();
    });
  }

  async function jobException() {
    const doc = sessionStorage.getItem("ex_doc") || "";
    root().innerHTML = `${header("异常反馈")}<div class="pda-body">
      <div class="field"><label>类型</label><select id="type"><option>破损</option><option>少货</option><option>多货</option><option>条码无法识别</option><option>其他</option></select></div>
      <div class="field"><label>单号</label><input id="doc" value="${esc(doc)}" /></div>
      <div class="field"><label>说明</label><textarea id="reason"></textarea></div>
    </div>${foot(`<button class="btn btn-primary" id="ok" style="flex:1">提交</button>`)}`;
    wireBack("/home");
    $("#ok").onclick = async () => {
      const r = await API().submitException({ type: $("#type").value, doc_no: $("#doc").value.trim(), reason: ($("#reason").value||"").trim() });
      if (!r.ok) { toast(r.message,"err"); return; }
      toast("已提交","ok"); go("/home");
    };
  }

  /* —— 库位查询 —— */
  async function jobLocQuery() {
    const draft = session.draft || {};
    const result = draft.locResult || null;
    let body = "";
    if (result && result.type === "uc") {
      const u = result.unit;
      const stMap = {
        expected: "待收", received: "已收", qc_pass: "质检合格", qc_fail: "不合格",
        qc_repair: "维修", putaway: "已上架", picked: "已配货", checked: "已复核",
      };
      body = `<div class="info-card">
        <div class="hd">唯一码详情</div>
        <div class="row"><span class="k">唯一码</span><span class="v">${copyBtn(u.uc)}</span></div>
        <div class="row"><span class="k">SKU</span><span class="v">${copyBtn(u.sku)}</span></div>
        <div class="row"><span class="k">当前库位</span><span class="v">${esc(u.location || "—")}</span></div>
        <div class="row"><span class="k">推荐库位</span><span class="v">${esc(u.recommend_location || "—")}</span></div>
        <div class="row"><span class="k">状态</span><span class="v"><span class="badge blue">${esc(stMap[u.status] || u.status)}</span></span></div>
        <div class="row"><span class="k">收货单</span><span class="v">${esc(u.so_no || "—")}</span></div>
      </div>`;
    } else if (result && result.type === "sku") {
      body = `<div class="section-title">SKU ${esc(result.sku)} · 共 ${result.rows.length} 个库位</div>
        ${taskTable(["库位", "库区", "仓位", "预占", "待发", "合计"],
          result.rows.map((r) => `<tr>
            <td>${esc(r.location || "—")}</td><td>${esc(r.zone || "—")}</td>
            <td class="num">${r.bin_qty}</td><td class="num">${r.reserved}</td>
            <td class="num">${r.wait_ship}</td><td class="num hi">${r.total}</td></tr>`),
          { numCols: [2, 3, 4, 5] })}`;
    } else {
      body = `<div class="empty"><div class="ico">🔍</div><div class="et">库位查询</div>
        <div class="es">扫描 SKU 查看各库位库存分布<br/>扫描唯一码查看当前库位和状态</div></div>`;
    }
    root().innerHTML = `${header("库位查询")}<div class="pda-body no-foot">
      ${errBanner()}
      ${scanField({ id: "scanInput", label: "扫描SKU或唯一码", placeholder: "请扫描SKU或唯一码" })}
      ${body}
    </div>`;
    wireBack("/home");
    bindCopy();
    bindScan("scanInput", async (code, input) => {
      const r = await API().queryLoc(code);
      if (!r.ok) { showErr(r.message); return; }
      session.draft = Object.assign({}, session.draft || {}, { locResult: r.data });
      input.value = "";
      route();
    });
  }

  /* —— 打印唯一码 —— */
  async function jobPrintUc() {
    const draft = session.draft || {};
    const loc = draft.printLoc || "";
    const locked = !!loc;
    const last = draft.lastPrint || null;
    root().innerHTML = `${header("打印唯一码")}<div class="pda-body">
      ${errBanner()}
      ${scanField({
        id: "locInput", label: "库位", placeholder: "请扫描库位编码",
        value: loc, boxClass: locked ? "ok-box" : "",
      })}
      ${locked ? `<div class="lock-row"><label><input type="checkbox" id="lockLoc" checked /> 锁定库位 ${esc(loc)}</label>
        <button type="button" class="btn btn-primary" id="clearLoc">更换</button></div>` : ""}
      ${scanField({
        id: "skuInput", label: "SKU", placeholder: locked ? "请扫描 SKU 码" : "请先扫描并锁定库位",
        boxClass: locked ? "" : "muted",
      })}
      ${!locked ? `<div class="scan-hint">请先扫描并锁定库位</div>` : ""}
      ${last ? `<div class="info-card">
        <div class="hd">最近打印</div>
        <div class="row"><span class="k">唯一码</span><span class="v">${copyBtn(last.uc)}</span></div>
        <div class="row"><span class="k">SKU</span><span class="v">${copyBtn(last.sku)}</span></div>
        <div class="row"><span class="k">库位</span><span class="v">${esc(last.location)}</span></div>
        <div class="row"><span class="k">序号</span><span class="v">${last.seq}</span></div>
      </div>` : ""}
    </div>`;
    wireBack("/home");
    bindCopy();
    if ($("#clearLoc")) {
      $("#clearLoc").onclick = () => {
        session.draft = Object.assign({}, session.draft || {}, { printLoc: "", lastPrint: null });
        route();
      };
    }
    bindScan("locInput", async (code, input) => {
      session.draft = Object.assign({}, session.draft || {}, { printLoc: code });
      toast("库位已锁定", "ok");
      input.value = code;
      route();
    });
    if (locked) {
      bindScan("skuInput", async (code, input) => {
        const r = await API().printUcAtLocation(loc, code);
        if (!r.ok) { showErr(r.message); return; }
        const u = r.data.unit;
        session.draft = Object.assign({}, session.draft || {}, {
          lastPrint: { uc: u.uc, sku: u.sku, location: loc, seq: r.data.seq },
        });
        toast(r.message || "已打印", "ok");
        lightbox(`<div class="print-sheet">
          <div class="print-title">唯一码</div>
          <div class="print-uc">${esc(u.uc)}</div>
          <div class="print-meta">SKU ${esc(u.sku)}<br/>库位 ${esc(loc)} · 序号 ${r.data.seq}</div>
        </div>`);
        input.value = "";
        route();
      });
    }
  }

  window.addEventListener("hashchange", route);
  document.addEventListener("DOMContentLoaded", async () => {
    const tick = () => {
      const el = $("#osTime");
      if (!el) return;
      const d = new Date();
      el.textContent = String(d.getHours()).padStart(2, "0") + ":" + String(d.getMinutes()).padStart(2, "0");
    };
    tick();
    setInterval(tick, 30000);
    const app = root();
    if (app) app.addEventListener("click", (e) => {
      if (e.target.closest("button, a, input, select, textarea, label")) return;
      const cell = e.target.closest("td, .info-card .row .v, .doc-top .no");
      if (!cell || cell.closest("td.ops, th")) return;
      writeCopy(cell.innerText || "");
    });
    const back = $("#osBack");
    const home = $("#osHome");
    if (back) back.onclick = () => {
      const b = $("#btnBack");
      if (b) b.click();
      else if (hash().name !== "home" && hash().name !== "login" && hash().name !== "tenant") go("/home");
    };
    if (home) home.onclick = () => go("/home");
    const me = await API().me();
    if (!location.hash || location.hash === "#") {
      if (!me.ok) go("/tenant");
      else if (!API().Session.getWarehouse()) go("/warehouse");
      else go("/home");
    } else route();
  });
})();
