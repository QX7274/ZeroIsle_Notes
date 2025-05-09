# 测试模块

本目录包含零屿笔记后端的全局测试文件，用于测试跨模块功能和集成测试。每个功能模块内部还有自己的测试目录，用于模块级别的单元测试。

## 目录结构

- **test_mongodb.py**: MongoDB连接测试，测试数据库连接和基本操作
- **test_user_api.py**: 用户API测试，测试用户认证和权限
- **test_notes_api.py**: 笔记API测试，测试笔记相关功能
- **test_knowledge_graph_api.py**: 知识图谱API测试，测试知识图谱功能
- **test_ai_assistant_api.py**: AI助手API测试，测试AI助手功能
- **test_search_api.py**: 搜索API测试，测试搜索功能
- **test_integration.py**: 集成测试，测试多个模块之间的交互
- **test_performance.py**: 性能测试，测试系统在负载下的表现
- **test_security.py**: 安全测试，测试系统的安全性
- **conftest.py**: Pytest配置文件，定义测试夹具和辅助函数
- **fixtures/**: 测试数据夹具，提供测试所需的数据
  - **users.json**: 用户测试数据
  - **notes.json**: 笔记测试数据
  - **knowledge_graph.json**: 知识图谱测试数据
- **utils/**: 测试工具函数
  - **auth_utils.py**: 认证相关工具函数
  - **data_generators.py**: 测试数据生成器
  - **api_client.py**: API测试客户端
  - **assertions.py**: 自定义断言函数

## 测试类型

### 单元测试

单元测试用于测试单个函数或类的功能，确保它们按预期工作。这些测试通常位于各个模块的`tests`目录中。

### 集成测试

集成测试用于测试多个组件之间的交互，确保它们能够协同工作。本目录中的测试主要是集成测试，测试跨模块功能。

### API测试

API测试用于测试REST API的功能，确保API端点按预期工作。这些测试模拟HTTP请求并验证响应。

### 性能测试

性能测试用于测试系统在负载下的表现，确保系统能够处理预期的流量和数据量。

### 安全测试

安全测试用于测试系统的安全性，检查常见的安全漏洞和问题。

## 测试框架和工具

- **Pytest**: 主要测试框架，用于编写和运行测试
- **Django Test Client**: Django内置的测试客户端，用于测试视图
- **DRF Test Client**: Django REST Framework的测试客户端，用于测试API
- **Pytest-Django**: Pytest的Django插件，提供Django特定的测试功能
- **Pytest-Mock**: Pytest的Mock插件，用于模拟对象和函数
- **Pytest-Cov**: Pytest的覆盖率插件，用于生成测试覆盖率报告
- **Faker**: 生成随机测试数据的库

## 测试数据

测试使用以下类型的数据：

- **夹具数据**: 预定义的测试数据，存储在JSON文件中
- **工厂生成数据**: 使用工厂模式动态生成的测试数据
- **随机数据**: 使用Faker等库生成的随机测试数据
- **模拟数据**: 使用Mock对象模拟的数据

## 测试示例

### MongoDB连接测试

```python
import pytest
from pymongo import MongoClient
from django.conf import settings

def test_mongodb_connection():
    """测试MongoDB连接"""
    client = MongoClient(settings.MONGODB_URI)
    db = client.get_database()
    
    # 测试数据库连接
    assert db.command('ping')['ok'] == 1.0
    
    # 测试集合操作
    collection = db.test_collection
    collection.delete_many({})  # 清空集合
    
    # 插入测试文档
    result = collection.insert_one({'test': 'data'})
    assert result.inserted_id is not None
    
    # 查询测试文档
    doc = collection.find_one({'test': 'data'})
    assert doc is not None
    assert doc['test'] == 'data'
    
    # 清理测试数据
    collection.delete_many({})
```

### 用户API测试

```python
import pytest
from rest_framework.test import APIClient
from django.urls import reverse

@pytest.mark.django_db
def test_user_registration():
    """测试用户注册API"""
    client = APIClient()
    url = reverse('user-register')
    
    # 测试有效注册
    data = {
        'username': 'testuser',
        'email': 'test@example.com',
        'password': 'Test@123',
        'password_confirm': 'Test@123'
    }
    response = client.post(url, data, format='json')
    assert response.status_code == 201
    assert 'id' in response.data
    assert response.data['username'] == 'testuser'
    
    # 测试无效注册（用户名已存在）
    response = client.post(url, data, format='json')
    assert response.status_code == 400
    assert 'username' in response.data
    
    # 测试无效注册（密码不匹配）
    data['username'] = 'testuser2'
    data['password_confirm'] = 'WrongPassword'
    response = client.post(url, data, format='json')
    assert response.status_code == 400
    assert 'password' in response.data
```

### 笔记API测试

```python
import pytest
from rest_framework.test import APIClient
from django.urls import reverse
from tests.utils.auth_utils import get_auth_token

@pytest.mark.django_db
def test_create_note():
    """测试创建笔记API"""
    # 获取认证令牌
    token = get_auth_token('testuser', 'Test@123')
    
    client = APIClient()
    client.credentials(HTTP_AUTHORIZATION=f'Bearer {token}')
    url = reverse('note-list')
    
    # 测试创建笔记
    data = {
        'title': 'Test Note',
        'content': 'This is a test note content.',
        'format': 'markdown'
    }
    response = client.post(url, data, format='json')
    assert response.status_code == 201
    assert response.data['title'] == 'Test Note'
    assert response.data['content'] == 'This is a test note content.'
    
    # 获取笔记ID
    note_id = response.data['id']
    
    # 测试获取笔记详情
    url = reverse('note-detail', args=[note_id])
    response = client.get(url)
    assert response.status_code == 200
    assert response.data['title'] == 'Test Note'
    
    # 测试更新笔记
    data = {
        'title': 'Updated Test Note',
        'content': 'This is an updated test note content.'
    }
    response = client.patch(url, data, format='json')
    assert response.status_code == 200
    assert response.data['title'] == 'Updated Test Note'
    
    # 测试删除笔记
    response = client.delete(url)
    assert response.status_code == 204
    
    # 确认笔记已删除
    response = client.get(url)
    assert response.status_code == 404
```

## 运行测试

### 运行所有测试

```bash
# 使用Django测试命令
python manage.py test

# 使用Pytest
pytest
```

### 运行特定测试文件

```bash
# 运行MongoDB连接测试
pytest tests/test_mongodb.py

# 运行用户API测试
pytest tests/test_user_api.py
```

### 运行特定测试函数

```bash
# 运行特定测试函数
pytest tests/test_user_api.py::test_user_registration
```

### 生成测试覆盖率报告

```bash
# 生成覆盖率报告
pytest --cov=.

# 生成HTML格式的覆盖率报告
pytest --cov=. --cov-report=html
```

## 测试最佳实践

- **独立性**: 每个测试应该独立于其他测试，不依赖于测试执行的顺序
- **隔离性**: 测试应该在隔离的环境中运行，不影响生产数据
- **可重复性**: 测试应该是可重复的，每次运行都应该产生相同的结果
- **快速性**: 测试应该尽可能快速运行，避免不必要的延迟
- **全面性**: 测试应该覆盖所有重要的功能和边界情况
- **可维护性**: 测试代码应该易于理解和维护
- **自动化**: 测试应该能够自动运行，不需要人工干预

## 持续集成

测试已集成到CI/CD流程中，每次代码提交都会自动运行测试。测试失败会阻止代码合并，确保只有通过测试的代码才能部署到生产环境。

## 注意事项

- **测试数据**: 确保测试使用独立的测试数据，不影响生产数据
- **敏感信息**: 不要在测试中硬编码敏感信息，如API密钥或密码
- **清理资源**: 测试完成后应该清理创建的资源，如临时文件或数据库记录
- **模拟外部服务**: 使用Mock对象模拟外部服务，避免依赖外部系统
- **测试覆盖率**: 定期检查测试覆盖率，确保关键代码路径被测试覆盖
- **测试维护**: 随着代码的变化，及时更新和维护测试
