@echo off
echo Building APK in offline mode...
call gradlew.bat --offline app:assembleDebug -x test -x lint
echo Build completed!
