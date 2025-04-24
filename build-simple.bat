@echo off
echo ===== 开始构建应用程序 =====

:: 设置环境变量
set ANDROID_HOME=D:\Android\Sdk
set JAVA_HOME=C:\Program Files\Java\jdk-17

:: 设置构建参数
set GRADLE_OPTS=-Xmx2048m -XX:MaxMetaspaceSize=512m
set ORG_GRADLE_PROJECT_reactNativeArchitectures=arm64-v8a

:: 进入 Android 目录
cd android

:: 清理构建目录
echo 正在清理构建目录...
call gradlew.bat clean

:: 构建应用程序
echo 正在构建应用程序...
call gradlew.bat app:assembleDebug -x lint -x test --no-daemon --max-workers 2

cd ..
echo ===== 构建完成 =====
echo APK 文件位于: %cd%\android\app\build\outputs\apk\debug\app-debug.apk
