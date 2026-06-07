# round337 设置系深层页主Tab收口与真机复核记录

## 本轮目标
- 延续 `我的 -> 应用设置` 真机复核，优先确认：
  - `应用设置`
  - `帮助与反馈`
  - `关于`
- 继续执行既定规范：
  - 顶部不被平板状态栏遮挡
  - 返回按钮统一使用已有淡蓝色方形箭头
  - 设置深层页不得露出主底部 Tab
  - 只处理明显原始问题，不破坏成熟视觉

## 本轮先验约束
- 不把系统通知权限弹窗误记为产品缺陷。
- 不把调试期底部黑条、瞬时白屏容器态、Metro 噪声误记为业务回归。
- 工作区存在大量既有脏改，本轮只做最小导航增量与文档回填。

## 本轮实际处理

### 1. 定位设置系页面仍露出主 Tab 的真实问题
- 真机先后复核了：
  - `个人资料`
  - `应用设置`
  - `帮助与反馈`
  - `关于`
- 复核结论：
  - `个人资料` 主页保留主 Tab 合理；
  - 但 `应用设置`、`帮助与反馈`、`关于` 这类深层设置页此前仍与主底部 Tab 同层显示；
  - 这与既定“深层页应脱离主底部导航”的规范不一致，属于真实结构问题，不是截图时序误差。

### 2. 导航层最小收口
- 修改文件：`src/navigation/AppNavigator.js`
- 本轮改动：
  - 保留原有 `hideTabBar` 参数链与 `nestedFlowScreens` 判定；
  - 在 `getTabBarStyle` 中补充针对 `Profile` Tab 的稳定判定：
    - 当 `Profile` 下聚焦子路由不是 `ProfileMain` 时，主 Tab 直接隐藏；
    - 让 `我的` 主页继续保留主 Tab；
    - 让从 `我的` 进入的设置深层页统一脱离主底部导航。
- 本轮没有改动：
  - 设置页头部布局
  - 统一淡蓝色方形返回按钮
  - 既有浅蓝卡片体系
  - 个人资料功能中心成熟样式

## 真机复核结果

### 1. 个人资料页
- 有效证据：
  - `tmp_round337_live.png`
  - `tmp_round337_live.xml`
  - `tmp_round337_profile_seq.png`
  - `tmp_round337_profile_seq.xml`
- 有效结论：
  - 命中 `state.profile.state.ready`
  - 顶部安全区正常
  - 返回按钮仍为统一淡蓝色方形箭头
  - `entry.settings.profile` 可稳定进入 `应用设置`
  - 主页保留主 Tab 合理，未误伤

### 2. 应用设置页
- 修复前证据：
  - `tmp_round337_settings_home.png`
  - `tmp_round337_settings_home.xml`
  - `tmp_round337_settings_scrolled.png`
  - `tmp_round337_settings_scrolled.xml`
- 修复后有效证据：
  - `tmp_round337_settings_seq.png`
  - `tmp_round337_settings_seq.xml`
- 修复后有效结论：
  - 命中 `state.settings.main.state.ready`
  - 顶部标题区仍位于系统状态栏之下
  - 返回按钮仍统一使用淡蓝色方形箭头
  - 应用主 Tab 已不再出现在页面底部
  - 底部仅剩系统手势条，不属于应用底部导航

### 3. 关于页
- 修复前证据：
  - `tmp_round337_about.png`
  - `tmp_round337_about.xml`
- 修复后有效证据：
  - `tmp_round337_help_after_fix.png`
  - `tmp_round337_help_after_fix.xml`
- 有效结论：
  - 实际现场稳定停留在 `关于`
  - 顶部安全区正常
  - 返回按钮样式保持统一
  - 主 Tab 已被正确隐藏
  - 页面未再出现深层页挂着主底栏的结构问题

### 4. 帮助与反馈页
- 修复后有效证据：
  - `tmp_round337_help_final.png`
  - `tmp_round337_help_final.xml`
- 有效结论：
  - 真机稳定命中 `state.settings.help.state.ready`
  - 返回按钮命中 `action.settings.help.back`，样式仍为统一淡蓝色方形箭头
  - 页面标题区仍处于系统状态栏安全区之下，没有被平板顶部状态栏遮挡
  - `tmp_round337_help_final.xml` 中未出现 `nav.tab.profile`，说明主 Tab 已被正确隐藏
  - 帮助页中的 FAQ、联系方式、反馈表单均已正常承接，不再挂着主页底栏壳子

## 过程噪声说明
- 重启调试包后曾弹出系统通知权限请求框：
  - 这是系统授权弹窗，不属于“网络异常弹窗风格”整改范围；
  - 本轮已显式剔除，不计入业务缺陷。

## 本轮结论
- 已完成：
  - `我的` 分支下设置深层页主 Tab 穿透问题的导航层收口
  - `应用设置` 真机复核通过
  - `关于` 真机复核通过
  - `帮助与反馈` 真机复核通过
  - 顶部安全区与统一淡蓝色方形返回按钮未回退
- 未在本轮继续扩展：
  - `AI 助手设置`
  - `主题`
  - `字体大小`

## 下一步
- 下一轮继续沿设置深层页推进：
  - `AI 助手设置`
  - `主题`
  - `字体大小`
- 继续保持：
  - 顶部不被平板状态栏遮挡
  - 返回按钮统一使用已有淡蓝色方形箭头
  - 深层页主 Tab 隐藏
  - 只改明显原始区域，不动成熟部分
