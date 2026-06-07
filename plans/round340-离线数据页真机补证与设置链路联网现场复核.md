# round340 离线数据页真机补证与设置链路联网现场复核

## 本轮目标
- 延续 `round339`，把 `离线数据` 页从“代码已完成”推进到“真机已补证”。
- 明确回答三个问题：
  - 顶部是否被平板系统状态栏遮挡
  - 返回按钮是否仍统一使用既有淡蓝色方形箭头
  - 深层设置页是否仍会露出主底部 Tab
- 同时观察在当前平板与电脑后端联通已恢复的前提下，页面是否还会误判网络异常。

## 本轮真机路径
- 设备：
  - `HGR3Y9MA`
- 实际路径：
  - `我的 -> 个人资料 -> 应用设置 -> 离线数据`
- 关键中间证据：
  - `tmp_round340_profile_tab.png/.xml`
  - `tmp_round340_settings_entry.png/.xml`
  - `tmp_round340_offline_entry.png/.xml`

## 本轮有效证据

### 1. 设置主页进入正常
- `tmp_round340_settings_entry.xml`
- 已命中：
  - `state.settings.main.state.ready`
  - `action.settings.main.back`
  - `list.settings.main.sections`

### 2. 离线数据页进入正常
- `tmp_round340_offline_entry.xml`
- 已命中：
  - `state.settings.offline.state.ready`
  - `action.settings.offline.back`
  - `list.settings.offline.sections`

### 3. 自定义确认弹层现场
- 重建搜索索引：
  - `tmp_round340_offline_rebuild_dialog.png/.xml`
- 清除离线数据：
  - `tmp_round340_offline_clear_dialog.png/.xml`

## 本轮现场结论

### 1. 顶部安全区通过
- `离线数据` 页头部内容位于系统状态栏下方；
- 没有出现标题或返回按钮被平板顶部状态栏压住的问题；
- 本轮没有发现新的异常顶部留白。

### 2. 返回按钮一致性通过
- `离线数据` 页继续使用统一的淡蓝色方形箭头返回按钮；
- 与 `应用设置`、`AI 助手设置`、`帮助与反馈`、`关于` 等已收口设置深层页保持一致。

### 3. 深层页主 Tab 隐藏通过
- `tmp_round340_offline_entry.xml` 中未再出现主底部 Tab 节点；
- 说明 `离线数据` 页当前结构已符合“深层设置页不露主 Tab”的规范。

### 4. 原生安卓弹窗收口已真机成立
- `重建搜索索引` 与 `清除离线数据` 均出现项目内自定义圆角确认弹层；
- 未再出现默认安卓 `Alert` 风格；
- 说明 `round339` 的核心视觉/交互整改在真机上已经落地。

### 5. 联网状态现场正常
- `tmp_round340_offline_entry.xml` 中 `网络状态` 文本为 `在线`；
- 这说明在当前平板与电脑后端链路打通后，此页没有继续把联网环境误判成“无网络”。

## 本轮验收状态
- `offline-data-top-safe-area-flow`：`PASS`
- `offline-data-back-button-consistency-flow`：`PASS`
- `offline-data-main-tab-hide-flow`：`PASS`
- `offline-data-confirm-dialog-style-flow`：`PASS`
- `offline-data-network-online-state-flow`：`PASS`
- `offline-data-result-toast-flow`：`DONE_IN_CODE`
- `offline-data-inline-status-card-flow`：`DONE_IN_CODE`

## 本轮未强行补做的项
- 由于当前页面真实 `待同步项 = 0`，本轮没有为了制造“成功/失败提示”而人为污染数据环境；
- 因此：
  - `Toast + statusCard` 的结构性实现仍以代码与后续业务场景复测为准；
  - 本轮重点放在“页面结构正确、弹层风格统一、网络不误判”的真机闭环。

## 下一步
- 继续沿设置系抽查仍可能残留默认安卓弹窗的深层页；
- 在出现真实同步队列时，再补一轮 `立即同步` 成功态/失败态真机证据；
- 继续坚持：
  - 顶部不被系统状态栏遮挡
  - 返回按钮统一
  - 深层页不露主 Tab
  - 只改明显原始的页面实现，不动成熟骨架
