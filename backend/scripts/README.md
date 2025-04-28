# 数据迁移和清理脚本

本目录包含用于将Django ORM数据迁移到MongoDB以及清理Django ORM相关文件的脚本。

## 脚本说明

### 1. migrate_to_mongodb.py

将Django ORM数据迁移到MongoDB。

**功能**：
- 迁移用户数据
- 迁移笔记数据
- 迁移提醒数据
- 迁移通知数据

**使用方法**：

```bash
cd backend
python scripts/migrate_to_mongodb.py
```

### 2. cleanup_django_orm.py

清理Django ORM相关文件。

**功能**：
- 删除迁移文件（migrations目录下的文件，保留__init__.py）
- 删除Django ORM模型文件
- 更新__init__.py文件，移除对Django ORM模型的导入

**使用方法**：

```bash
cd backend
python scripts/cleanup_django_orm.py
```

### 3. mongodb_init.py

初始化MongoDB数据库，创建必要的集合和索引。

**功能**：
- 创建所有必要的集合
- 为每个集合创建适当的索引

**使用方法**：

```bash
cd backend
python mongodb_init.py
```

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

## 注意事项

- 在执行迁移和清理脚本之前，建议先备份数据库和代码
- 迁移脚本会记录日志到migration.log文件
- 清理脚本会记录日志到cleanup.log文件
- 如果迁移过程中出现错误，请查看日志文件获取详细信息
