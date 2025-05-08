# 缓存服务

本目录包含零屿笔记应用的缓存服务，用于管理应用内的数据缓存，提高应用性能和离线使用体验。

## 文件结构

- **cacheService.js**: 缓存服务，提供数据缓存管理功能
- **imageCacheService.js**: 图片缓存服务，专门用于管理图片资源的缓存
- **apiCacheService.js**: API缓存服务，用于缓存API请求和响应

## 主要功能

### 缓存服务 (cacheService.js)

缓存服务提供以下主要功能：

- **数据缓存**: 将数据存储在内存或持久化存储中
- **缓存检索**: 从缓存中检索数据
- **缓存失效**: 管理缓存的有效期和失效策略
- **缓存清理**: 清理过期或不再需要的缓存数据
- **缓存统计**: 提供缓存使用情况的统计信息

### 图片缓存服务 (imageCacheService.js)

图片缓存服务专门用于管理图片资源的缓存，提供以下功能：

- **图片下载和缓存**: 下载远程图片并缓存到本地
- **图片预加载**: 预先加载可能需要的图片
- **图片缓存检索**: 从缓存中检索图片
- **图片缓存管理**: 管理图片缓存的大小和有效期
- **图片缓存清理**: 清理过期或不再需要的图片缓存

### API缓存服务 (apiCacheService.js)

API缓存服务用于缓存API请求和响应，提供以下功能：

- **请求缓存**: 缓存API请求和响应
- **离线支持**: 在离线状态下提供缓存的响应
- **缓存策略**: 支持多种缓存策略（如网络优先、缓存优先等）
- **缓存验证**: 验证缓存的有效性
- **缓存同步**: 在网络恢复时同步缓存数据

## 缓存策略

缓存服务支持以下缓存策略：

- **网络优先 (Network First)**: 优先尝试从网络获取数据，失败时使用缓存
- **缓存优先 (Cache First)**: 优先尝试从缓存获取数据，失败时使用网络
- **仅网络 (Network Only)**: 只从网络获取数据，不使用缓存
- **仅缓存 (Cache Only)**: 只从缓存获取数据，不使用网络
- **先缓存后网络 (Stale While Revalidate)**: 先返回缓存数据，同时在后台更新缓存

## 缓存存储

缓存服务使用多级缓存存储：

- **内存缓存**: 用于存储频繁访问的小型数据
- **磁盘缓存**: 用于存储较大或需要持久化的数据
- **SQLite缓存**: 用于存储结构化数据和查询结果

## 与其他服务的交互

缓存服务与以下服务有交互：

- **网络服务**: 检测网络状态，决定缓存策略
- **存储服务**: 用于持久化缓存数据
- **API服务**: 拦截和缓存API请求

## 使用方法

```javascript
import { cacheService, imageCacheService, apiCacheService } from '../../services/cache';

// 使用基本缓存服务
async function fetchData(key) {
  // 尝试从缓存获取数据
  const cachedData = await cacheService.get(key);
  if (cachedData) {
    return cachedData;
  }
  
  // 如果缓存中没有，从网络获取
  const data = await fetchFromNetwork();
  
  // 将数据存入缓存
  await cacheService.set(key, data, { ttl: 3600 }); // 缓存1小时
  
  return data;
}

// 使用图片缓存服务
function renderCachedImage(url) {
  // 获取缓存的图片路径
  const cachedImagePath = imageCacheService.getCachedImagePath(url);
  
  return (
    <Image
      source={{ uri: cachedImagePath || url }}
      onError={() => imageCacheService.cacheImage(url)}
    />
  );
}

// 使用API缓存服务
async function fetchPosts() {
  // 使用缓存优先策略获取帖子列表
  const posts = await apiCacheService.fetch('/api/posts', {
    strategy: 'cache-first',
    ttl: 300, // 缓存5分钟
  });
  
  return posts;
}

// 清理缓存
async function clearCache() {
  await cacheService.clear();
  await imageCacheService.clear();
  await apiCacheService.clear();
}
```

## 注意事项

- 缓存服务应谨慎使用，避免缓存敏感数据
- 应为缓存设置合理的过期时间，避免数据过时
- 在适当的时机（如应用启动时）清理过期缓存
- 提供用户手动清理缓存的选项
- 监控缓存大小，避免占用过多存储空间
