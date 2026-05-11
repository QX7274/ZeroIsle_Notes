@echo off
setlocal
set "ANDROID_SDK_ROOT=C:\Users\QX\AppData\Local\Android\Sdk"
set "ANDROID_HOME=%ANDROID_SDK_ROOT%"
set "SDKMANAGER=%ANDROID_SDK_ROOT%\cmdline-tools\latest\bin\sdkmanager.bat"

if not exist "%SDKMANAGER%" (
  echo sdkmanager.bat not found: %SDKMANAGER%
  exit /b 1
)

echo y | "%SDKMANAGER%" --sdk_root="%ANDROID_SDK_ROOT%" ^
  "ndk;26.1.10909125" ^
  "cmake;3.22.1" ^
  "platform-tools" ^
  "platforms;android-35" ^
  "build-tools;34.0.0"
