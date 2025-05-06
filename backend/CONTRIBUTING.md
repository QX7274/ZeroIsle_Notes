# 零屿笔记贡献指南

感谢您对零屿笔记项目的关注！本文档提供了参与项目开发的指南和最佳实践。

## 开发环境设置

1. **克隆仓库**
   ```bash
   git clone https://github.com/qx7274/zeroislenotes.git
   cd zeroislenotes/backend
   ```

2. **创建虚拟环境**
   ```bash
   python -m venv venv
   source venv/bin/activate  # Windows: venv\Scripts\activate
   ```

3. **安装依赖**
   ```bash
   pip install -r requirements.txt
   ```

4. **设置环境变量**
   ```bash
   cp .env.example .env
   # 编辑.env文件，设置必要的环境变量
   ```

5. **运行数据库迁移**
   ```bash
   python manage.py migrate
   ```

6. **运行开发服务器**
   ```bash
   python manage.py runserver
   ```

## 代码规范

### Python代码规范

- 遵循PEP 8编码规范
- 使用4个空格缩进（不使用制表符）
- 行长度限制在120个字符以内
- 使用有意义的变量名和函数名
- 添加适当的注释和文档字符串

### 文档字符串规范

使用Google风格的文档字符串：

```python
def example_function(param1, param2):
    """函数简短描述。

    详细描述（可选）。

    Args:
        param1: 参数1的描述。
        param2: 参数2的描述。

    Returns:
        返回值的描述。

    Raises:
        ValueError: 异常描述。
    """
    # 函数实现
```

### 导入规范

导入顺序：
1. 标准库导入
2. 相关第三方导入
3. 本地应用/库特定导入

每组之间空一行，按字母顺序排序：

```python
import os
import sys

from django.db import models
from rest_framework import serializers

from common.utils import get_logger
from notes.models import Note
```

## 提交规范

提交信息应遵循以下格式：

```
<类型>(<范围>): <描述>

[可选的正文]

[可选的脚注]
```

类型包括：
- `feat`: 新功能
- `fix`: 修复bug
- `docs`: 文档更新
- `style`: 代码风格调整（不影响代码功能）
- `refactor`: 代码重构
- `perf`: 性能优化
- `test`: 添加或修改测试
- `chore`: 构建过程或辅助工具的变动

示例：
```
feat(notes): 添加笔记导出功能

添加了将笔记导出为Markdown、PDF和HTML格式的功能。

Closes #123
```

## 分支策略

- `main`: 主分支，保持稳定，随时可发布
- `develop`: 开发分支，包含最新的开发代码
- `feature/<feature-name>`: 功能分支，用于开发新功能
- `bugfix/<bug-name>`: 修复分支，用于修复bug
- `hotfix/<fix-name>`: 热修复分支，用于紧急修复生产环境问题

## 测试指南

### 编写测试

- 为所有新功能和修复编写测试
- 单元测试应该快速、独立且可重复
- 使用适当的断言验证结果
- 模拟外部依赖以避免测试中的副作用

### 运行测试

```bash
# 运行所有测试
python manage.py test

# 运行特定应用的测试
python manage.py test notes

# 使用pytest运行测试
pytest
```

### 代码覆盖率

```bash
# 生成覆盖率报告
coverage run --source='.' manage.py test
coverage report
coverage html  # 生成HTML报告
```

## 代码审查清单

提交拉取请求前，请确保：

- [ ] 代码遵循项目的编码规范
- [ ] 添加了适当的测试，并且所有测试都通过
- [ ] 更新了相关文档
- [ ] 提交信息遵循提交规范
- [ ] 代码不包含敏感信息（如API密钥、密码）
- [ ] 没有不必要的调试代码或注释

## 常见问题解决

### 数据库连接问题

如果遇到MongoDB连接问题，请检查：
1. MongoDB服务是否正在运行
2. 连接字符串是否正确
3. 数据库用户名和密码是否正确
4. 防火墙设置是否允许连接

### 依赖冲突

如果遇到依赖冲突，特别是djongo和Django版本不兼容的问题，可以尝试：
1. 使用虚拟环境隔离依赖
2. 按照requirements.txt中的确切版本安装依赖
3. 如果必要，可以降级Django版本以兼容djongo

