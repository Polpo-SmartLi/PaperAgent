$ErrorActionPreference = 'Stop'
Set-Location -LiteralPath $PSScriptRoot
foreach ($folder in @('tmp','data','cache')) { New-Item -ItemType Directory -Force -Path (Join-Path $PSScriptRoot $folder) | Out-Null }
$env:TEMP = Join-Path $PSScriptRoot 'tmp'
$env:TMP = $env:TEMP
$env:PYTHONPYCACHEPREFIX = Join-Path $PSScriptRoot 'cache\pycache'
$env:PIP_CACHE_DIR = Join-Path $PSScriptRoot 'cache\pip'
$env:PYTHONNOUSERSITE = '1'
$pythonExe = Join-Path $PSScriptRoot 'runtime\python.exe'
if (-not (Test-Path -LiteralPath $pythonExe) -or -not (Test-Path -LiteralPath (Join-Path $PSScriptRoot 'deps\pymupdf\__init__.py'))) {
    & (Join-Path $PSScriptRoot 'Install-PaperAgent.ps1')
}
$browser = @('C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe','C:\Program Files\Microsoft\Edge\Application\msedge.exe','C:\Program Files\Google\Chrome\Application\chrome.exe') | Where-Object { Test-Path -LiteralPath $_ } | Select-Object -First 1
if (-not $browser) { throw 'Edge or Chrome was not found. Install a supported browser and retry.' }
$healthy = $false
try { $health = Invoke-RestMethod http://127.0.0.1:8765/api/health -TimeoutSec 2; $healthy = $health.app -eq 'PaperAgent' } catch {}
if ($healthy -and $health.workspace_root -ne $PSScriptRoot) { throw 'Port 8765 is already used by another PaperAgent folder. Stop that instance first.' }
if (-not $healthy) {
    $listener = Get-NetTCPConnection -LocalPort 8765 -State Listen -ErrorAction SilentlyContinue
    if ($listener) { throw 'Port 8765 is in use. Close the previous PaperAgent server or other service and retry.' }
    $serverPath = Join-Path $PSScriptRoot 'server.py'
    Start-Process -FilePath $pythonExe -ArgumentList @('-B',('"' + $serverPath + '"')) -WorkingDirectory $PSScriptRoot -WindowStyle Hidden -RedirectStandardOutput (Join-Path $PSScriptRoot 'data\server.log') -RedirectStandardError (Join-Path $PSScriptRoot 'data\server-error.log')
    for ($i=0; $i -lt 30; $i++) {
        Start-Sleep -Milliseconds 200
        try { $health = Invoke-RestMethod http://127.0.0.1:8765/api/health -TimeoutSec 1; if ($health.app -eq 'PaperAgent' -and $health.workspace_root -eq $PSScriptRoot) { $healthy=$true;break } } catch {}
    }
}
if (-not $healthy) { throw 'The server failed to start. Check data\server-error.log.' }
$profileDefault = Join-Path $PSScriptRoot 'browser-profile\Default'
$downloads = Join-Path $PSScriptRoot 'data\downloads'
New-Item -ItemType Directory -Force -Path $profileDefault,$downloads | Out-Null
$prefsFile = Join-Path $profileDefault 'Preferences'
if (-not (Test-Path -LiteralPath $prefsFile)) {
    @{download=@{default_directory=$downloads;prompt_for_download=$false}} | ConvertTo-Json -Depth 5 | Set-Content -LiteralPath $prefsFile -Encoding utf8
}
$browserProfileArgument = '--user-data-dir="' + (Join-Path $PSScriptRoot 'browser-profile') + '"'
$browserCacheArgument = '--disk-cache-dir="' + (Join-Path $PSScriptRoot 'cache\browser') + '"'
Start-Process -FilePath $browser -ArgumentList @($browserProfileArgument,$browserCacheArgument,'--no-first-run','--no-default-browser-check','--disable-background-networking','--app=http://127.0.0.1:8765')
