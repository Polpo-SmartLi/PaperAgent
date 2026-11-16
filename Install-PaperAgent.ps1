$ErrorActionPreference = 'Stop'
$projectRoot = $PSScriptRoot
Set-Location -LiteralPath $projectRoot
foreach ($folder in @('tmp','cache','cache\pip','data','deps','tools')) {
    New-Item -ItemType Directory -Force -Path (Join-Path $projectRoot $folder) | Out-Null
}
$env:TEMP = Join-Path $projectRoot 'tmp'
$env:TMP = $env:TEMP
$env:PIP_CACHE_DIR = Join-Path $projectRoot 'cache\pip'
$env:PYTHONPYCACHEPREFIX = Join-Path $projectRoot 'cache\pycache'
$env:PYTHONNOUSERSITE = '1'
$env:PIP_DISABLE_PIP_VERSION_CHECK = '1'
[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
$pythonExe = Join-Path $projectRoot 'runtime\python.exe'
if (-not (Test-Path -LiteralPath $pythonExe)) {
    Write-Host 'Downloading the project-local Python runtime...'
    $archive = Join-Path $projectRoot 'cache\python-3.12.10-embed-amd64.zip'
    $expectedHash = '4ACBED6DD1C744B0376E3B1CF57CE906F9DC9E95E68824584C8099A63025A3C3'
    if (Test-Path -LiteralPath $archive) {
        if ((Get-FileHash -LiteralPath $archive -Algorithm SHA256).Hash -ne $expectedHash) { throw 'Python archive checksum mismatch. Remove the cached archive and retry.' }
    } else {
        Invoke-WebRequest -UseBasicParsing -Uri 'https://www.python.org/ftp/python/3.12.10/python-3.12.10-embed-amd64.zip' -OutFile $archive
    }
    if ((Get-FileHash -LiteralPath $archive -Algorithm SHA256).Hash -ne $expectedHash) { throw 'Python archive checksum mismatch. Installation stopped.' }
    Expand-Archive -LiteralPath $archive -DestinationPath (Join-Path $projectRoot 'runtime') -Force
}
@('python312.zip','.','..','..\deps','..\tools','import site') | Set-Content -LiteralPath (Join-Path $projectRoot 'runtime\python312._pth') -Encoding ascii
if (-not (Test-Path -LiteralPath (Join-Path $projectRoot 'tools\pip\__main__.py'))) {
    Write-Host 'Preparing project-local pip...'
    $bootstrapFile = Join-Path $projectRoot 'cache\get-pip.py'
    Invoke-WebRequest -UseBasicParsing -Uri 'https://bootstrap.pypa.io/get-pip.py' -OutFile $bootstrapFile
    & $pythonExe -B $bootstrapFile --target (Join-Path $projectRoot 'tools') --no-warn-script-location --no-compile --no-setuptools --no-wheel 'pip==25.3'
    if ($LASTEXITCODE -ne 0) { throw 'pip installation failed. Check your network connection and retry.' }
}
Write-Host 'Installing PDF dependencies inside this project...'
& $pythonExe -B -m pip install --target (Join-Path $projectRoot 'deps') --cache-dir $env:PIP_CACHE_DIR --upgrade --no-compile --no-warn-script-location -r (Join-Path $projectRoot 'requirements.txt')
if ($LASTEXITCODE -ne 0) { throw 'Dependency installation failed. Check your network connection and retry.' }
& $pythonExe -B -c 'import pymupdf; print(pymupdf.VersionBind)'
if ($LASTEXITCODE -ne 0) { throw 'PDF runtime validation failed.' }
Write-Host 'Setup complete. Run Start-PaperAgent.cmd to open PaperAgent.'
