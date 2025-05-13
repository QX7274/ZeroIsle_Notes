# 修复 logService 导入的脚本

# 获取所有导入 logService 的文件
$files = Get-ChildItem -Path "src" -Recurse -Include "*.js" | Select-String -Pattern "import.*logService.*from.*services/utils/logService" | Select-Object Path -Unique

# 处理每个文件
foreach ($file in $files) {
    $filePath = $file.Path
    Write-Host "处理文件: $filePath"
    
    # 读取文件内容
    $content = Get-Content -Path $filePath -Raw -Encoding UTF8
    $originalContent = $content
    
    # 替换导入语句
    $content = $content -replace "import \{ logService \} from '.*services/utils/logService';", ""
    $content = $content -replace "import \{ logService \} from '.*services/utils/logService'", ""
    
    # 替换 logService 的使用
    $content = $content -replace "logService\.info\(", "console.info("
    $content = $content -replace "logService\.error\(", "console.error("
    $content = $content -replace "logService\.warn\(", "console.warn("
    $content = $content -replace "logService\.debug\(", "console.debug("
    
    # 如果内容有变化，保存文件
    if ($content -ne $originalContent) {
        Write-Host "  修复 logService 导入: $filePath"
        Set-Content -Path $filePath -Value $content -Encoding UTF8
    }
}

Write-Host "所有文件处理完成"
