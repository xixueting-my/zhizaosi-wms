# PDA 与 WMS 后台接口契约

- **批准日期：** 2026-09-21
- **状态：** 已经过用户批准（「你帮我直接做好，做完之后跟 WMS Web 后台联调」）
- **调用方：** PDA H5（`wms/pda`）。页面只调 `WMS_API`，不直接请求业务地址。
- **实现方：** WMS Web 后台。Web 管理端与 PDA 写同一套单据和唯一码。

演示仍走本地 mock。设置里把数据来源改成「对接 WMS」并填写后台根地址后，PDA 按本文调用。

## 1. 通用约定

根地址示例：`https://wms.example.com`。下面的路径都相对这个根地址。

请求头：

| 头 | 值 |
| --- | --- |
| `Content-Type` | `application/json` |
| `Authorization` | `Bearer {token}`。登录接口除外 |
| `X-Tenant-Id` | 当前租户 id |
| `X-Warehouse-Id` | 当前仓库 id。列表和扫码都按这个仓库过滤 |

响应一律：

```json
{ "ok": true, "data": {}, "message": "" }
{ "ok": false, "message": "给工人看的中文", "code": "SKU_MISMATCH" }
```

`message` 由 PDA 红条原样展示，不要再包一层英文错误。HTTP 401 表示登录过期。网络失败时 PDA 显示「网络异常，请重试」。

`code` 可选。PDA 扫码会用到：`NOT_FOUND`、`SKU_MISMATCH`、`DUP`、`BIZ`、`SHORT`、`NEED_REASON`、`EMPTY`、`CLOSED`。

## 2. 登录与仓库

| 方法 | 路径 | 说明 |
| --- | --- | --- |
| GET | `/api/v1/tenants` | 无需登录。`data` 为 `{id,name,code}[]` |
| POST | `/api/v1/auth/login` | body `{tenantId,username,password}`。成功 `data` 含 `token`、`user`、`tenant` |
| GET | `/api/v1/auth/me` | `data` 含 `user`、`tenant`、`warehouse` |
| POST | `/api/v1/auth/logout` | 退出 |
| GET | `/api/v1/warehouses` | 当前租户可选仓 `{id,name}[]` |
| PUT | `/api/v1/me/warehouse` | body `{warehouseId}`。成功 `data` 为选中的仓库 |

## 3. 单据字段

收货单 `receiving`：`id`、`so_no`、`po_no`、`factory`、`ship_qty`、`received_qty`、`status`（`pending` / `partial` / `received` / `void`）、`ship_time`、`tracking_no`、`arrived_at`、`arrived_by`、`partial_reason`、`lines[]`。

收货行：`sku`、`name`、`ship_qty`、`received_qty`、`session_qty`（本次已扫未提交）。

唯一码 `unit`：`uc`、`sku`、`name`、`so_id`、`so_no`、`status`、`location`、`recommend_location`、`qc_reason`、`session`。

`status`：`expected` 未收、`received` 待质检、`qc_pass` 合格待上架、`qc_fail` 不合格、`qc_repair` 仓内维修、`putaway` 已上架、`picked` 已配货、`checked` 已复核。

配货单：`id`、`ph_no`、`qty`、`picked_qty`、`type`、`status`（`to_pick` / `shortage` / 完成态）、`lines[]`。行含 `line_id`、`location`、`sku`、`qty`、`picked_qty`、`uc`、`shortage`、`order_no`。

盘点任务：`id`、`st_no`、`zone`、`status`（`open` / `doing` / `done`）、`lines[]`。行含 `location`、`sku`、`system_qty`、`count_qty`（未盘为 `null`）。

移位单：`id`、`mv_no`、`from_loc`、`to_loc`、`lines[]`（`uc`、`sku`）。

列表不带筛选时，返回当前仓库里 PDA 还可能扫到的单据（含已完成，便于提示「已完成不可操作」），并带上 `lines`。不要要求 PDA 再拉整库快照。

## 4. PDA 必接接口

### 到货

| 方法 | 路径 | body |
| --- | --- | --- |
| GET | `/api/v1/receiving` | |
| GET | `/api/v1/receiving/{id}` | |
| POST | `/api/v1/receiving/{id}/arrive` | 确认到货。重复确认返回「该单已到货确认」 |

### 收货

| 方法 | 路径 | body |
| --- | --- | --- |
| POST | `/api/v1/receiving/{id}/scan` | `{code}` 唯一码或本单 SKU。写入 `session`，不改实收 |
| POST | `/api/v1/receiving/{id}/draft` | 暂存本次扫描 |
| POST | `/api/v1/receiving/{id}/commit` | `{mode,reason}`。`mode` 为 `partial` 或 `complete` |
| GET | `/api/v1/units?so_id=` | 收货明细 |

未到货不能收。部分收货 `reason` 必填。短收却选收货完成时，`reason` 也必填。本次 0 件不能提交。

### 质检

| 方法 | 路径 | body |
| --- | --- | --- |
| POST | `/api/v1/receiving/{id}/qc/scan` | `{uc,result,reason}`。`result`：`pass` / `fail` / `repair`。不合格和维修必须带 `reason` |
| POST | `/api/v1/receiving/{id}/qc/submit` | 提交本单质检。没有已检件数则失败 |

扫码 `message` 必须区分这些情况，不要统一写成「不属于本单」：

- 扫到的是本单 SKU，且还没收货
- 扫到的是本单 SKU，但已有待检件：指出一条唯一码
- 唯一码属于另一张收货单：写明单号
- 这件未收货、已上架、已出库
- 已经是同一判定
- 系统中没有这个唯一码

未收货的收货单不能进入质检。

### 上架

| 方法 | 路径 | body |
| --- | --- | --- |
| GET | `/api/v1/units?status=qc_pass` | 待上架任务，PDA 按收货单汇总 |
| POST | `/api/v1/putaway/scan-uc` | `{uc}`。仅 `qc_pass` 可上架。成功 `data` 为该唯一码，含推荐库位 |
| POST | `/api/v1/putaway/scan-loc` | `{uc,location}`。成功后状态变为 `putaway` |

扫到 SKU、未质检、不合格、已上架，分别说明，不要只返回状态英文。

### 配货、复核

| 方法 | 路径 | body |
| --- | --- | --- |
| GET | `/api/v1/picks` | |
| GET | `/api/v1/picks/{id}` | |
| POST | `/api/v1/picks/{id}/scan` | `{code}` 唯一码或 SKU |
| POST | `/api/v1/picks/{id}/shortage` | 标记缺货 |
| POST | `/api/v1/picks/{id}/submit` | `{forceShortage}`。仍有未扫行且未强制时，`code=PENDING` |
| POST | `/api/v1/checks/scan` | `{uc}`。成功 `data.order` 为订单（单号、站点、渠道、运单、SKU、数量、已核、状态） |

非待复核订单：`message` 为「该订单非待复核订单」。

### 盘点、移位、异常

| 方法 | 路径 | body |
| --- | --- | --- |
| GET | `/api/v1/stocktakes` | |
| GET | `/api/v1/stocktakes/{id}` | |
| POST | `/api/v1/stocktakes/{id}/start` | |
| POST | `/api/v1/stocktakes/{id}/count` | `{location,sku,qty}`。先库位后 SKU/唯一码 |
| POST | `/api/v1/stocktakes/{id}/draft` | |
| POST | `/api/v1/stocktakes/{id}/submit` | 仍有 `count_qty=null` 则失败 |
| GET | `/api/v1/units/by-uc/{uc}` | 盘点时把唯一码换成 SKU |
| POST | `/api/v1/moves` | 新建移位单，`data` 含 `id`、`mv_no` |
| POST | `/api/v1/moves/{id}/from-loc` | `{location}` |
| POST | `/api/v1/moves/{id}/units` | `{uc}` |
| POST | `/api/v1/moves/{id}/to-loc` | `{location}` |
| POST | `/api/v1/moves/{id}/submit` | 须已有下架明细和目标库位 |
| POST | `/api/v1/exceptions` | `{type,doc_no,reason}` |

## 5. 联调开关

PDA 设置：

- 数据来源「演示数据」：不请求后台
- 数据来源「对接 WMS」：填写后台根地址（不含末尾路径），保存后重新登录

建议联调顺序：登录 → 到货 `SO` → 收货扫唯一码并提交 → 质检扫同一唯一码 → 上架扫库位 → 配货 → 复核。每一步在 WMS Web 上应能看到同一张单的状态变化。
