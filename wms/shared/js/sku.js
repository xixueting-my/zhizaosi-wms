/**
 * SKU / 唯一码生成与解析
 * 规则：docs/plans/2026-09-21-sku-uc-rules.md
 *
 * SKU  = 站点名称 || SPU || 色系 || 尺码
 * SKC  = 站点名称 || SPU || 色系
 * 唯一码 = SKU + "-" + 序列号（同一 SKU 加工序号，从 1 起）
 */
window.WMS_SKU = (function () {
  const SEP = "||";

  function norm(v) {
    return String(v == null ? "" : v).trim();
  }

  function build(parts) {
    const site = norm(parts.site || parts.site_name);
    const spu = norm(parts.spu);
    const color = norm(parts.color || parts.colorway);
    const size = norm(parts.size);
    if (!site || !spu || !color || !size) {
      throw new Error("SKU 需要 site / spu / color / size");
    }
    return [site, spu, color, size].join(SEP);
  }

  function buildSkc(parts) {
    const site = norm(parts.site || parts.site_name);
    const spu = norm(parts.spu);
    const color = norm(parts.color || parts.colorway);
    return [site, spu, color].join(SEP);
  }

  function parse(sku) {
    const raw = norm(sku);
    const segs = raw.split(SEP);
    if (segs.length >= 4) {
      const site = segs[0];
      const spu = segs[1];
      const color = segs[2];
      const size = segs.slice(3).join(SEP);
      return {
        sku: raw,
        site,
        spu,
        color,
        size,
        skc: [site, spu, color].join(SEP),
        valid: true,
      };
    }
    // 兼容旧格式：SPU_Color||Size||YU
    if (segs.length === 3 && segs[0].indexOf("_") >= 0) {
      const head = segs[0];
      const us = head.lastIndexOf("_");
      const spu = head.slice(0, us);
      const color = head.slice(us + 1);
      return {
        sku: raw,
        site: "",
        spu,
        color,
        size: segs[1],
        skc: head,
        valid: false,
        legacy: true,
      };
    }
    return {
      sku: raw,
      site: "",
      spu: segs[0] || "",
      color: "",
      size: "",
      skc: segs[0] || "",
      valid: false,
    };
  }

  function buildUc(sku, seq) {
    const n = Number(seq);
    if (!sku || !n || n < 1) throw new Error("唯一码需要 sku 与从 1 起的序列号");
    return norm(sku) + "-" + n;
  }

  function parseUc(uc) {
    const raw = norm(uc);
    const m = raw.match(/^(.*)-(\d+)$/);
    if (!m) return { uc: raw, sku: "", seq: 0, valid: false };
    return { uc: raw, sku: m[1], seq: Number(m[2]), valid: true };
  }

  return {
    SEP,
    build,
    buildSkc,
    parse,
    buildUc,
    parseUc,
  };
})();
