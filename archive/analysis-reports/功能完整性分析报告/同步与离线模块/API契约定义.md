# 同步服务 API 契约定义 v1.0

本文件定义了客户端与服务端之间进行数据同步的统一API契约，旨在确保数据交换的可靠性、一致性和可预测性。

---

## 1. 通用响应结构

所有同步API的响应都应遵循以下基本结构：

```json
{
  "success": true,
  "data": { ... },
  "errors": [],
  "timestamp": "2023-10-27T10:00:00Z"
}
```

-   `success` (boolean): 请求是否成功处理。
-   `data` (object | null): 成功时返回的数据负载。失败时为 `null`。
-   `errors` (array): 请求失败时返回的错误对象数组。成功时为空数组 `[]`。
-   `timestamp` (string): 服务器处理完成该请求的时间戳 (ISO 8601格式)。

### 1.1. 统一错误对象

所有`errors`数组中的错误对象都必须包含以下字段：

```json
{
  "code": "ERROR_CODE_NAME",
  "message": "A human-readable error message."
}
```

-   `code` (string): 一个程序可读的、唯一的错误码。
-   `message` (string): 一个供开发者阅读的、清晰的错误描述。

---

## 2. 拉取数据 (Pull) API 契约

所有用于从服务器拉取数据的 `pull_*` 端点（如 `pull_notes`, `pull_reminders`）必须遵循此契约。

### 2.1. 成功响应 (`success: true`)

`data` 对象必须包含以下结构：

```json
{
  "items": [
    { "_id": "...", "content": "...", ... },
    { "_id": "...", "content": "...", ... }
  ],
  "next_cursor": "2023-10-27T09:30:00.000Z_653b8a8f1c3b4a2b8e6a3d7c"
}
```

-   `items` (array): 本次请求返回的数据对象数组。
-   `next_cursor` (string | null): 用于获取下一页数据的游标。如果为 `null`，表示所有数据均已拉取完毕。

### 2.2. 游标 (Cursor) 机制

-   **实现方式**: 游标是一个基于 `updated_at` 和 `_id` 的组合字符串，格式为 `{iso_timestamp}_{object_id}`。
-   **工作流程**:
    1.  客户端首次请求时不带 `cursor` 参数。
    2.  服务器返回第一页数据和 `next_cursor`。
    3.  客户端下次请求时，将收到的 `next_cursor` 作为 `cursor` 参数传入。
    4.  重复此过程，直到服务器返回的 `next_cursor` 为 `null`。

---

## 3. 推送数据 (Push) API 契约

所有用于向服务器推送（创建、更新、删除）数据的 `sync_*` 端点（如 `sync_notes`, `sync_user_settings`）必须遵循此契约。

### 3.1. 成功响应 (`success: true`)

`data` 对象必须包含以下结构，即使只处理单个对象：

```json
{
  "created": 1,
  "updated": 5,
  "unchanged": 10,
  "deleted": 2,
  "conflicts": 0,
  "failed": 0,
  "details": [
    { "id": "...", "status": "created" },
    { "id": "...", "status": "updated" },
    { "id": "...", "status": "failed", "error": "Invalid field value." }
  ]
}
```

-   `created` (integer): 本次推送中成功创建的对象数量。
-   `updated` (integer): 成功更新的对象数量。
-   `unchanged` (integer): 未发生任何变更的对象数量。
-   `deleted` (integer): 成功删除的对象数量。
-   `conflicts` (integer): 发生冲突且根据策略未被处理的对象数量。
-   `failed` (integer): 因校验失败等原因未能处理的对象数量。
-   `details` (array, optional): 一个包含每个对象处理结果详情的数组，用于客户端进行精细的状态更新。
