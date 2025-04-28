# MongoDB 使用指南

本文档提供了零屿笔记项目中MongoDB数据库的使用指南，包括安装、配置、初始化和常见操作。

## 安装MongoDB

### Windows

1. 从[MongoDB官网](https://www.mongodb.com/try/download/community)下载MongoDB Community Server
2. 运行安装程序，按照向导完成安装
3. 可以选择安装MongoDB Compass（图形界面工具）

### macOS

使用Homebrew安装：

```bash
brew tap mongodb/brew
brew install mongodb-community
```

### Linux (Ubuntu)

```bash
# 导入公钥
wget -qO - https://www.mongodb.org/static/pgp/server-6.0.asc | sudo apt-key add -

# 添加MongoDB源
echo "deb [ arch=amd64,arm64 ] https://repo.mongodb.org/apt/ubuntu focal/mongodb-org/6.0 multiverse" | sudo tee /etc/apt/sources.list.d/mongodb-org-6.0.list

# 更新包数据库
sudo apt-get update

# 安装MongoDB
sudo apt-get install -y mongodb-org
```

## 启动MongoDB服务

### Windows

MongoDB作为服务自动启动，或者可以手动启动：

```bash
# 创建数据目录
mkdir -p D:\data\db

# 启动MongoDB服务
"C:\Program Files\MongoDB\Server\6.0\bin\mongod.exe" --dbpath="D:\data\db"
```

### macOS

```bash
# 启动服务
brew services start mongodb-community

# 或者手动启动
mongod --config /usr/local/etc/mongod.conf
```

### Linux

```bash
# 启动服务
sudo systemctl start mongod

# 设置开机自启
sudo systemctl enable mongod
```

## 配置MongoDB

### 创建数据库和用户

1. 连接到MongoDB

```bash
mongosh
```

2. 创建数据库和用户

```javascript
// 切换到admin数据库
use admin

// 创建管理员用户（如果需要）
db.createUser({
  user: "admin",
  pwd: "secure_password",
  roles: [ { role: "userAdminAnyDatabase", db: "admin" } ]
})

// 切换到项目数据库
use zeroislenotes

// 创建应用用户
db.createUser({
  user: "zeroisleuser",
  pwd: "your_secure_password",
  roles: [ { role: "readWrite", db: "zeroislenotes" } ]
})
```

## 项目配置

### 环境变量

在`.env`文件中配置MongoDB连接信息：

```
# MongoDB配置
MONGO_HOST=localhost
MONGO_PORT=27017
MONGO_USER=zeroisleuser
MONGO_PASSWORD=your_secure_password
MONGO_DB=zeroislenotes
MONGO_MAX_POOL_SIZE=100
MONGO_MIN_POOL_SIZE=10
MONGO_MAX_IDLE_TIME_MS=30000
MONGO_SOCKET_TIMEOUT_MS=30000
MONGO_CONNECT_TIMEOUT_MS=30000
```

## 初始化数据库

运行初始化脚本创建必要的集合和索引：

```bash
python mongodb_init.py
```

## 常见操作

### 使用MongoDB服务

项目中提供了`MongoDBService`类，用于与MongoDB交互：

```python
from mongodb_service import mongodb_service

# 获取连接状态
status = mongodb_service.get_connection_status()

# 同步查询用户
user = mongodb_service.get_user_sync('username')

# 异步查询用户
user = await mongodb_service.get_user('username')

# 同步插入用户
user_id = mongodb_service.insert_user_sync({
    'username': 'new_user',
    'email': 'user@example.com',
    'password': 'hashed_password'
})

# 异步插入用户
user_id = await mongodb_service.insert_user({
    'username': 'new_user',
    'email': 'user@example.com',
    'password': 'hashed_password'
})

# 备份数据库
backup_dir = await mongodb_service.backup_database()

# 恢复数据库
success = await mongodb_service.restore_database('backups/mongodb/20240601_120000')
```

### 使用MongoEngine ODM

项目使用MongoEngine作为ODM（对象文档映射）框架，用于定义和操作MongoDB文档：

```python
from users.mongodb_models import User

# 创建用户
user = User(
    username='new_user',
    email='user@example.com',
    password='hashed_password'
)
user.save()

# 查询用户
user = User.objects.get(username='new_user')
users = User.objects.filter(is_active=True)

# 更新用户
user.email = 'new_email@example.com'
user.save()

# 删除用户
user.delete()  # 软删除
user.hard_delete()  # 硬删除
```

## 数据库管理

### MongoDB Compass

MongoDB Compass是官方的图形界面工具，可用于：

- 查看和编辑数据
- 创建和管理索引
- 运行查询和聚合
- 监控数据库性能

### 备份和恢复

使用mongodump和mongorestore工具：

```bash
# 备份
mongodump --uri="mongodb://localhost:27017/zeroislenotes" --out=backup_dir

# 恢复
mongorestore --uri="mongodb://localhost:27017/zeroislenotes" backup_dir
```

## 故障排除

### 连接问题

- 检查MongoDB服务是否运行
- 验证连接字符串是否正确
- 确认用户名和密码是否正确
- 检查防火墙设置

### 性能问题

- 确保创建了适当的索引
- 检查查询是否高效
- 监控内存使用情况
- 考虑使用MongoDB Atlas进行云托管

## 参考资源

- [MongoDB官方文档](https://docs.mongodb.com/)
- [MongoEngine文档](https://mongoengine-odm.readthedocs.io/)
- [PyMongo文档](https://pymongo.readthedocs.io/)
- [MongoDB大学](https://university.mongodb.com/)（免费在线课程）
