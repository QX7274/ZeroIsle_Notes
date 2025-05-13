# 修复文件编码问题的脚本

# 获取所有 JavaScript 文件
$files = Get-ChildItem -Path "src" -Recurse -Include "*.js"

# 定义替换规则
$replacements = @(
    @{ Pattern = '初始化数据服�?'; Replacement = '初始化数据服务' },
    @{ Pattern = '初始化离线同步服�?'; Replacement = '初始化离线同步服务' },
    @{ Pattern = '数据服务初始化成�?'; Replacement = '数据服务初始化成功' },
    @{ Pattern = '数据服务初始化失�?'; Replacement = '数据服务初始化失败' },
    @{ Pattern = '创建的文�?'; Replacement = '创建的文档' },
    @{ Pattern = '保存到本�?'; Replacement = '保存到本地' },
    @{ Pattern = '添加到同步队�?'; Replacement = '添加到同步队列' },
    @{ Pattern = '从更新数据中删除不可修改的字�?'; Replacement = '从更新数据中删除不可修改的字段' },
    @{ Pattern = '如果在线，更新云�?'; Replacement = '如果在线，更新云端' },
    @{ Pattern = '硬删�?'; Replacement = '硬删除' },
    @{ Pattern = '如果在线，删除云�?'; Replacement = '如果在线，删除云端' },
    @{ Pattern = '同步硬删除文档失�?'; Replacement = '同步硬删除文档失败' },
    @{ Pattern = '默认不包含已删除的文�?'; Replacement = '默认不包含已删除的文档' },
    @{ Pattern = '从本地查�?'; Replacement = '从本地查询' },
    @{ Pattern = '检查网络连�?'; Replacement = '检查网络连接' },
    @{ Pattern = '网络离线，无法同�?'; Replacement = '网络离线，无法同步' },
    @{ Pattern = '如果需要拉取最新数�?'; Replacement = '如果需要拉取最新数据' },
    @{ Pattern = '获取最后同步时�?'; Replacement = '获取最后同步时间' },
    @{ Pattern = '从云端获取最新数�?'; Replacement = '从云端获取最新数据' },
    @{ Pattern = '如果云端版本更新，更新本�?'; Replacement = '如果云端版本更新，更新本地' },
    @{ Pattern = '更新最后同步时�?'; Replacement = '更新最后同步时间' },
    @{ Pattern = '最后同步时�?'; Replacement = '最后同步时间' },
    @{ Pattern = '获取最后同步时间失�?'; Replacement = '获取最后同步时间失败' },
    @{ Pattern = '添加数据事件监听�?'; Replacement = '添加数据事件监听器' },
    @{ Pattern = '监听�?'; Replacement = '监听器' },
    @{ Pattern = '移除数据事件监听�?'; Replacement = '移除数据事件监听器' },
    @{ Pattern = '开始初始化Realm数据�?'; Replacement = '开始初始化Realm数据库' },
    @{ Pattern = '初始化MongoDB适配器失�?'; Replacement = '初始化MongoDB适配器失败' },
    @{ Pattern = '优化�?'; Replacement = '优化的' },
    @{ Pattern = '处理特殊查询操作�?'; Replacement = '处理特殊查询操作符' },
    @{ Pattern = '获取所有对�?'; Replacement = '获取所有对象' },
    @{ Pattern = '转换为普通对象数�?'; Replacement = '转换为普通对象数组' },
    @{ Pattern = '查询${schemaName}文档失败'; Replacement = '查询${schemaName}文档失败' },
    @{ Pattern = '创建${schemaName}文档失败'; Replacement = '创建${schemaName}文档失败' },
    @{ Pattern = '更新${schemaName}文档失败'; Replacement = '更新${schemaName}文档失败' },
    @{ Pattern = '删除${schemaName}文档失败'; Replacement = '删除${schemaName}文档失败' },
    @{ Pattern = '数据库初始化服务 - 提供MongoDB和Realm数据库初始化和迁移功�?'; Replacement = '数据库初始化服务 - 提供MongoDB和Realm数据库初始化和迁移功能' },
    @{ Pattern = '创建必要的索�?'; Replacement = '创建必要的索引' },
    @{ Pattern = '知识边索�?'; Replacement = '知识边索引' },
    @{ Pattern = '数据库索引创建成�?'; Replacement = '数据库索引创建成功' },
    @{ Pattern = '创建数据库索引失�?'; Replacement = '创建数据库索引失败' },
    @{ Pattern = '重置数据�?'; Replacement = '重置数据库' },
    @{ Pattern = '数据库重置成�?'; Replacement = '数据库重置成功' },
    @{ Pattern = '重置数据库失�?'; Replacement = '重置数据库失败' },
    @{ Pattern = '重置本地数据�?'; Replacement = '重置本地数据库' },
    @{ Pattern = '本地数据库重置成�?'; Replacement = '本地数据库重置成功' },
    @{ Pattern = '重置本地数据库失�?'; Replacement = '重置本地数据库失败' },
    @{ Pattern = '重置云数据库'; Replacement = '重置云数据库' },
    @{ Pattern = '云数据库重置成功'; Replacement = '云数据库重置成功' },
    @{ Pattern = '重置云数据库失败'; Replacement = '重置云数据库失败' },
    @{ Pattern = '检查数据库状�?'; Replacement = '检查数据库状态' },
    @{ Pattern = '数据库状�?'; Replacement = '数据库状态' },
    @{ Pattern = '检查数据库状态失�?'; Replacement = '检查数据库状态失败' },
    @{ Pattern = 'MongoDB适配�?'; Replacement = 'MongoDB适配器' },
    @{ Pattern = '将mongoDBService的方法映射到realmService的方�?'; Replacement = '将mongoDBService的方法映射到realmService的方法' },
    @{ Pattern = '用于平滑过渡到新的存储架�?'; Replacement = '用于平滑过渡到新的存储架构' },
    @{ Pattern = 'Realm 模型定义'; Replacement = '定义应用中使用的所有 Realm 模型' },
    @{ Pattern = '定义应用中使用的所�?Realm 模型'; Replacement = '定义应用中使用的所有 Realm 模型' },
    @{ Pattern = 'JSON 字符�?'; Replacement = 'JSON 字符串' },
    @{ Pattern = '知识边模�?'; Replacement = '知识边模型' },
    @{ Pattern = '存储项模�?'; Replacement = '存储项模型' },
    @{ Pattern = '获取所有模�?'; Replacement = '获取所有模型' },
    @{ Pattern = '所有模型定�?'; Replacement = '所有模型定义' },
    @{ Pattern = '已注�?'; Replacement = '已注册' },
    @{ Pattern = '�?Realm 模型'; Replacement = '个 Realm 模型' },
    @{ Pattern = '注册 Realm 模型失败'; Replacement = '注册 Realm 模型失败' },
    @{ Pattern = '初始化云数据�?'; Replacement = '初始化云数据库' },
    @{ Pattern = '云数据库初始化成�?'; Replacement = '云数据库初始化成功' },
    @{ Pattern = '初始化云数据库失�?'; Replacement = '初始化云数据库失败' },
    @{ Pattern = '网络离线，使用本地模�?'; Replacement = '网络离线，使用本地模式' },
    @{ Pattern = 'Realm将使用本地模式，不连接MongoDB Atlas'; Replacement = 'Realm将使用本地模式，不连接MongoDB Atlas' }
)

# 处理每个文件
foreach ($file in $files) {
    Write-Host "处理文件: $($file.FullName)"
    
    # 读取文件内容
    $content = Get-Content -Path $file.FullName -Raw -Encoding UTF8
    $originalContent = $content
    
    # 应用所有替换规则
    foreach ($replacement in $replacements) {
        $content = $content -replace $replacement.Pattern, $replacement.Replacement
    }
    
    # 如果内容有变化，保存文件
    if ($content -ne $originalContent) {
        Write-Host "  修复编码问题: $($file.FullName)"
        Set-Content -Path $file.FullName -Value $content -Encoding UTF8
    }
}

Write-Host "所有文件处理完成"
