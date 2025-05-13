# 上传组件

本目录包含零屿笔记应用的上传相关组件，用于提供数据和文件上传的用户界面。

## 文件列表

- **UploadButton.js**: 上传按钮组件，提供数据上传功能的UI组件
- **index.js**: 上传组件索引

## 功能说明

上传组件提供以下功能：

1. **数据上传**: 提供上传数据到服务器的用户界面
2. **上传队列管理**: 显示和管理上传队列
3. **上传状态显示**: 显示上传状态和进度
4. **离线支持**: 在离线状态下将上传请求添加到队列

## 使用方法

```jsx
import React from 'react';
import { View } from 'react-native';
import { UploadButton } from '../../components/upload';

const MyComponent = () => {
  // 处理上传成功
  const handleUploadSuccess = (result) => {
    console.log('上传成功:', result);
  };

  // 处理上传失败
  const handleUploadError = (error) => {
    console.log('上传失败:', error);
  };

  return (
    <View>
      <UploadButton
        collection="notes"
        id="123"
        data={{ title: '测试笔记', content: '内容' }}
        onSuccess={handleUploadSuccess}
        onError={handleUploadError}
        buttonText="上传笔记"
        showQueue={true}
      />
    </View>
  );
};

export default MyComponent;
```

## 组件属性

### UploadButton

| 属性 | 类型 | 必填 | 默认值 | 说明 |
|------|------|------|--------|------|
| collection | string | 是 | - | 集合名称 |
| id | string | 是 | - | 记录ID |
| data | object | 是 | - | 上传数据 |
| onSuccess | function | 否 | - | 上传成功回调 |
| onError | function | 否 | - | 上传失败回调 |
| style | object | 否 | - | 按钮样式 |
| buttonText | string | 否 | '上传' | 按钮文本 |
| showQueue | boolean | 否 | true | 是否显示上传队列 |

## 依赖关系

- **上传服务**: 提供数据和文件上传功能
- **网络服务**: 检测网络状态
- **主题**: 使用应用主题样式

## 注意事项

1. 上传按钮组件会自动检测网络状态，在离线状态下会提示用户
2. 上传队列会在应用重启后保留
3. 上传进度只适用于文件上传，数据上传不显示进度
4. 上传按钮可以自定义样式和文本
