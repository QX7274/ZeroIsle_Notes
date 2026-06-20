param(
    [string]$Round = ("round" + (Get-Date -Format "yyyyMMdd_HHmmss")),
    [string]$DeviceSerial = "HGR3Y9MA",
    [string]$PackageName = "com.zeroisle_notes",
    [string]$MainActivity = ".MainActivity",
    [string]$ApiPort = "8001",
    [string]$MetroPort = "8081",
    [string]$DirectApiHost = "",
    [switch]$SkipMetroRestart,
    [switch]$SkipCapture,
    [switch]$SkipMetroResetCache,
    [int]$LaunchWaitSeconds = 10
)

$ErrorActionPreference = "Stop"

function Write-Step {
    param([string]$Message)
    Write-Host ("[{0}] {1}" -f (Get-Date -Format "HH:mm:ss"), $Message)
}

function Test-HttpText {
    param(
        [string]$Uri,
        [int]$TimeoutSec = 5
    )

    try {
        $response = Invoke-WebRequest -Uri $Uri -UseBasicParsing -TimeoutSec $TimeoutSec
        if ($response.Content -is [byte[]]) {
            return [System.Text.Encoding]::UTF8.GetString($response.Content)
        }
        return [string]$response.Content
    } catch {
        return $null
    }
}

function Invoke-Adb {
    param(
        [Parameter(ValueFromRemainingArguments = $true)]
        [string[]]$Args
    )

    & adb -s $DeviceSerial @Args
    if ($LASTEXITCODE -ne 0) {
        throw "ADB 执行失败: adb -s $DeviceSerial $($Args -join ' ')"
    }
}

function Ensure-Directory {
    param([string]$Path)
    if (-not (Test-Path -LiteralPath $Path)) {
        New-Item -ItemType Directory -Path $Path | Out-Null
    }
}

function Remove-DirectorySafe {
    param([string]$Path)
    if (Test-Path -LiteralPath $Path) {
        Remove-Item -LiteralPath $Path -Recurse -Force -ErrorAction SilentlyContinue
    }
}

$repoRoot = Split-Path -Parent (Split-Path -Parent $PSScriptRoot)
$tmpRoot = Join-Path $repoRoot ".codex-tmp"
$sessionDir = Join-Path $tmpRoot "android-debug-sessions"
$roundDir = Join-Path $sessionDir $Round
$roundTempRoot = Join-Path $roundDir "runtime"
$metroTempDir = Join-Path $roundTempRoot "metro-temp"
$metroCacheDir = Join-Path $roundTempRoot "metro-cache"
$localCaptureDir = Join-Path $repoRoot ".local\android-mcp-server"
$captureScript = Join-Path $repoRoot "scripts\android\capture_android_round.py"

Ensure-Directory -Path $tmpRoot
Ensure-Directory -Path $sessionDir
Ensure-Directory -Path $roundDir
Remove-DirectorySafe -Path $roundTempRoot
Ensure-Directory -Path $roundTempRoot
Ensure-Directory -Path $metroTempDir
Ensure-Directory -Path $metroCacheDir

$metroStdout = Join-Path $roundDir "metro.stdout.log"
$metroStderr = Join-Path $roundDir "metro.stderr.log"
$logcatPath = Join-Path $roundDir "logcat.txt"
$summaryPath = Join-Path $roundDir "summary.txt"
$script:apiHealthResult = ""
$script:deviceHealthResult = ""
$script:deviceApiProbeUrl = ""
$script:metroStatusResult = ""
$script:sessionFailed = $false
$script:failureMessage = ""

try {
    Write-Step "检查设备在线状态"
    $adbDevices = & adb devices -l
    if ($LASTEXITCODE -ne 0) {
        throw "adb devices 执行失败"
    }
    $adbDevices | Set-Content -Path (Join-Path $roundDir "adb_devices.txt") -Encoding UTF8
    if (-not ($adbDevices -match [regex]::Escape($DeviceSerial) + ".*device")) {
        throw "目标设备 $DeviceSerial 未处于 device 状态"
    }

    Write-Step "检查本机后端健康状态"
    $apiHealth = Test-HttpText -Uri ("http://127.0.0.1:{0}/health/" -f $ApiPort) -TimeoutSec 5
    if (-not $apiHealth) {
        throw "本机后端 http://127.0.0.1:$ApiPort/health/ 未通过"
    }
    $script:apiHealthResult = $apiHealth
    $apiHealth | Set-Content -Path (Join-Path $roundDir "api_health.txt") -Encoding UTF8

    Write-Step "建立 ADB reverse"
    Invoke-Adb reverse ("tcp:{0}" -f $ApiPort) ("tcp:{0}" -f $ApiPort)
    Invoke-Adb reverse ("tcp:{0}" -f $MetroPort) ("tcp:{0}" -f $MetroPort)
    (& adb -s $DeviceSerial reverse --list) | Set-Content -Path (Join-Path $roundDir "adb_reverse_list.txt") -Encoding UTF8

    Write-Step "设备侧验证后端联通"
    $script:deviceApiProbeUrl = if ([string]::IsNullOrWhiteSpace($DirectApiHost)) {
        "http://127.0.0.1:{0}/health/" -f $ApiPort
    } else {
        "http://{0}:{1}/health/" -f $DirectApiHost, $ApiPort
    }
    $deviceHealth = & adb -s $DeviceSerial shell curl -s -S --connect-timeout 4 --max-time 10 $script:deviceApiProbeUrl
    if ($LASTEXITCODE -ne 0 -or -not $deviceHealth) {
        throw "设备侧后端联通验证失败: $script:deviceApiProbeUrl"
    }
    $script:deviceHealthResult = $deviceHealth
    $deviceHealth | Set-Content -Path (Join-Path $roundDir "device_api_health.txt") -Encoding UTF8

    if (-not $SkipMetroRestart) {
        Write-Step "清理旧 Metro / node 残留"
        Get-Process -Name node -ErrorAction SilentlyContinue | Stop-Process -Force -ErrorAction SilentlyContinue
        Get-Process -Name java -ErrorAction SilentlyContinue |
            Where-Object { $_.Path -like '*jdk*' } |
            Stop-Process -Force -ErrorAction SilentlyContinue
        Start-Sleep -Seconds 2

        Write-Step "使用工作区缓存重启 Metro"
        $resetCacheArg = if ($SkipMetroResetCache) { "" } else { " --reset-cache" }
        $metroCommand = @"
`$env:TEMP = '$metroTempDir'
`$env:TMP = '$metroTempDir'
`$env:TMPDIR = '$metroTempDir'
`$env:METRO_CACHE = '$metroCacheDir'
Set-Location '$repoRoot'
node node_modules/react-native/cli.js start --port $MetroPort$resetCacheArg *>> '$metroStdout' 2>> '$metroStderr'
"@
        $encodedCommand = [Convert]::ToBase64String([System.Text.Encoding]::Unicode.GetBytes($metroCommand))
        Start-Process -FilePath "pwsh" -ArgumentList @("-NoLogo", "-NoProfile", "-EncodedCommand", $encodedCommand) -WindowStyle Hidden | Out-Null
        Start-Sleep -Seconds 8
    }

    Write-Step "检查 Metro 状态"
    $metroStatus = $null
    for ($i = 0; $i -lt 6; $i++) {
        $metroStatus = Test-HttpText -Uri ("http://127.0.0.1:{0}/status" -f $MetroPort) -TimeoutSec 5
        if ($metroStatus) {
            break
        }
        Start-Sleep -Seconds 2
    }
    if (-not $metroStatus) {
        throw "Metro /status 未恢复"
    }
    $script:metroStatusResult = $metroStatus
    $metroStatus | Set-Content -Path (Join-Path $roundDir "metro_status.txt") -Encoding UTF8

    Write-Step "清空并开始采集 logcat"
    & adb -s $DeviceSerial logcat -c
    Start-Process -FilePath "pwsh" -ArgumentList @(
        "-NoLogo",
        "-NoProfile",
        "-Command",
        "adb -s $DeviceSerial logcat > '$logcatPath'"
    ) -WindowStyle Hidden | Out-Null
    Start-Sleep -Seconds 2

    Write-Step "冷启动应用"
    & adb -s $DeviceSerial shell am force-stop $PackageName
    Start-Sleep -Seconds 1
    Invoke-Adb shell am start -n "$PackageName/$MainActivity"
    Start-Sleep -Seconds $LaunchWaitSeconds

    if (-not $SkipCapture) {
        Write-Step "采集当前前台截图与 UI XML"
        & python -X utf8 $captureScript --round $Round --serial $DeviceSerial --package $PackageName --activity $MainActivity --ensure-foreground
        if ($LASTEXITCODE -ne 0) {
            throw "抓证脚本执行失败"
        }
    }
} catch {
    $script:sessionFailed = $true
    $script:failureMessage = $_.Exception.Message
    throw
} finally {
    Write-Step "输出摘要"
    $summaryLines = @(
        "round=$Round",
        "device=$DeviceSerial",
        "api_health=$script:apiHealthResult",
        "device_api_health=$script:deviceHealthResult",
        "device_api_probe_url=$script:deviceApiProbeUrl",
        "metro_status=$script:metroStatusResult",
        "session_failed=$script:sessionFailed",
        "failure_message=$script:failureMessage",
        "round_dir=$roundDir",
        "capture_xml=$(Join-Path $localCaptureDir ($Round + '.xml'))",
        "capture_png=$(Join-Path $localCaptureDir ($Round + '.png'))",
        "logcat=$logcatPath",
        "metro_stdout=$metroStdout",
        "metro_stderr=$metroStderr"
    )
    $summaryLines | Set-Content -Path $summaryPath -Encoding UTF8
    $summaryLines | ForEach-Object { Write-Host $_ }
}
