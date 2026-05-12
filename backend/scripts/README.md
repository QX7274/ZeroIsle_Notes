# 脚本模块

本目录包含零屿笔记应用的各种实用脚本，用于数据迁移、系统维护、数据库操作和其他管理任务。

## 目录结构

- **migrate_to_mongodb.py**: 将Django ORM数据迁移到MongoDB
- **cleanup_django_orm.py**: 清理Django ORM相关文件
- **mongodb_init.py**: 初始化MongoDB数据库，创建必要的集合和索引
- **create_superuser.py**: 创建超级用户脚本
- **fix_admin_login.py**: 修复管理员登录脚本
- **reset_admin_password.py**: 重置管理员密码脚本
- **test_mongodb_auth.py**: MongoDB认证测试脚本
- **shared_screen_smoke.py**: 共享链最小 API 联调脚本

## 主要脚本说明

### 数据迁移脚本

#### migrate_to_mongodb.py

将Django ORM数据迁移到MongoDB。

**功能**:
- 迁移用户数据
- 迁移笔记数据
- 迁移提醒数据
- 迁移通知数据

**使用方法**:

```bash
cd backend
python scripts/migrate_to_mongodb.py
```

**参数**:
- `--dry-run`: 模拟迁移过程，不实际修改数据
- `--batch-size`: 设置批处理大小，默认为100
- `--skip-tables`: 指定要跳过的表，用逗号分隔

### 数据库操作脚本

#### cleanup_django_orm.py

清理Django ORM相关文件。

**功能**:
- 删除迁移文件（migrations目录下的文件，保留__init__.py）
- 删除Django ORM模型文件
- 更新__init__.py文件，移除对Django ORM模型的导入

**使用方法**:

```bash
cd backend
python scripts/cleanup_django_orm.py
```

#### mongodb_init.py

初始化MongoDB数据库，创建必要的集合和索引。

**功能**:
- 创建所有必要的集合
- 为每个集合创建适当的索引
- 设置数据库用户和权限

**使用方法**:

```bash
cd backend
python mongodb_init.py
```

**参数**:
- `--drop-existing`: 删除现有数据库后重新创建
- `--create-admin`: 创建管理员用户
- `--admin-username`: 管理员用户名
- `--admin-password`: 管理员密码

### 用户管理脚本

#### create_superuser.py

创建超级用户。

**功能**:
- 创建具有管理员权限的用户
- 设置用户名、邮箱和密码

**使用方法**:

```bash
cd backend
python scripts/create_superuser.py
```

#### reset_admin_password.py

重置管理员密码。

**功能**:
- 重置指定管理员用户的密码
- 生成新的随机密码或使用指定密码

**使用方法**:

```bash
cd backend
python scripts/reset_admin_password.py
```

### 测试脚本

#### test_mongodb_auth.py

测试MongoDB认证。

**功能**:
- 测试MongoDB连接和认证
- 测试用户注册和登录
- 测试验证码发送
- 测试手机号注册和登录

**使用方法**:

```bash
cd backend
python scripts/test_mongodb_auth.py
```

#### shared_screen_smoke.py

验证“注册 -> 登录 -> 建群 -> 生成加入码 -> 创建共享 -> 列表/加入共享”的最小 HTTP 契约链路。

**功能**:
- 验证 Mongo 用户注册/登录可用
- 验证群组创建与加入码生成可用
- 验证 `/api/v1/groups/shared-screens/` 的最小创建、列表与加入链路
- 输出共享会话 ID、群组 ID、WebRTC 房间 ID 供后续联调记录复用

**使用方法**:

```bash
cd backend
python scripts/shared_screen_smoke.py --base-url http://127.0.0.1:8001/api/v1
```

**说明**:
- 推荐优先配合 `DJANGO_ENV=testing` 使用，降低对真实外部依赖的要求
- 该脚本只验证共享 HTTP 契约最小链路，不等同于 WebRTC 端到端联调完成
- 该脚本不等同于 Android 专用 MCP 真机可视化验证完成

## 迁移步骤

1. 确保MongoDB服务已启动
2. 执行数据迁移脚本
3. 验证数据迁移是否成功
4. 执行清理脚本
5. 重新初始化MongoDB数据库

```bash
# 1. 启动MongoDB服务（如果尚未启动）
# Windows
mongod --dbpath=D:\data\db

# Linux/macOS
mongod --dbpath=/data/db

# 2. 执行数据迁移脚本
cd backend
python scripts/migrate_to_mongodb.py

# 3. 验证数据迁移是否成功
# 可以使用MongoDB Compass或mongo shell查看数据

# 4. 执行清理脚本
python scripts/cleanup_django_orm.py

# 5. 重新初始化MongoDB数据库
python mongodb_init.py
```

## 脚本开发指南

### 脚本结构

新脚本应遵循以下基本结构：

```python
#!/usr/bin/env python
"""
脚本名称: 脚本简短描述

详细描述...
"""

import os
import sys
import argparse
import logging

# 添加项目根目录到Python路径
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

# 设置Django环境
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'backend.settings')
import django
django.setup()

# 导入Django模型和其他依赖
from django.conf import settings
from django.db import transaction
# 其他导入...

# 设置日志
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

def parse_arguments():
    """解析命令行参数"""
    parser = argparse.ArgumentParser(description='脚本描述')
    # 添加参数
    parser.add_argument('--example', help='示例参数')
    # 其他参数...
    return parser.parse_args()

def main():
    """主函数"""
    args = parse_arguments()

    # 脚本逻辑...
    logger.info('脚本开始执行')

    try:
        # 主要操作...
        logger.info('操作成功')
    except Exception as e:
        logger.error(f'发生错误: {str(e)}')
        return 1

    logger.info('脚本执行完成')
    return 0

if __name__ == '__main__':
    sys.exit(main())
```

### 最佳实践

- **参数解析**: 使用argparse模块解析命令行参数
- **日志记录**: 使用logging模块记录脚本执行情况
- **错误处理**: 使用try-except捕获和处理异常
- **事务管理**: 对数据库操作使用事务
- **进度反馈**: 对长时间运行的操作提供进度反馈
- **幂等性**: 确保脚本可以安全地多次运行
- **文档**: 提供详细的脚本文档和使用说明

## 注意事项

- **权限**: 某些脚本可能需要特定权限才能运行
- **备份**: 在执行可能修改数据的脚本前，确保已备份数据
- **测试**: 在生产环境运行前，先在测试环境测试脚本
- **资源消耗**: 注意脚本的资源消耗，避免影响生产系统
- **安全性**: 不要在脚本中硬编码敏感信息，如密码或API密钥
- **日志**: 确保脚本记录足够的日志，便于问题排查
- 迁移脚本会记录日志到migration.log文件
- 清理脚本会记录日志到cleanup.log文件
- 如果迁移过程中出现错误，请查看日志文件获取详细信息
