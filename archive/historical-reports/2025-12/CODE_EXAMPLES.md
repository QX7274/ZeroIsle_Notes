# 代码示例与参考

## 1. MainNavigator.js 完整修改

### 导入部分（第1-31行）

```javascript
import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createStackNavigator } from '@react-navigation/stack';
import { useSelector } from 'react-redux';
import { selectTheme } from '../redux/slices/uiSlice';
import { colors } from '../utils/constants/colors';

// 导入知识图谱组件
import { 
  KnowledgeGraphScreen, 
  NodeDetailScreen, 
  KnowledgeAnalysisScreen,
  KnowledgeBaseListScreen,      // 新增
  KnowledgeBaseDetailScreen,    // 新增
  KnowledgeBaseEditScreen       // 新增
} from '../screens/knowledge';
import { NoteListScreen, NoteEditScreen, VoiceToTextScreen, NoteDetailScreen } from '../screens/notes';
import { InfiniteCanvasListScreen } from '../screens/canvas';
import FluidInfiniteCanvasScreenNative from '../screens/canvas/FluidInfiniteCanvasScreenNative';
import { MindMapScreen, MindMapEditScreen, MindMapTemplateScreen } from '../screens/mind_map';
import { SearchScreen } from '../screens/search';
import { ProfileSettings, SettingsScreen, BindPhone, BindEmail, ThemeSettingsScreen, SyncSettingsScreen } from '../screens/settings';
import { FileViewerScreen } from '../screens/common';
import AIAssistantScreen from '../screens/ai/AIAssistantScreen';
import CommunityScreen from '../screens/community/CommunityScreen';
import CategoryScreen from '../screens/category/CategoryScreen';
import PersonalActivityScreen from '../screens/personal_activity/PersonalActivityScreen';

import AnalyticsScreen from '../screens/personal_activity/AnalyticsScreen';
import ActivityFormScreen from '../screens/personal_activity/ActivityFormScreen';

import { View, Text } from 'react-native';
import Icon from 'react-native-vector-icons/MaterialIcons';
```

### AI Tab 修改（第151-160行）

```javascript
<Tab.Screen
  name="AI"
  component={AINavigator}
  options={{
    title: 'AI',
    tabBarIcon: ({ color, size }) => (
      <Icon name="smart-toy" size={size} color={color} />  // 改为 smart-toy
    ),
  }}
/>
```

### ProfileNavigator 修改（第102-122行）

```javascript
const ProfileNavigator = () => (
  <Stack.Navigator screenOptions={{ headerShown: false }}>
    <Stack.Screen name="ProfileMain" component={ProfileSettings} options={{ title: '个人中心' }} />
    <Stack.Screen name="BindPhone" component={BindPhone} options={{ title: '手机绑定' }} />
    <Stack.Screen name="BindEmail" component={BindEmail} options={{ title: '邮箱绑定' }} />
    <Stack.Screen name="ThemeSettings" component={ThemeSettingsScreen} options={{ title: '主题设置' }} />
    <Stack.Screen name="Settings" component={SettingsScreen} options={{ title: '设置' }} />
    <Stack.Screen name="SyncSettings" component={SyncSettingsScreen} options={{ title: '同步设置' }} />
    <Stack.Screen name="MindMap" component={MindMapScreen} options={{ title: '思维导图' }} />
    <Stack.Screen name="MindMapEdit" component={MindMapEditScreen} options={{ title: '编辑思维导图', headerShown: false }} />
    <Stack.Screen name="MindMapTemplate" component={MindMapTemplateScreen} options={{ title: '思维导图模板' }} />
    <Stack.Screen name="KnowledgeGraph" component={KnowledgeGraphScreen} options={{ title: '知识图谱' }} />
    <Stack.Screen name="NodeDetail" component={NodeDetailScreen} options={{ title: '节点详情' }} />
    <Stack.Screen name="FileViewer" component={FileViewerScreen} options={{ title: '文件查看器', headerShown: false }} />
    <Stack.Screen name="PersonalActivity" component={PersonalActivityScreen} options={{ title: '零屿空间', headerShown: false }} />
    <Stack.Screen name="ActivityForm" component={ActivityFormScreen} options={{ title: '发布动态', headerShown: false }} />
    
    {/* 新增知识库路由 */}
    <Stack.Screen name="KnowledgeBase" component={KnowledgeBaseListScreen} options={{ title: '知识库', headerShown: false }} />
    <Stack.Screen name="KnowledgeBaseDetail" component={KnowledgeBaseDetailScreen} options={{ title: '知识库详情', headerShown: false }} />
    <Stack.Screen name="KnowledgeBaseEdit" component={KnowledgeBaseEditScreen} options={{ title: '编辑知识库', headerShown: false }} />
  </Stack.Navigator>
);
```

---

## 2. ProfileSettings.js 知识库按钮修改

### 原始代码（第379-396行）

```javascript
{/* 知识库 */}
<TouchableOpacity
  style={[styles.functionButton, {
    backgroundColor: colors.card,
    borderColor: '#10b981' + '40',
  }]}
  onPress={() => {
    Haptics.lightFeedback();
    Alert.alert('敬请期待', '知识库功能正在开发中');
  }}
  activeOpacity={0.7}
>
  <View style={[styles.functionIconContainer, { backgroundColor: '#D1FAE5' }]}>
    <Icon name="menu-book" size={18} color="#10b981" />
  </View>
  <Text style={[styles.functionButtonText, { color: '#10b981', fontWeight: 'normal' }]}>知识库</Text>
</TouchableOpacity>
```

### 修改后的代码

```javascript
{/* 知识库 */}
<TouchableOpacity
  style={[styles.functionButton, { 
    backgroundColor: colors.card,
    borderColor: colors.primary + '30',
  }]}
  onPress={() => {
    Haptics.lightFeedback();
    navigation.navigate('KnowledgeBase');
  }}
  activeOpacity={0.7}
>
  <View style={[styles.functionIconContainer, { backgroundColor: colors.primary + '15' }]}>
    <Icon name="auto-stories" size={18} color={colors.primary} />
  </View>
  <Text style={[styles.functionButtonText, { color: colors.primary, fontWeight: 'normal' }]}>知识库</Text>
</TouchableOpacity>
```

---

## 3. ProfileSettings.js 头像动画实现

### 添加到组件顶部（useRef 部分）

```javascript
// 头像动画引用
const avatarPulse = useRef(new Animated.Value(0)).current;
const avatarRotate = useRef(new Animated.Value(0)).current;

// 头像动画效果
useEffect(() => {
  // 脉冲动画
  const pulseLoop = Animated.loop(
    Animated.sequence([
      Animated.timing(avatarPulse, { 
        toValue: 1, 
        duration: 8000, 
        easing: Easing.inOut(Easing.ease), 
        useNativeDriver: true 
      }),
      Animated.timing(avatarPulse, { 
        toValue: 0, 
        duration: 8000, 
        easing: Easing.inOut(Easing.ease), 
        useNativeDriver: true 
      }),
    ])
  );
  pulseLoop.start();
  
  // 旋转动画
  const rotateLoop = Animated.loop(
    Animated.timing(avatarRotate, {
      toValue: 1,
      duration: 20000,
      easing: Easing.linear,
      useNativeDriver: true
    })
  );
  rotateLoop.start();
  
  return () => {
    pulseLoop.stop();
    rotateLoop.stop();
  };
}, [avatarPulse, avatarRotate]);

// 动画值映射
const avatarScale = avatarPulse.interpolate({
  inputRange: [0, 0.5, 1],
  outputRange: [1, 1.05, 1]
});

const avatarRotateValue = avatarRotate.interpolate({
  inputRange: [0, 1],
  outputRange: ['0deg', '360deg']
});
```

### 修改头像容器 JSX

```javascript
<View style={[styles.avatarContainer, { position: 'relative' }]}>
  {/* 动画背景 */}
  <Animated.View 
    style={[
      styles.avatarAnimatedBg,
      {
        backgroundColor: colors.primary + '10',
        transform: [{ rotate: avatarRotateValue }]
      }
    ]}
  />
  
  {/* 头像包装器 */}
  <Animated.View
    style={[
      styles.avatarWrapper, 
      { 
        backgroundColor: colors.card,
        transform: [{ scale: avatarScale }]
      }
    ]}
  >
    <TouchableOpacity
      style={{ width: '100%', height: '100%', justifyContent: 'center', alignItems: 'center' }}
      onPress={handleSelectAvatar}
      disabled={isUploading}
    >
      {isUploading ? (
        <ActivityIndicator size="large" color={colors.primary} />
      ) : (
        <>
          {avatar ? (
            <Image
              source={{ uri: avatar }}
              style={styles.avatar}
            />
          ) : (
            <Image
              source={defaultAvatar}
              style={styles.avatar}
            />
          )}
          <View style={[styles.editIconContainer, { backgroundColor: colors.primary }]}>
            <Icon name="edit" size={16} color="#fff" />
          </View>
        </>
      )}
    </TouchableOpacity>
  </Animated.View>
</View>
```

### 添加样式

```javascript
avatarAnimatedBg: {
  position: 'absolute',
  width: 200,
  height: 200,
  borderRadius: 100,
  top: -40,
  left: -40,
  zIndex: -1,
},
```

---

## 4. 知识库列表美化（可选）

### KnowledgeBaseListScreen.js 样式优化

```javascript
const getStyles = (theme) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  loader: {
    marginTop: SPACING.large,
  },
  listContainer: {
    padding: SPACING.medium,
  },
  kbCard: {
    marginBottom: SPACING.medium,
    padding: SPACING.medium,
    borderWidth: 1,
    borderRadius: BORDER_RADIUS.large,  // 增加圆角
    backgroundColor: theme.colors.card,
    elevation: 4,  // 增加阴影
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: SPACING.small,
  },
  iconBadge: {
    width: 32,
    height: 32,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: SPACING.small,
  },
  kbTitle: {
    fontSize: FONT_SIZES.large,
    fontWeight: 'bold',
    color: theme.colors.text,
  },
  kbSubTitle: {
    marginTop: 2,
    fontSize: FONT_SIZES.small,
    color: theme.colors.textSecondary,
  },
  kbDescription: {
    fontSize: FONT_SIZES.medium,
    color: theme.colors.textSecondary,
    marginBottom: SPACING.medium,
    lineHeight: 20,
  },
  kbStatsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',  // 改为 space-around
    borderTopWidth: 1,
    borderTopColor: theme.colors.border,
    paddingTop: SPACING.medium,
    marginTop: SPACING.medium,
  },
  statItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: SPACING.small,
  },
  statText: {
    marginLeft: SPACING.extraSmall,
    fontSize: FONT_SIZES.small,
    color: theme.colors.textSecondary,
  },
  fab: {
    position: 'absolute',
    right: SPACING.large,
    bottom: SPACING.large,
    backgroundColor: theme.colors.primary,
    width: 56,
    height: 56,
    borderRadius: 28,
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 8,
    shadowColor: theme.colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
  },
});
```

---

## 5. 导入注意事项

### 确保 ProfileSettings.js 导入了必要的组件

```javascript
import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Image,
  ActivityIndicator,
  Alert,
  Animated,
  Easing,  // 新增
} from 'react-native';
```

---

## 验收代码清单

### 修改前检查
- [ ] 备份原始文件
- [ ] 确认当前代码版本

### 修改后检查
- [ ] 代码语法正确
- [ ] 导入语句完整
- [ ] 样式对象完整
- [ ] 没有重复定义

### 测试检查
- [ ] 应用启动正常
- [ ] 导航工作正常
- [ ] 动画流畅
- [ ] 没有控制台错误

**文档版本**: 1.0
**最后更新**: 2025-12-07

