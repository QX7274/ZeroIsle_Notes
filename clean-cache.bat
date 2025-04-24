@echo off
echo ===== 开始清理缓存 =====

:: 清理 Android 构建缓存
echo 正在清理 Android 构建缓存...
cd android
if exist gradlew.bat (
    call gradlew.bat clean
    call gradlew.bat cleanBuildCache
) else (
    echo gradlew.bat 不存在，跳过清理 Gradle 缓存
)

:: 清理 node_modules/.cache 目录
echo 正在清理 node_modules 缓存...
cd ..
if exist node_modules\.cache (
    rmdir /s /q node_modules\.cache
    echo node_modules\.cache 已清理
) else (
    echo node_modules\.cache 不存在，跳过清理
)

:: 清理 Gradle 用户主目录缓存
echo 正在清理 Gradle 用户主目录缓存...
if exist %USERPROFILE%\.gradle\caches (
    rmdir /s /q %USERPROFILE%\.gradle\caches\modules-2\files-2.1
    echo Gradle 依赖缓存已清理
) else (
    echo Gradle 用户主目录缓存不存在，跳过清理
)

echo ===== 缓存清理完成 =====
