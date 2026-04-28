# 提醒模块 API 契约文档 (实例操作)

本文档为前端开发人员提供了与提醒模块中“实例操作”相关的新增及改造后API的详细对接规范。

---

## 1. 完成提醒实例

### 端点与方法
`POST /api/reminders/{id}/complete/`

### 功能描述
标记一个提醒为完成状态。此端点经过改造，现在可以区分处理单个实例和整个系列：
- **对于重复提醒**：如果请求体中提供了 `occurrence_date`，则仅将该日期的实例标记为“已完成”（通过创建一条例外记录），而不会终止整个重复系列。
- **对于非重复提醒或未提供 `occurrence_date`**：行为与之前一致，将整个提醒对象标记为完成。

### 请求体 (Request Body)

| 参数 | 类型 | 是否必填 | 描述 |
| :--- | :--- | :--- | :--- |
| `occurrence_date` | String | 否 | 要完成的重复实例的原始发生日期，必须为 ISO 8601 格式 (例如 `YYYY-MM-DDTHH:mm:ss.sssZ`)。 |

**JSON 示例 (完成单个实例):**
```json
{
  "occurrence_date": "2025-12-25T09:00:00Z"
}
```

### 成功响应 (Success Response)
- **状态码:** `200 OK`
- **响应体:** 返回更新后的 `Reminder` 对象，其中 `exceptions` 列表会包含新的“已完成”记录。

**JSON 示例:**
```json
{
  "id": "...",
  "title": "每日站会",
  "frequency": "daily",
  "exceptions": [
    {
      "original_occurrence_date": "2025-12-25T09:00:00Z",
      "status": "completed",
      "created_at": "..."
    }
  ],
  // ...其他字段
}
```

### 错误响应 (Error Responses)

- **400 Bad Request (无效日期格式)**
  ```json
  {
    "detail": "无效的 occurrence_date 格式"
  }
  ```
- **404 Not Found (提醒不存在)**
  ```json
  {
    "detail": "提醒不存在或无权访问"
  }
  ```

---

## 2. 取消提醒实例

### 端点与方法
`POST /api/reminders/{id}/cancel_occurrence/`

### 功能描述
取消一个重复提醒系列中的**单个**实例，使其在该日期不再发生，但不会影响后续的实例。

### 请求体 (Request Body)

| 参数 | 类型 | 是否必填 | 描述 |
| :--- | :--- | :--- | :--- |
| `occurrence_date` | String | 是 | 要取消的重复实例的原始发生日期，必须为 ISO 8601 格式。 |

**JSON 示例:**
```json
{
  "occurrence_date": "2025-12-26T09:00:00Z"
}
```

### 成功响应 (Success Response)
- **状态码:** `200 OK`
- **响应体:** 返回更新后的 `Reminder` 对象，其中 `exceptions` 列表会包含新的“已取消”记录。

### 错误响应 (Error Responses)

- **400 Bad Request (缺少参数)**
  ```json
  {
    "detail": "必须提供 occurrence_date"
  }
  ```
- **404 Not Found (提醒不存在)**
  ```json
  {
    "detail": "提醒不存在或无权访问"
  }
  ```

---

## 3. 延期提醒实例

### 端点与方法
`POST /api/reminders/{id}/reschedule_occurrence/`

### 功能描述
将一个重复提醒系列中的**单个**实例延期（Snooze）到一个新的日期和时间。

### 请求体 (Request Body)

| 参数 | 类型 | 是否必填 | 描述 |
| :--- | :--- | :--- | :--- |
| `occurrence_date` | String | 是 | 要延期的重复实例的原始发生日期 (ISO 8601)。 |
| `new_due_date` | String | 是 | 延期后的新到期日期 (ISO 8601)。 |

**JSON 示例:**
```json
{
  "occurrence_date": "2025-12-27T09:00:00Z",
  "new_due_date": "2025-12-27T14:00:00Z"
}
```

### 成功响应 (Success Response)
- **状态码:** `200 OK`
- **响应体:** 返回更新后的 `Reminder` 对象，其中 `exceptions` 列表会包含新的“已延期”记录。

### 错误响应 (Error Responses)

- **400 Bad Request (缺少参数)**
  ```json
  {
    "detail": "必须提供 occurrence_date 和 new_due_date"
  }
  ```
- **404 Not Found (提醒不存在)**
  ```json
  {
    "detail": "提醒不存在或无权访问"
  }
  ```