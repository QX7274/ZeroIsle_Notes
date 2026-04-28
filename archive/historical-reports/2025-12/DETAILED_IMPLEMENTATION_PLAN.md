# 详细实施计划 - UI/UX修复需求

**计划日期**: 2025-12-11  
**优先级**: 高  
**预计工作量**: 中等

---

## 修改概览

### 需要修改的文件（按优先级）

#### 优先级1 - 关键修改（必须）
1. **src/navigation/AppNavigator.js**
   - 从hideTabBarScreens数组移除'ProfileMain'
   - 保留其他功能中心子界面的隐藏配置

2. **src/screens/settings/ProfileSettings.js**
   - 恢复零屿空间按钮（原第338-354行代码）
   - 知识库颜色改为绿色(#4CAF50)

#### 优先级2 - 返回按钮统一（重要）
3. **src/screens/mind_map/MindMapScreen.js**
   - 添加返回按钮和标题栏（参考SettingsScreen.js）
   - 调整顶部padding

4. **src/screens/knowledge/KnowledgeGraphScreen.js**
   - 添加返回按钮和标题栏
   - 调整顶部padding

5. **src/screens/knowledge/KnowledgeBaseListScreen.js**
   - 添加返回按钮和标题栏
   - 调整顶部padding

#### 优先级3 - 日程和群组（需要查看）
6. **src/screens/reminder/** 中的屏幕
   - 需要查看ReminderNavigator的结构
   - 添加返回按钮

7. **src/screens/groups/** 中的屏幕
   - 需要查看GroupsNavigator的结构
   - 添加返回按钮

#### 优先级4 - 内容对齐（优化）
8. **src/screens/settings/SettingsScreen.js**
   - 检查顶部padding是否需要调整

9. **src/screens/ai/AIAssistantScreen.js**
   - 检查顶部padding是否需要调整

10. **src/screens/community/CommunityScreen.js**
    - 检查顶部padding是否需要调整

---

## 返回按钮参考实现

### SettingsScreen.js中的返回按钮样式

```javascript
// 位置: 第402-418行
<View style={[styles.header, { backgroundColor: colors.card, borderBottomColor: colors.border }]}>
  <TouchableOpacity
    style={[styles.backButton, { backgroundColor: colors.primary + '15' }]}
    onPress={() => navigation.goBack()}
    activeOpacity={0.7}
  >
    <Icon name="arrow-back" size={22} color={colors.primary} />
  </TouchableOpacity>
  <Text
    variant="heading"
    level="h5"
    style={styles.headerTitle}
  >
    应用设置
  </Text>
  <View style={styles.headerRight} />
</View>

// 样式定义: 第698-727行
header: {
  flexDirection: 'row',
  alignItems: 'center',
  justifyContent: 'space-between',
  paddingHorizontal: 16,
  paddingVertical: 12,
  borderBottomWidth: 1,
  shadowColor: '#000',
  shadowOffset: { width: 0, height: 1 },
  shadowOpacity: 0.05,
  shadowRadius: 2,
},
backButton: {
  width: 36,
  height: 36,
  borderRadius: 10,
  justifyContent: 'center',
  alignItems: 'center',
  marginLeft: -4,
},
headerTitle: {
  flex: 1,
  textAlign: 'center',
  fontWeight: '600',
  fontSize: 18,
},
headerRight: {
  width: 40,
},
```

---

## 颜色方案确定

| 功能 | 颜色值 | 用途 |
|------|--------|------|
| 日程 | #0097A7 | 青色 |
| 群组 | #3F51B5 | 蓝色 |
| 思维导图 | #E91E63 | 粉色 |
| 知识图谱 | #FF9500 | 橙色 |
| 知识库 | #4CAF50 | 绿色 |

---

## 实施步骤

### 第1步：修复导航栏显示规则
1. 打开AppNavigator.js
2. 找到hideTabBarScreens数组（第74行）
3. 移除'ProfileMain'（保留其他所有屏幕）
4. 验证底部导航栏在"我的"界面显示

### 第2步：恢复零屿空间按钮
1. 打开ProfileSettings.js
2. 在知识库按钮后添加零屿空间按钮
3. 使用原有的代码（第338-354行）
4. 验证按钮显示和功能

### 第3步：调整知识库颜色
1. 在ProfileSettings.js中修改知识库颜色
2. 在KnowledgeBaseListScreen.js中修改颜色
3. 确保两处颜色一致（#4CAF50）

### 第4步：添加返回按钮
1. 复制SettingsScreen.js的返回按钮实现
2. 逐个添加到各功能中心子界面
3. 确保样式、大小、位置完全一致

### 第5步：调整内容垂直位置
1. 检查各界面的顶部padding
2. 与首页对齐
3. 确保所有界面顶部在同一水平线上

---

## 验证清单

- [ ] 底部导航栏在"我的"界面显示
- [ ] 功能中心子界面底部导航栏隐藏
- [ ] 零屿空间按钮已恢复
- [ ] 知识库颜色为绿色(#4CAF50)
- [ ] 所有功能中心子界面有返回按钮
- [ ] 返回按钮样式一致
- [ ] 所有界面顶部对齐
- [ ] 无编译错误
- [ ] 无运行时警告

---

**下一步**: 按照优先级顺序实施修改

