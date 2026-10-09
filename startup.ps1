# Windows counterpart to startup.sh. Keep the Linux App Builder entrypoint intact.
$ErrorActionPreference = 'Stop'
$taskRoot = $PSScriptRoot
$appUrl = 'http://127.0.0.1:8080/'

try {
  $response = Invoke-WebRequest -Uri $appUrl -UseBasicParsing -TimeoutSec 2
  if ($response.StatusCode -ge 200 -and $response.StatusCode -lt 400) {
    Write-Output 'The development app is already running.'
    exit 0
  }
} catch {
  # The server may be down or still starting; inspect before starting a second copy.
}

$listeners = @(Get-NetTCPConnection -ErrorAction Stop | Where-Object {
  $_.State -eq 'Listen' -and $_.LocalPort -eq 8080
})
if ($listeners.Count -gt 0) {
  Write-Output 'Port 8080 already has a listener. The existing process was left running.'
  exit 0
}

$stateDir = Join-Path $taskRoot '.grok'
$pidFile = Join-Path $stateDir 'dev.pid'
if (Test-Path -LiteralPath $pidFile) {
  $existingAppPid = 0
  if ([int]::TryParse((Get-Content -LiteralPath $pidFile -Raw).Trim(), [ref]$existingAppPid) -and $existingAppPid -gt 1) {
    $existingAppProcess = Get-CimInstance Win32_Process -Filter "ProcessId = $existingAppPid" -ErrorAction SilentlyContinue
    $rootPattern = [regex]::Escape($taskRoot) + '(?:[\\/\s"]|$)'
    if ($existingAppProcess -and $existingAppProcess.CommandLine -match $rootPattern -and $existingAppProcess.CommandLine -match '\brun\s+dev(?:\s|$)') {
      Write-Output 'The development app is already starting.'
      exit 0
    }
  }
}

$nodePath = (Get-Command node -CommandType Application -ErrorAction Stop | Select-Object -First 1).Source
$npmCandidates = @(
  $env:npm_execpath
  (Join-Path (Split-Path -Parent $nodePath) 'node_modules/npm/bin/npm-cli.js')
)
$npmCommand = Get-Command npm.cmd -CommandType Application -ErrorAction SilentlyContinue | Select-Object -First 1
if ($npmCommand) {
  $npmCandidates += Join-Path (Split-Path -Parent $npmCommand.Source) 'node_modules/npm/bin/npm-cli.js'
}
$npmCliPath = $npmCandidates | Where-Object {
  $_ -and (Split-Path -Leaf $_) -eq 'npm-cli.js' -and (Test-Path -LiteralPath $_ -PathType Leaf)
} | Select-Object -First 1
if (-not $npmCliPath) {
  throw 'Cannot find npm-cli.js. Install npm alongside Node.js before starting the app.'
}

New-Item -ItemType Directory -Path $stateDir -Force | Out-Null
$appProcess = Start-Process -FilePath $nodePath -ArgumentList @(
  ('"' + $npmCliPath + '"')
  '--prefix'
  ('"' + $taskRoot + '"')
  'run'
  'dev'
) -WorkingDirectory $taskRoot -WindowStyle Hidden -RedirectStandardOutput (Join-Path $stateDir 'dev.log') -RedirectStandardError (Join-Path $stateDir 'dev.error.log') -PassThru
Set-Content -LiteralPath $pidFile -Value $appProcess.Id -Encoding ASCII
Write-Output 'The development app is starting in the background.'
