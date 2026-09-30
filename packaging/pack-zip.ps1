<#
.SYNOPSIS
  TODO.md 포터블 zip 생성.

.DESCRIPTION
  `npm run tauri build` 로 만든 exe 와 안내 문서를 묶어 release\ 아래에 zip 을 만든다.
  target 디렉터리는 머신마다 다르므로(D: 로 뺀다) src-tauri\.cargo\config.toml 을 읽어 찾고,
  없으면 기본 위치를 본다. exe 가 없으면 멈춘다(반쪽 zip 을 내지 않는다).

.EXAMPLE
  powershell -File packaging\pack-zip.ps1
#>
[CmdletBinding()]
param(
    [string]$Version
)

$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot

if (-not $Version) {
    $pkg = Get-Content (Join-Path $root 'src\package.json') -Raw | ConvertFrom-Json
    $Version = $pkg.version
}

$cargoConfig = Join-Path $root 'src\src-tauri\.cargo\config.toml'
$targetDir = Join-Path $root 'src\src-tauri\target'
if (Test-Path $cargoConfig) {
    $line = Select-String -Path $cargoConfig -Pattern '^\s*target-dir\s*=\s*"(.+)"' | Select-Object -First 1
    if ($line) { $targetDir = $line.Matches[0].Groups[1].Value }
}

$exe = Join-Path $targetDir 'release\todo-md.exe'
if (-not (Test-Path $exe)) {
    throw "실행 파일을 찾지 못했다: $exe`n먼저 'cd src; npm run tauri build' 를 돌릴 것."
}

$stage = Join-Path $env:TEMP ("todomd-pack-" + [guid]::NewGuid().ToString('N').Substring(0, 8))
New-Item -ItemType Directory -Path $stage -Force | Out-Null
try {
    # 사용자에게 보이는 exe 이름은 제품명과 맞춘다(README.md ↔ TODO.md). 내부 바이너리 이름은 todo-md.
    Copy-Item $exe -Destination (Join-Path $stage 'TODO.md.exe')
    Copy-Item (Join-Path $PSScriptRoot 'README-portable.md') -Destination (Join-Path $stage 'README.md')
    $notices = Join-Path $root 'THIRD-PARTY-NOTICES.md'
    if (Test-Path $notices) { Copy-Item $notices -Destination $stage }
    # 사용 조건·개인정보 처리방침(legal/) — 없으면 멈춘다(조건 없는 배포물을 내지 않는다).
    foreach ($doc in 'EULA.md', 'privacy.md') {
        $src = Join-Path $root "legal\$doc"
        if (-not (Test-Path $src)) { throw "법률 문서가 없다: $src" }
        Copy-Item $src -Destination $stage
    }

    $outDir = Join-Path $root 'release'
    New-Item -ItemType Directory -Path $outDir -Force | Out-Null
    $zip = Join-Path $outDir "TODO.md-v$Version-win-x64.zip"
    if (Test-Path $zip) { Remove-Item $zip -Force }
    Compress-Archive -Path (Join-Path $stage '*') -DestinationPath $zip -CompressionLevel Optimal

    $sizeMb = [math]::Round((Get-Item $zip).Length / 1MB, 2)
    Write-Output "생성: $zip ($sizeMb MB)"
}
finally {
    Remove-Item $stage -Recurse -Force -ErrorAction SilentlyContinue
}
