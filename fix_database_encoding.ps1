# 修复数据库文件编码问题的脚本

# 获取所有数据库相关的JavaScript文件
$files = Get-ChildItem -Path "src\services\database" -Recurse -Include "*.js"

# 定义替换规则
$replacements = @(
    # 通用乱码修复
    @{ Pattern = '初始化配置服�?'; Replacement = '初始化配置服务' },
    @{ Pattern = '获取数据库配�?'; Replacement = '获取数据库配置' },
    @{ Pattern = '创建必要的索�?'; Replacement = '创建必要的索引' },
    @{ Pattern = '数据库初始化服务初始化成�?'; Replacement = '数据库初始化服务初始化成功' },
    @{ Pattern = '数据库初始化服务初始化失�?'; Replacement = '数据库初始化服务初始化失败' },
    @{ Pattern = '初始化云数据�?'; Replacement = '初始化云数据库' },
    @{ Pattern = '云数据库初始化成�?'; Replacement = '云数据库初始化成功' },
    @{ Pattern = '初始化云数据库失�?'; Replacement = '初始化云数据库失败' },
    @{ Pattern = '应用将在离线模式下运�?'; Replacement = '应用将在离线模式下运行' },
    @{ Pattern = '创建数据库索�?'; Replacement = '创建数据库索引' },
    @{ Pattern = '检查是否在�?'; Replacement = '检查是否在线' },
    @{ Pattern = '知识边索�?'; Replacement = '知识边索引' },
    @{ Pattern = '数据库索引创建成�?'; Replacement = '数据库索引创建成功' },
    @{ Pattern = '创建数据库索引失�?'; Replacement = '创建数据库索引失败' },
    @{ Pattern = '更新迁移状�?'; Replacement = '更新迁移状态' },
    @{ Pattern = '重置数据�?'; Replacement = '重置数据库' },
    @{ Pattern = '重置本地数据�?'; Replacement = '重置本地数据库' },
    @{ Pattern = '数据库重置成�?'; Replacement = '数据库重置成功' },
    @{ Pattern = '重置数据库失�?'; Replacement = '重置数据库失败' },
    @{ Pattern = '本地数据库重置成�?'; Replacement = '本地数据库重置成功' },
    @{ Pattern = '重置本地数据库失�?'; Replacement = '重置本地数据库失败' },
    @{ Pattern = '重新初始�?'; Replacement = '重新初始化' },
    @{ Pattern = '重置初始化状�?'; Replacement = '重置初始化状态' },
    @{ Pattern = '检查数据库状�?'; Replacement = '检查数据库状态' },
    @{ Pattern = '数据库状�?'; Replacement = '数据库状态' },
    @{ Pattern = '检查数据库状态失�?'; Replacement = '检查数据库状态失败' },
    
    # 修复语法错误
    @{ Pattern = '```'; Replacement = '```' },
    @{ Pattern = '```javascript'; Replacement = '```javascript' },
    @{ Pattern = '```json'; Replacement = '```json' }
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
