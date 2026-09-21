# WMS 基础数据管理 — 产品方案与数据表

- **批准日期：** 2026-09-20
- **状态：** 已经过用户批准（正式开始；HTML 原型 + 表结构；枚举先用 mock）
- **原型目录：** `wms/basic/`
- **范围：** 基础数据管理（仓库管理 / 参数配置 / 策略配置）

---

## 1. 信息架构（侧栏）

> 侧栏由 `wms/basic/js/shell.js` 统一注入，目录以产品定义为准。

```text
基础数据管理
  ├─ 仓库管理      → warehouse.html
  ├─ 参数配置      → params.html
  └─ 策略配置      → strategy.html
入库管理
  ├─ 收货单管理
  ├─ 入库单管理
  └─ 上架任务
出库管理
  ├─ 订单列表
  ├─ 下发波次
  └─ 配货单
库内管理
  ├─ 库存盘点
  ├─ 商品移位
  └─ 操作记录
数据中心
  ├─ 库存查询
  └─ 进销存报表
```

配色规范（对齐领星）：主色 `#1890ff`，浅色侧栏 `#f7f8fa`，选中项浅蓝底 + 右侧蓝条。

### 仓库管理页内区块

1. 仓库配置  
2. 库区配置  
3. 库位管理  

### 参数配置页内区块

1. 审批流配置  
2. 部分收货原因配置  
3. 质检不合格原因配置  
4. 站点库区配置  

### 策略配置页内区块

1. 预占规则配置（上架预占库位）  
2. 波次规则  
3. 配货规则配置  

---

## 2. 实体关系

```text
warehouse（仓库）
  └─ zone（库区）  ──N:1──  site（站点，mock）
       └─ location（库位）

site_zone_binding（站点库区配置）
  site 1 ── N zone（绑定），其中 1 个为 default_zone

approval_flow / partial_receive_reason / qc_fail_reason
putaway_rule / wave_rule / allocate_rule
```

**层级约束：** 库位必须属于库区；库区必须属于仓库。删仓前须无库区；删库区前须无库位（原型期用提示拦截）。

---

## 3. 数据表（供研发建表 / 后续调整）

> 约定：主键 `bigint` 自增；业务编码唯一；软删可选 `deleted_at`；审计字段统一。  
> 枚举列本期存字符串或 tinyint，具体枚举值待用户补充后固化。

### 3.1 `wms_warehouse` 仓库

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| id | bigint PK | Y | |
| warehouse_code | varchar(50) UK | Y | 仓库编码，创建后建议不可改 |
| warehouse_name | varchar(50) | Y | 仓库名称 |
| province | varchar(50) | N | 省 |
| city | varchar(50) | N | 市 |
| district | varchar(50) | N | 区 |
| address | varchar(200) | N | 详细地址 |
| postal_code | varchar(20) | N | 邮政编码 |
| contact_name | varchar(50) | N | 联系人 |
| contact_phone | varchar(30) | N | 联系电话 |
| remark | varchar(500) | N | 备注 |
| status | tinyint | Y | 1启用 0停用（列表可扩展） |
| updated_by | varchar(50) | N | 最后编辑人 |
| updated_at | datetime | Y | 最后编辑时间 |
| created_at | datetime | Y | |

### 3.2 `wms_zone` 库区

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| id | bigint PK | Y | |
| zone_code | varchar(50) UK | Y | 库区编码 |
| zone_name | varchar(50) | Y | 库区名称 |
| warehouse_id | bigint FK | Y | 所属仓库 |
| site_id | bigint FK | N | 所属站点；全仓共享时可空（见交互） |
| zone_type | varchar(32) | Y | 库区类型枚举（mock：普通库区/冷藏/危险品…） |
| updated_by | varchar(50) | N | |
| updated_at | datetime | Y | |
| created_at | datetime | Y | |

### 3.3 `wms_location` 库位

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| id | bigint PK | Y | |
| location_code | varchar(50) UK | Y | 库位编码 |
| zone_id | bigint FK | Y | 所属库区（间接得仓库、站点） |
| pick_priority | decimal(10,2) | Y | 拣货优先级，≥0，最多2位小数 |
| sku_qty_limit | int | N | SKU 数量上限，0 表示不限制 |
| is_empty | tinyint | Y | 是否空库位（可由库存反算，列表展示） |
| status | tinyint | Y | 1正常/启用 0停用 |
| updated_by | varchar(50) | N | |
| updated_at | datetime | Y | |
| created_at | datetime | Y | |

**索引建议：** `(warehouse_id)` 经 zone 关联查询；`(zone_id, status)`；`location_code` 唯一。

### 3.4 `wms_site` 站点（主数据，本期 mock）

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| id | bigint PK | Y | |
| site_code | varchar(50) UK | Y | |
| site_name | varchar(100) | Y | |

### 3.5 `wms_site_zone` 站点库区配置

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| id | bigint PK | Y | |
| site_id | bigint FK UK | Y | 一站点一条配置 |
| default_zone_id | bigint FK | Y | 须属于绑定库区 |
| updated_by / updated_at / created_at | | | |

### 3.6 `wms_site_zone_item` 站点绑定库区明细

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| id | bigint PK | Y | |
| site_zone_id | bigint FK | Y | |
| zone_id | bigint FK | Y | UK(site_zone_id, zone_id) |

### 3.7 `wms_approval_flow` 审批流

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| id | bigint PK | Y | |
| flow_name | varchar(100) | Y | 如：盘点审批 |
| flow_code | varchar(50) UK | N | 业务编码 |
| node_1_user_id … node_6_user_id | bigint | N | 最多6节点，空则跳过 |
| remark | varchar(500) | N | |
| updated_by / updated_at / created_at | | | |

### 3.8 `wms_partial_receive_reason` 部分收货原因

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| id | bigint PK | Y | |
| reason_desc | varchar(200) | Y | 原因描述 |
| status | tinyint | Y | 1启用 0停用 |
| updated_by / updated_at / created_at | | | |

### 3.9 `wms_qc_fail_reason` 质检不合格原因

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| id | bigint PK | Y | |
| category_l1 | varchar(100) | Y | 一级分类 |
| category_l2 | varchar(100) | Y | 二级分类 |
| category_l3 | varchar(100) | Y | 三级分类 |
| updated_by / updated_at / created_at | | | |

### 3.10 `wms_putaway_rule` 预占规则

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| id | bigint PK | Y | |
| rule_code | varchar(50) UK | Y | YZGZ01… |
| rule_name | varchar(100) | Y | |
| status | tinyint | Y | **全局同时仅允许一条启用** |
| description | varchar(500) | N | 规则说明 |
| updated_by / updated_at / created_at | | | |

### 3.11 `wms_wave_rule` 波次规则

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| id | bigint PK | Y | |
| rule_code | varchar(50) UK | Y | BCGZ01… |
| rule_name | varchar(100) | Y | |
| generate_time | time | Y | 生成时间 HH:mm |
| order_qty | int | Y | 单量阈值 |
| status | tinyint | Y | 启用/停用 |
| updated_by / updated_at / created_at | | | |

### 3.12 `wms_allocate_rule` 配货规则

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| id | bigint PK | Y | |
| rule_code | varchar(50) UK | Y | PHGZ01… |
| rule_name | varchar(100) | Y | |
| weight | int | Y | 权重 |
| status | tinyint | Y | |
| updated_by / updated_at / created_at | | | |

---

## 4. 交互流程与细节

> **2026-09-20 UX 修订：** 原型图中的 ①②③ 表示「同页应覆盖的内容块」，落地为 **Tab 切换**，而非长页纵向堆叠。表单改为 **右侧抽屉**。视觉与信息密度参考成熟跨境 ERP（如领星）的交互范式，不复制其业务内容。

### 4.1 通用

- **页头：** 标题 + 一句话说明 + 随 Tab 变化的主操作按钮。  
- **Tab：** 同模块内多实体用 Tab；URL hash 记忆当前 Tab（可刷新回落）。  
- **层级引导（仓库页）：** 仓库 → 库区 → 库位 可点击跳转，并与 Tab 联动。  
- **列表：** 筛选条 + 工具栏 + 表 + 分页；空状态带引导 CTA。  
- **表单：** 右侧抽屉；Esc / 遮罩关闭；必填校验失败不关抽屉。  
- **编码：** 新增可填，编辑只读。  
- **审计：** 保存写入当前用户与时间（mock）。

### 4.2 仓库

1. 新增：编码、名称必填，≤50 字；编码全局唯一。  
2. 省市区联动（mock 三级数据）。  
3. 编辑：回填全部字段；编码只读。

### 4.3 库区

1. 所属仓库必选；库区类型必选。  
2. 所属站点：可选；提示「全仓共享库区可不选站点」。  
3. 筛选项仓库/站点/类型联动过滤列表。

### 4.4 库位

1. 所属库区必选（选库区后展示所属仓/站）。  
2. 拣货优先级：≥0，最多 2 位小数。  
3. SKU 数量上限：整数，≥0，0=不限制。  
4. 批量：勾选后启用/停用；打印条码、导入、下载模板 — 原型期 Toast「功能占位」。  
5. 「是否空库位」列表展示，新增表单不手填（由库存反算；mock 可写死）。

### 4.5 审批流

1. 编辑最多 6 个节点，下拉选人（mock 用户列表）。  
2. 红色说明：盘点任务共用；空节点跳过；改配置后在途任务从节点一重走。  
3. 保存前二次确认（因影响在途盘点）。

### 4.6 部分收货原因

- 新增/编辑描述 + 状态；支持批量启用/停用。

### 4.7 质检不合格原因

- 三级文本；支持按一二三级筛选。

### 4.8 站点库区

1. 绑定库区多选；默认库区必须是已绑定之一。  
2. 提示：选完后相关库存数据锁定（文案展示；逻辑后续接库存）。  
3. 一站点仅一条配置（新增时站点不可重复）。

### 4.9 预占规则

- **启用互斥：** 启用一条时，自动停用其他（或提示先停用当前启用项）。  
- 规则说明区展示 YZGZ01/02/03 业务含义（只读文案）。

### 4.10 波次规则

- 可新增；编辑名称、生成时间、单量；批量启用/停用。

### 4.11 配货规则

- 启用/停用；权重展示；编辑可后续扩展（本期可编辑权重与名称）。

---

## 5. Mock 枚举（待用户替换）

| 枚举 | Mock 值 |
|------|---------|
| 库区类型 | 普通库区、冷藏库区、危险品库区、退货库区 |
| 站点 | SITE01 华东站、SITE02 华南站、SITE03 西南站 |
| 是否空库位 | 全部 / 是 / 否 |
| 启用状态 | 启用 / 停用 |
| 审批人 | 陆舟、蒋兵、许建伟、张荷虎、何宇麟 |
| 省市区 | 简化三级 mock |

---

## 6. 交付物路径

| 路径 | 说明 |
|------|------|
| `wms/basic/warehouse.html` | 仓库 / 库区 / 库位 |
| `wms/basic/params.html` | 参数配置 |
| `wms/basic/strategy.html` | 策略配置 |
| `wms/basic/css/wms.css` | 公共样式 |
| `wms/basic/js/mock.js` | Mock 数据与枚举 |
| `wms/basic/js/common.js` | 布局、Tab、抽屉、Toast、工具 |

本地直接用浏览器打开 HTML 即可预览。

---

## 7. 修订记录

| 日期 | 说明 |
|------|------|
| 2026-09-20 | 初版：按用户 WMS 原型目录启动基础数据配置 |
| 2026-09-20 | UX 重构：①②③ 落地为 Tab；表单改为右侧抽屉；页头/空状态/层级引导/更多菜单；视觉参考成熟跨境 ERP 交互密度 |
| 2026-09-20 | 配色对齐领星系统蓝；侧栏改为浅色可折叠目录，严格按用户 WMS 目录定义（`js/shell.js` 统一注入） |
