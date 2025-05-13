# 适配器模块

本目录包含零屿笔记应用的适配器模块，用于在不同数据模型之间进行转换。

## 概述

适配器模式是一种结构型设计模式，它允许接口不兼容的对象能够相互合作。在零屿笔记应用中，适配器主要用于以下场景：

1. 前端模型与后端API模型之间的转换
2. 本地存储模型与云端存储模型之间的转换
3. 不同数据源（如MongoDB、Realm）之间的数据转换

## 文件结构

- **noteAdapter.js**: 笔记数据适配器，处理笔记相关数据的转换
- **categoryAdapter.js**: 分类数据适配器，处理分类相关数据的转换
- **tagAdapter.js**: 标签数据适配器，处理标签相关数据的转换
- **reminderAdapter.js**: 提醒数据适配器，处理提醒相关数据的转换
- **aiChatAdapter.js**: AI聊天数据适配器，处理AI聊天相关数据的转换
- **fileAdapter.js**: 文件数据适配器，处理文件相关数据的转换
- **canvasAdapter.js**: 画布数据适配器，处理无限画布相关数据的转换
- **mindMapAdapter.js**: 思维导图数据适配器，处理思维导图相关数据的转换
- **knowledgeGraphAdapter.js**: 知识图谱数据适配器，处理知识图谱相关数据的转换
- **userAdapter.js**: 用户数据适配器，处理用户相关数据的转换

## 适配器接口

每个适配器通常提供以下方法：

- **toLocal(data)**: 将API或云端数据转换为本地模型
- **toRemote(data)**: 将本地模型转换为API或云端数据
- **toRealm(data)**: 将数据转换为Realm模型
- **fromRealm(data)**: 将Realm模型转换为普通JavaScript对象
- **toMongoDB(data)**: 将数据转换为MongoDB模型
- **fromMongoDB(data)**: 将MongoDB模型转换为普通JavaScript对象

## 使用示例

```javascript
import { noteAdapter } from '../adapters/noteAdapter';
import { apiService } from '../services/network/apiService';
import { realmService } from '../services/database/realmService';

// 从API获取笔记并转换为本地模型
async function fetchNote(noteId) {
  const apiNote = await apiService.get(`/api/v1/notes/${noteId}`);
  const localNote = noteAdapter.toLocal(apiNote);
  return localNote;
}

// 将本地笔记保存到Realm
async function saveNoteToRealm(note) {
  const realmNote = noteAdapter.toRealm(note);
  await realmService.create('notes', realmNote);
}

// 将本地笔记转换为API格式并保存
async function saveNoteToAPI(note) {
  const apiNote = noteAdapter.toRemote(note);
  await apiService.post('/api/v1/notes', apiNote);
}

// 从Realm获取笔记并转换为本地模型
async function getNotesFromRealm() {
  const realmNotes = await realmService.find('notes');
  return realmNotes.map(note => noteAdapter.fromRealm(note));
}
```

## 适配器模式的优势

1. **解耦**: 适配器模式将数据转换逻辑与业务逻辑分离，使代码更加清晰和可维护。
2. **灵活性**: 当API或数据模型发生变化时，只需修改相应的适配器，而不需要修改业务逻辑。
3. **可测试性**: 适配器可以单独测试，确保数据转换的正确性。
4. **可重用性**: 适配器可以在不同的场景中重用，减少代码重复。

## 最佳实践

1. **保持适配器简单**: 适配器应该只负责数据转换，不应包含业务逻辑。
2. **处理边缘情况**: 适配器应该处理空值、未定义值和其他边缘情况。
3. **版本兼容**: 适配器应该能够处理不同版本的数据模型。
4. **错误处理**: 适配器应该优雅地处理转换过程中的错误。
5. **文档化**: 记录适配器的输入和输出格式，以便其他开发人员理解和使用。
