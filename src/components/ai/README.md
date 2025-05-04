# AI组件

本目录包含与AI助手功能相关的组件。

## 组件列表

### ChatInput

聊天输入组件，用于用户与AI助手的交互输入。

**主要功能**：
- 支持文本输入
- 支持语音输入
- 支持发送图片
- 支持快捷指令

### ChatMessage

聊天消息组件，用于显示AI助手与用户的对话消息。

**主要功能**：
- 支持文本消息渲染
- 支持代码块渲染
- 支持图片渲染
- 支持链接渲染
- 支持消息复制
- 支持消息分享

### AIModelSelector

AI模型选择器，用于选择不同的AI模型。

**主要功能**：
- 显示可用的AI模型列表
- 支持模型切换
- 显示模型特性和能力

### AISettingsPanel

AI设置面板，用于配置AI助手的行为和偏好。

**主要功能**：
- 配置AI响应风格
- 设置上下文长度
- 配置隐私选项
- 管理API密钥

## 使用方法

```javascript
import { ChatInput, ChatMessage, AIModelSelector, AISettingsPanel } from '../components/ai';

function AIAssistantScreen() {
  return (
    <View>
      <AIModelSelector />
      
      <FlatList
        data={messages}
        renderItem={({ item }) => <ChatMessage message={item} />}
      />
      
      <ChatInput onSend={handleSendMessage} />
      
      <AISettingsPanel />
    </View>
  );
}
```
