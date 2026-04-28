# 快速开始指南 - 语音和图像搜索功能

## 目录

1. [环境配置](#环境配置)
2. [快速测试](#快速测试)
3. [前端集成](#前端集成)
4. [常见问题](#常见问题)

## 环境配置

### 1. 安装依赖

```bash
# 进入后端目录
cd backend

# 安装Python依赖
pip install openai>=1.0.0
pip install pillow>=10.0.0

# 可选：安装本地OCR支持
pip install pytesseract>=0.3.10
# 或
pip install paddleocr>=2.7.0
```

### 2. 配置API密钥

在 `backend/backend/settings.py` 或环境变量中配置：

```python
# OpenAI API配置
OPENAI_API_KEY = 'your_openai_api_key'

# 讯飞语音配置（可选）
XUNFEI_APP_ID = 'your_app_id'
XUNFEI_API_KEY = 'your_api_key'
XUNFEI_API_SECRET = 'your_api_secret'

# 百度语音配置（可选）
BAIDU_APP_ID = 'your_app_id'
BAIDU_API_KEY = 'your_api_key'
BAIDU_SECRET_KEY = 'your_secret_key'

# 本地OCR配置（可选）
USE_LOCAL_OCR = True
```

### 3. 运行迁移

```bash
python manage.py migrate
```

### 4. 启动服务器

```bash
python manage.py runserver
```

## 快速测试

### 使用cURL测试

#### 1. 语音搜索

```bash
# 将音频文件转换为Base64
AUDIO_BASE64=$(base64 -w 0 audio.wav)

# 发送请求
curl -X POST http://localhost:8000/api/search/voice/ \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d "{
    \"audio_base64\": \"$AUDIO_BASE64\",
    \"language\": \"zh\",
    \"engine\": \"whisper\",
    \"options\": {
      \"page\": 1,
      \"page_size\": 20
    }
  }"
```

#### 2. 图像搜索

```bash
# 将图像文件转换为Base64
IMAGE_BASE64=$(base64 -w 0 image.jpg)

# 发送请求
curl -X POST http://localhost:8000/api/search/image/ \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d "{
    \"image_base64\": \"$IMAGE_BASE64\",
    \"task\": \"describe\",
    \"options\": {
      \"page\": 1,
      \"page_size\": 20
    }
  }"
```

#### 3. 音频转文字

```bash
curl -X POST http://localhost:8000/api/voice-recognition/transcribe/ \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d "{
    \"audio_base64\": \"$AUDIO_BASE64\",
    \"language\": \"zh\",
    \"engine\": \"whisper\",
    \"enable_diarization\": false,
    \"enable_punctuation\": true,
    \"enable_timestamp\": true
  }"
```

#### 4. 生成会议纪要

```bash
curl -X POST http://localhost:8000/api/voice-recognition/meeting/ \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d "{
    \"text\": \"今天的会议讨论了项目进度...\",
    \"summary_type\": \"detailed\",
    \"language\": \"zh\"
  }"
```

### 使用Python测试

创建测试脚本 `test_features.py`:

```python
import requests
import base64
import json

# 配置
API_BASE_URL = 'http://localhost:8000/api'
TOKEN = 'your_auth_token'

headers = {
    'Authorization': f'Bearer {TOKEN}',
    'Content-Type': 'application/json'
}

def test_voice_search():
    """测试语音搜索"""
    print("测试语音搜索...")
    
    # 读取音频文件
    with open('test_audio.wav', 'rb') as f:
        audio_data = f.read()
        audio_base64 = base64.b64encode(audio_data).decode('utf-8')
    
    # 发送请求
    response = requests.post(
        f'{API_BASE_URL}/search/voice/',
        headers=headers,
        json={
            'audio_base64': audio_base64,
            'language': 'zh',
            'engine': 'whisper',
            'options': {
                'page': 1,
                'page_size': 20
            }
        }
    )
    
    if response.status_code == 200:
        result = response.json()
        print(f"✓ 识别文本: {result.get('recognized_text')}")
        print(f"✓ 搜索结果数: {result.get('total')}")
    else:
        print(f"✗ 错误: {response.status_code} - {response.text}")

def test_image_search():
    """测试图像搜索"""
    print("\n测试图像搜索...")
    
    # 读取图像文件
    with open('test_image.jpg', 'rb') as f:
        image_data = f.read()
        image_base64 = base64.b64encode(image_data).decode('utf-8')
    
    # 发送请求
    response = requests.post(
        f'{API_BASE_URL}/search/image/',
        headers=headers,
        json={
            'image_base64': image_base64,
            'task': 'describe',
            'options': {
                'page': 1,
                'page_size': 20
            }
        }
    )
    
    if response.status_code == 200:
        result = response.json()
        print(f"✓ 图像分析: {result.get('image_analysis', {}).get('result')[:100]}...")
        print(f"✓ 搜索结果数: {result.get('total')}")
    else:
        print(f"✗ 错误: {response.status_code} - {response.text}")

def test_transcription():
    """测试音频转文字"""
    print("\n测试音频转文字...")
    
    with open('test_audio.wav', 'rb') as f:
        audio_data = f.read()
        audio_base64 = base64.b64encode(audio_data).decode('utf-8')
    
    response = requests.post(
        f'{API_BASE_URL}/voice-recognition/transcribe/',
        headers=headers,
        json={
            'audio_base64': audio_base64,
            'language': 'zh',
            'engine': 'whisper',
            'enable_diarization': False,
            'enable_punctuation': True,
            'enable_timestamp': True
        }
    )
    
    if response.status_code == 200:
        result = response.json()
        print(f"✓ 转录文本: {result.get('text')[:100]}...")
        print(f"✓ 时长: {result.get('duration')}秒")
    else:
        print(f"✗ 错误: {response.status_code} - {response.text}")

def test_meeting_summary():
    """测试会议纪要生成"""
    print("\n测试会议纪要生成...")
    
    test_text = """
    今天的会议主要讨论了以下几个议题：
    1. 项目进度：张三汇报开发进度已完成70%
    2. 技术方案：李四提出了新的优化建议
    3. 下一步计划：决定下周进行代码审查
    参会人员：张三、李四、王五
    """
    
    response = requests.post(
        f'{API_BASE_URL}/voice-recognition/meeting/',
        headers=headers,
        json={
            'text': test_text,
            'summary_type': 'detailed',
            'language': 'zh'
        }
    )
    
    if response.status_code == 200:
        result = response.json()
        print(f"✓ 会议摘要: {result.get('summary')[:100]}...")
        print(f"✓ 关键要点数: {len(result.get('key_points', []))}")
        print(f"✓ 行动项数: {len(result.get('action_items', []))}")
    else:
        print(f"✗ 错误: {response.status_code} - {response.text}")

if __name__ == '__main__':
    print("开始测试增强功能...\n")
    test_voice_search()
    test_image_search()
    test_transcription()
    test_meeting_summary()
    print("\n测试完成！")
```

运行测试：

```bash
python test_features.py
```

## 前端集成

### React Native 示例

```typescript
// services/SearchService.ts
import axios from 'axios';
import { Audio } from 'expo-av';
import * as ImagePicker from 'expo-image-picker';

const API_BASE_URL = 'http://localhost:8000/api';

export class SearchService {
  private token: string;

  constructor(token: string) {
    this.token = token;
  }

  // 语音搜索
  async voiceSearch(audioUri: string): Promise<any> {
    // 读取音频文件
    const response = await fetch(audioUri);
    const blob = await response.blob();
    
    // 转换为Base64
    const base64 = await this.blobToBase64(blob);
    
    // 发送请求
    const result = await axios.post(
      `${API_BASE_URL}/search/voice/`,
      {
        audio_base64: base64,
        language: 'zh',
        engine: 'whisper',
        options: {
          page: 1,
          page_size: 20
        }
      },
      {
        headers: {
          'Authorization': `Bearer ${this.token}`
        }
      }
    );
    
    return result.data;
  }

  // 图像搜索
  async imageSearch(imageUri: string, task: string = 'describe'): Promise<any> {
    const response = await fetch(imageUri);
    const blob = await response.blob();
    const base64 = await this.blobToBase64(blob);
    
    const result = await axios.post(
      `${API_BASE_URL}/search/image/`,
      {
        image_base64: base64,
        task: task,
        options: {
          page: 1,
          page_size: 20
        }
      },
      {
        headers: {
          'Authorization': `Bearer ${this.token}`
        }
      }
    );
    
    return result.data;
  }

  // 录音并搜索
  async recordAndSearch(): Promise<any> {
    // 请求权限
    const { status } = await Audio.requestPermissionsAsync();
    if (status !== 'granted') {
      throw new Error('需要麦克风权限');
    }
    
    // 开始录音
    const recording = new Audio.Recording();
    await recording.prepareToRecordAsync(
      Audio.RECORDING_OPTIONS_PRESET_HIGH_QUALITY
    );
    await recording.startAsync();
    
    // 录音3秒
    await new Promise(resolve => setTimeout(resolve, 3000));
    
    // 停止录音
    await recording.stopAndUnloadAsync();
    const uri = recording.getURI();
    
    // 搜索
    return await this.voiceSearch(uri);
  }

  // 选择图片并搜索
  async pickImageAndSearch(): Promise<any> {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      throw new Error('需要相册权限');
    }
    
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.8
    });
    
    if (!result.cancelled) {
      return await this.imageSearch(result.uri);
    }
    
    return null;
  }

  private blobToBase64(blob: Blob): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        const base64 = (reader.result as string).split(',')[1];
        resolve(base64);
      };
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  }
}
```

### 使用示例

```typescript
// screens/SearchScreen.tsx
import React, { useState } from 'react';
import { View, Button, Text } from 'react-native';
import { SearchService } from '../services/SearchService';

export const SearchScreen = () => {
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const searchService = new SearchService('your_token');

  const handleVoiceSearch = async () => {
    setLoading(true);
    try {
      const result = await searchService.recordAndSearch();
      setResults(result.results);
      console.log('识别文本:', result.recognized_text);
    } catch (error) {
      console.error('语音搜索失败:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleImageSearch = async () => {
    setLoading(true);
    try {
      const result = await searchService.pickImageAndSearch();
      if (result) {
        setResults(result.results);
        console.log('图像分析:', result.image_analysis);
      }
    } catch (error) {
      console.error('图像搜索失败:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <View>
      <Button title="语音搜索" onPress={handleVoiceSearch} disabled={loading} />
      <Button title="图像搜索" onPress={handleImageSearch} disabled={loading} />
      {loading && <Text>处理中...</Text>}
      {/* 显示搜索结果 */}
    </View>
  );
};
```

## 常见问题

### Q1: 语音识别失败怎么办？

**A**: 检查以下几点：
1. 确认API密钥配置正确
2. 检查音频格式（推荐WAV格式）
3. 确保音频质量良好
4. 尝试不同的识别引擎

### Q2: 图像分析失败怎么办？

**A**: 
1. 检查OpenAI API密钥
2. 如果使用本地OCR，确保安装了相关库
3. 检查图像格式和大小
4. 尝试不同的分析任务

### Q3: 如何提高识别准确率？

**A**:
1. 使用高质量的音频/图像
2. 选择合适的语言和引擎
3. 对于中文，推荐使用讯飞或百度引擎
4. 对于英文，推荐使用Whisper

### Q4: 如何处理大文件？

**A**:
1. 音频文件建议不超过10MB
2. 图像文件建议不超过5MB
3. 可以先压缩文件再上传
4. 使用分块上传功能

### Q5: 如何优化性能？

**A**:
1. 使用本地OCR作为备用方案
2. 启用缓存机制
3. 使用异步处理
4. 合理设置超时时间

## 下一步

- 查看 [完整文档](ENHANCED_FEATURES_SUMMARY.md)
- 查看 [API文档](voice_recognition/README_ENHANCED.md)
- 运行 [测试用例](tests/test_enhanced_search.py)

## 支持

如有问题，请联系开发团队或查看项目文档。

