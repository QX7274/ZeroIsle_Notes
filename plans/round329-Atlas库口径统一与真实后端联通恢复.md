# round329 - Atlas库口径统一与真实后端联通恢复

## 1. 本轮目标
- 把上一轮已经确认的“Mongo 本地未启动导致业务接口假死”继续向下收口到真正可联调状态。
- 修正开发环境下 `PyMongo` 与 `MongoEngine` 数据库指向不一致的问题，避免出现：
  - `PyMongo` 能看到真实用户；
  - `MongoEngine` / Django 业务查询却落到另一套库，进而把真实用户判成“不存在”。
- 用真实正式登录链路验证后端与平板之间的联通已经恢复，不再继续误判成“没网”。
- 继续保持用户既定规范：
  - 顶部风格统一；
  - 页面顶部不得被状态栏遮挡；
  - 返回按钮继续统一为已有淡蓝色方形箭头；
  - 网络问题继续统一走项目内优美样式弹窗；
  - 不动成熟 UI，只处理真实缺陷与明显原始部分；
  - 页面布局继续避免不合理留白。

## 2. 新发现的真实根因
- `backend/.env` 已切到 Atlas 后，`health/` 秒回、鉴权接口也不再卡 60 秒，这说明上一层 Mongo 阻塞问题已经解除。
- 但继续登录联调时又出现新的“数据口径分裂”：
  - `PyMongo` 在 `ZeroIsle_Notes.users` 中能看到真实用户 `user_8000 / 13800138000`；
  - 旧版 `backend/backend/settings/development.py` 却在开发环境里重新手写了一套 Mongo 连接逻辑；
  - 其中 `MongoEngine.connect()` 没有统一使用 `MONGO_DB`，导致开发环境下 `PyMongo` 和 `MongoEngine` 并不一定落到同一个数据库。
- 结果表现为：
  - `PyMongo` 看到用户存在；
  - 登录接口最初却返回 `用户不存在`；
  - 这是库口径问题，不是前后端网络没打通。

## 3. 本轮代码处理

### 3.1 统一开发环境 Atlas 数据库口径
- 文件：`backend/backend/settings/development.py`
- 处理：
  - 新增 `mongo_db_name = os.environ.get('MONGO_DB', 'ZeroIsle_Notes')`
  - `MONGO_CLIENT` 与 `MONGO_DB` 统一使用 `mongo_db_name`
  - `mongoengine.connect(...)` 也统一显式传入 `db=mongo_db_name`
- 目的：
  - 保证开发环境下 `PyMongo`、`MongoEngine`、Django 业务查询都落到同一个 Atlas 库；
  - 避免继续出现“脚本看到用户，接口却查不到用户”的分裂状态。

### 3.2 修复社区发帖保存时的后端 500
- 文件：`backend/community/mongodb_models.py`
- 根因：
  - `Post.save()` / `Comment.save()` 里把 `bleach.sanitizer.ALLOWED_TAGS` 当列表与自定义列表直接相加；
  - 当前 `bleach` 返回的是 `frozenset`，执行 `frozenset + list` 会直接抛：
    - `TypeError: unsupported operand type(s) for +: 'frozenset' and 'list'`
- 处理：
  - 统一改成 `list(bleach.sanitizer.ALLOWED_TAGS) + [...]`
- 影响：
  - 这是社区真实发帖 500 的直接后端根因；
  - 修完后，至少模型保存链已不再卡在这一层。

## 4. 真实联通验证结果

### 4.1 成功恢复的链路
- `GET /health/`
  - 正常返回 `200`
- `POST /api/v1/auth/verification-code/`
  - 使用 `phone=13800138000, purpose=login`
  - 正常返回 `200` 和开发验证码
- `POST /api/v1/auth/login/`
  - 使用真实手机号 + 验证码
  - 正常返回 `200`
  - 后端正式返回 `access / refresh / user`
- `GET /api/v1/auth/profile/`
  - 携带正式 `Bearer access`
  - 正常返回 `200`
- `GET /api/v1/community/posts/my/`
  - 携带正式 `Bearer access`
  - 正常返回 `200`

### 4.2 继续暴露出的链路
- `POST /api/v1/community/posts/`
  - 在本轮修复前返回 `500`
  - 已定位为 `backend/community/mongodb_models.py` 中 `bleach` 标签集合拼接错误
- 这说明：
  - “网络没打通”这个判断已经不成立；
  - 剩余问题已经从“联通层”进入“后端具体业务实现层”。

## 5. 本轮执行证据
- 代码：
  - `backend/backend/settings/development.py`
  - `backend/community/mongodb_models.py`
- 环境与接口结论：
  - Atlas 真实用户：`user_8000 / 13800138000`
  - 正式验证码登录成功，后端返回真实 `access / refresh`
  - `profile` 与 `my posts` 已恢复到 `200`
- 模型级验证：
  - 进程内直接创建 `Post(...)` 并调用 `save()` 后，已不再触发 `frozenset + list` 异常

## 6. 对真机与页面整改主线的影响
- 本轮虽然主要在后端联通与服务端错误层面推进，但对真机验收主线是关键解锁：
  - 社区页后续“创建帖子 -> 发布”终于可以进入真实后端业务调试，而不再被前端误判离线或后端查不到用户挡住；
  - 后续平板真机测试时，仍要持续检查：
    - 顶部是否被状态栏遮挡；
    - 社区页顶部留白是否异常；
    - 返回按钮是否仍统一为淡蓝方形箭头；
    - 网络异常是否仍走项目内统一优美样式弹窗；
    - 不合理空白是否继续被收口。

## 7. 下一步
1. 重新起稳定的后端对照实例，带着本轮修复后的代码再次验证 `POST /api/v1/community/posts/` 是否转为 `201`。
2. 把正式 token 联调结果回灌到真机：
   - `社区 -> 创建帖子 -> 发布`
   - 核验真实发帖是否成功，不再只是离线失败态。
3. 继续沿社区内容态、通知、Activity、个人主页等页面做真实平板验收，同时保持顶部安全区、返回按钮和异常弹窗风格一致。
