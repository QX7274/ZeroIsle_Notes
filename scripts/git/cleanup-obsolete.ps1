param(
  [switch]$DryRun
)

$ErrorActionPreference = "Stop"

function Remove-IfExists {
  param([Parameter(Mandatory = $true)][string]$Path)
  if (Test-Path -LiteralPath $Path) {
    if ($DryRun) {
      Write-Host ("[DryRun] Remove: {0}" -f $Path)
    } else {
      Write-Host ("Remove: {0}" -f $Path)
      Remove-Item -LiteralPath $Path -Force -Recurse
    }
  }
}

function Remove-ByGlob {
  param([Parameter(Mandatory = $true)][string]$Glob)
  $items = Get-ChildItem -Path $Glob -Force -ErrorAction SilentlyContinue
  foreach ($item in $items) {
    Remove-IfExists -Path $item.FullName
  }
}

Write-Host "== Cleanup obsolete / local artifacts =="

Remove-IfExists -Path (Join-Path $PSScriptRoot "..\\..\\tmp")
Remove-IfExists -Path (Join-Path $PSScriptRoot "..\\..\\output")

$repoRoot = Resolve-Path (Join-Path $PSScriptRoot "..\\..") | Select-Object -ExpandProperty Path
Push-Location $repoRoot
try {
  Remove-ByGlob -Glob ".\\*.realm"
  Remove-ByGlob -Glob ".\\*.realm.lock"
  Remove-ByGlob -Glob ".\\studio_java_status.txt"
  Remove-ByGlob -Glob ".\\where_*.txt"
  Remove-ByGlob -Glob ".\\window_dump*.xml"
  Remove-ByGlob -Glob ".\\retest_step*.txt"
  Remove-ByGlob -Glob ".\\run_android_*.txt"
  Remove-ByGlob -Glob ".\\schedule_dump_cmd.txt"
  Remove-ByGlob -Glob ".\\tmp_*.py"
  Remove-ByGlob -Glob ".\\tmp_*.txt"
  Remove-ByGlob -Glob ".\\old_*.js"
  Remove-ByGlob -Glob ".\\java_*.txt"
  Remove-ByGlob -Glob ".\\adb_*.txt"
  Remove-ByGlob -Glob ".\\.tmp_*.py"
} finally {
  Pop-Location
}

Write-Host "Cleanup completed."
