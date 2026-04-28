param(
  [string]$Remote = "origin",
  [string]$Branch = "main",
  [switch]$DryRun,
  [switch]$SkipStatusCheck,
  [switch]$SkipPull,
  [switch]$NoRebase
)

$ErrorActionPreference = "Stop"

function Assert-Command {
  param([Parameter(Mandatory = $true)][string]$Name)
  if (-not (Get-Command $Name -ErrorAction SilentlyContinue)) {
    throw ("Missing command: {0}. Please install it and ensure it is in PATH." -f $Name)
  }
}

function Exec {
  param(
    [Parameter(Mandatory = $true)][string]$Exe,
    [Parameter(Mandatory = $true)][string[]]$Args
  )

  $printed = ($Args -join " ")
  Write-Host (">> {0} {1}" -f $Exe, $printed)
  & $Exe @Args
  if ($LASTEXITCODE -ne 0) {
    throw ("Command failed (exit={0}): {1} {2}" -f $LASTEXITCODE, $Exe, $printed)
  }
}

Assert-Command -Name "git"
Assert-Command -Name "gh"

function Check-RemoteConnectivity {
  param(
    [Parameter(Mandatory = $true)][string]$Remote
  )
  Write-Host ("== Preflight: check connectivity to remote '{0}' ==" -f $Remote)
  & git ls-remote $Remote -q 2>$null | Out-Null
  if ($LASTEXITCODE -ne 0) {
    Write-Host "Unable to reach remote. Common fixes:"
    Write-Host "  - Configure proxy: set HTTPS_PROXY / HTTP_PROXY / ALL_PROXY"
    Write-Host "  - If you are in a restricted network, consider SSH over 443 (ssh.github.com:443)"
    throw "Remote connectivity check failed: git ls-remote $Remote"
  }
}

Write-Host "== Check GitHub CLI auth status =="
try {
  Exec "gh" @("auth", "status", "-h", "github.com")
} catch {
  Write-Host "Not authenticated. Run: gh auth login -h github.com"
  throw
}

Check-RemoteConnectivity -Remote $Remote

Write-Host "== Verify this is a git repository =="
Exec "git" @("rev-parse", "--is-inside-work-tree") | Out-Null

if (-not $SkipStatusCheck) {
  Write-Host "== Check working tree is clean (use -SkipStatusCheck to bypass) =="
  $status = (& git status --porcelain)
  if ($status) {
    throw "Working tree is not clean. Commit/stash first, or pass -SkipStatusCheck (not recommended)."
  }
} else {
  $status = (& git status --porcelain)
  if ($status -and -not $SkipPull) {
    Write-Host "Working tree is not clean. Auto-enabling -SkipPull to avoid pull/rebase failure."
    $SkipPull = $true
  }
}

Write-Host ("== Fetch remote and checkout {0} ==" -f $Branch)
Exec "git" @("fetch", $Remote)

$localBranchExists = $false
& git show-ref --verify --quiet ("refs/heads/{0}" -f $Branch)
if ($LASTEXITCODE -eq 0) { $localBranchExists = $true }

if ($localBranchExists) {
  Exec "git" @("checkout", $Branch)
} else {
  Write-Host ("Local branch {0} not found; creating from {1}/{0}..." -f $Branch, $Remote)
  Exec "git" @("checkout", "-b", $Branch, ("{0}/{1}" -f $Remote, $Branch))
}

if ($SkipPull) {
  Write-Host "== Skip pull (requested) =="
} elseif ($NoRebase) {
  Write-Host "== Pull remote changes (no rebase) =="
  Exec "git" @("pull", $Remote, $Branch)
} else {
  Write-Host "== Pull remote changes (rebase) =="
  Exec "git" @("pull", "--rebase", $Remote, $Branch)
}

Write-Host ("== Push to {0} {1} ==" -f $Remote, $Branch)
if ($DryRun) {
  Exec "git" @("push", "--dry-run", $Remote, $Branch)
  Write-Host "DryRun completed: no changes pushed."
} else {
  Exec "git" @("push", $Remote, $Branch)
  Write-Host "Push completed. Check GitHub Actions for the triggered workflows."
}
