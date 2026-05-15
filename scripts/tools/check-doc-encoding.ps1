Param(
    [string]$DocsPath = "D:\ZeroIsle_Notes\docs"
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

if (-not (Test-Path -LiteralPath $DocsPath)) {
    Write-Error "Docs path not found: $DocsPath"
}

$utf8Strict = New-Object System.Text.UTF8Encoding($false, $true)
$failed = @()

$files = Get-ChildItem -LiteralPath $DocsPath -Recurse -File -Include *.md
foreach ($file in $files) {
    try {
        $bytes = [System.IO.File]::ReadAllBytes($file.FullName)
        [void]$utf8Strict.GetString($bytes)
    }
    catch {
        $failed += $file.FullName
    }
}

if ($failed.Count -gt 0) {
    Write-Host "The following markdown files are not strict UTF-8:" -ForegroundColor Red
    $failed | ForEach-Object { Write-Host $_ -ForegroundColor Red }
    exit 1
}

Write-Host "UTF-8 encoding check passed. Markdown files checked: $($files.Count)" -ForegroundColor Green
exit 0
