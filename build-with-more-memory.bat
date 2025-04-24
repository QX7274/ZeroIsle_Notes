@echo off
echo ===== 开始构建应用程序 =====

:: 设置环境变量
set JAVA_OPTS=-Xmx4g -XX:MaxMetaspaceSize=1g
set GRADLE_OPTS=-Xmx4g -XX:MaxMetaspaceSize=1g -Dorg.gradle.jvmargs="-Xmx4g -XX:MaxMetaspaceSize=1g"
set ORG_GRADLE_PROJECT_org.gradle.jvmargs=-Xmx4g -XX:MaxMetaspaceSize=1g
set ORG_GRADLE_PROJECT_reactNativeArchitectures=arm64-v8a

:: 进入 Android 目录
cd android

:: 构建应用程序
echo 正在构建应用程序...
call gradlew.bat app:assembleDebug --no-daemon --max-workers 2 -x lint -x test

cd ..
echo ===== 构建完成 =====
echo APK 文件位于: %cd%\android\app\build\outputs\apk\debug\app-debug.apk
