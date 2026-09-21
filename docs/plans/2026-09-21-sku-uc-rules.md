# SKU / 唯一码基础数据规则

**批准日期：** 2026-09-21  
**状态：** 已经过用户批准（用户明确要求按此规则整体更新项目数据）

## 规则

### 1. SKU

```
SKU = 站点名称 || SPU || 色系 || 尺码
```

| 段 | 含义 | 示例 |
|----|------|------|
| 站点名称 | 基础数据站点 `site_name` | `yours` / `millie` / `atlas` / `petal` / `noir` |
| SPU | 款号 | `FUZ1663` |
| 色系 | 颜色名（英文标识） | `DustyLavender` / `Black` |
| 尺码 | 尺码 | `XS` / `S` / `M` / `L` / `XL` / `2XL` |

完整示例：`yours||FUZ1663||DustyLavender||XS`

派生：

- **SKC（色款）** = `站点名称||SPU||色系`（无尺码）  
  例：`yours||FUZ1663||DustyLavender`

### 2. 唯一码（件级）

```
唯一码 = SKU + "-" + 序列号
```

- 序列号：同一 **SKU** 在同一次加工/收货批次内从 `1` 起递增
- 示例：`yours||FUZ1663||DustyLavender||XS-1`、`…||XS-2`

不再使用「收货单号 + SKU + 序号」旧格式。

## 实现位置

- 生成 / 解析：`wms/shared/js/sku.js`（`WMS_SKU`）
- 业务种子与 `makeUnits`：`wms/shared/js/flow.js`
- 各页在 `flow.js` 之前引入 `sku.js`

## 状态键

演示流 `localStorage` 升为 `wms_flow_v9`，需「重置演示数据」或清旧键后生效。
