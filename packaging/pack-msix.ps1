<#
.SYNOPSIS
  TODO.md MSIX (Microsoft Store) package.

.DESCRIPTION
  Packs the exe built by `npm run tauri build` into release\TODO.md_<version>_x64.msix.
  - Default   : unsigned .msix for Partner Center upload (the Store re-signs it).
  - -Register : also registers the staged folder on THIS PC (needs Developer Mode, no signing, no admin)
                so the app runs as a packaged app for testing. Remove with -Unregister.
  Identity defaults to the SlnU Partner Center account (same Publisher as md-reader). Pass the reserved
  -IdentityName after reserving the app name in Partner Center.
  Refuses to pack an exe whose version differs from tauri.conf.json (a stale build under a new number).
  ASCII only so it runs under Windows PowerShell 5.1 and PowerShell 7.

.EXAMPLE
  powershell -File packaging\pack-msix.ps1                       # Store upload
  powershell -File packaging\pack-msix.ps1 -Register             # local packaged test
  powershell -File packaging\pack-msix.ps1 -Unregister           # remove the local test package
  powershell -File packaging\pack-msix.ps1 -IdentityName "SlnU.TODO.md"
#>
[CmdletBinding()]
param(
    [string]$IdentityName = "SlnU.TODO.md",
    [string]$Publisher = "CN=1398342C-A2D7-4B4A-BFE2-34D8CCFD7FBA",
    [string]$PublisherDisplay = "SlnU",
    [switch]$Register,
    [switch]$Unregister
)

$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot
$tauri = Join-Path $root 'src\src-tauri'

if ($Unregister) {
    $p = Get-AppxPackage -Name $IdentityName
    if ($p) { Remove-AppxPackage -Package $p.PackageFullName; Write-Output "unregistered: $($p.PackageFullName)" }
    else { Write-Output "not registered: $IdentityName" }
    return
}

# 1) exe (target dir can be redirected by .cargo\config.toml, same as pack-zip.ps1)
$targetDir = Join-Path $tauri 'target'
$cargoConfig = Join-Path $tauri '.cargo\config.toml'
if (Test-Path $cargoConfig) {
    $line = Select-String -Path $cargoConfig -Pattern '^\s*target-dir\s*=\s*"(.+)"' | Select-Object -First 1
    if ($line) { $targetDir = $line.Matches[0].Groups[1].Value }
}
$exe = Join-Path $targetDir 'release\todo-md.exe'
if (-not (Test-Path $exe)) { throw "exe not found: $exe  (run 'cd src; npm run tauri build' first)" }

# 2) version: tauri.conf.json (UTF-8) -> 4 parts; the exe must match
$conf = [System.IO.File]::ReadAllText((Join-Path $tauri 'tauri.conf.json'), [System.Text.Encoding]::UTF8) | ConvertFrom-Json
$ver3 = $conf.version
$ver4 = "$ver3.0"
$fv = (Get-Item $exe).VersionInfo.ProductVersion
if ($fv -and ($fv -notmatch ('^' + [regex]::Escape($ver3) + '(\.|$)'))) {
    throw "exe is version '$fv' but tauri.conf.json says '$ver3'. Rebuild first."
}

# 3) SDK
$makeappx = (Get-ChildItem 'C:\Program Files (x86)\Windows Kits\10\bin\*\x64\makeappx.exe' -ErrorAction SilentlyContinue |
    Sort-Object FullName -Descending | Select-Object -First 1).FullName
if (-not $makeappx) { throw 'makeappx.exe not found (install the Windows SDK).' }

# 4) stage: exe + assets + manifest (+ license texts so they travel with the app)
$out = Join-Path $root 'release'
$stage = Join-Path $out 'msix-stage'
if (Test-Path $stage) {
    if ($Register -and (Get-AppxPackage -Name $IdentityName)) { throw "$IdentityName is registered from $stage - run -Unregister first." }
    Remove-Item $stage -Recurse -Force
}
New-Item -ItemType Directory -Force -Path (Join-Path $stage 'Assets') | Out-Null
Copy-Item $exe (Join-Path $stage 'todo-md.exe')
foreach ($n in @('StoreLogo.png', 'Square44x44Logo.png', 'Square71x71Logo.png', 'Square150x150Logo.png')) {
    Copy-Item (Join-Path $tauri "icons\$n") (Join-Path $stage "Assets\$n")
}
foreach ($doc in @('THIRD-PARTY-NOTICES.md', 'legal\EULA.md', 'legal\privacy.md')) {
    $src = Join-Path $root $doc
    if (-not (Test-Path $src)) { throw "missing: $src" }
    Copy-Item $src $stage
}
$tpl = [System.IO.File]::ReadAllText((Join-Path $PSScriptRoot 'msix\AppxManifest.template.xml'), [System.Text.Encoding]::UTF8)
$manifest = $tpl.Replace('@EXE@', 'todo-md.exe').Replace('@VERSION@', $ver4).Replace('@PUBLISHER@', $Publisher).Replace('@IDENTITY_NAME@', $IdentityName).Replace('@PUBLISHER_DISPLAY@', $PublisherDisplay)
if ($manifest -match '@[A-Z_]+@') { throw "unreplaced token in manifest: $($Matches[0])" }
[System.IO.File]::WriteAllText((Join-Path $stage 'AppxManifest.xml'), $manifest, (New-Object System.Text.UTF8Encoding($false)))

# 5) pack
$msix = Join-Path $out "TODO.md_${ver3}_x64.msix"
& $makeappx pack /o /d $stage /p $msix | Out-Null
if ($LASTEXITCODE -ne 0) { throw "makeappx failed ($LASTEXITCODE)" }
$mb = [math]::Round((Get-Item $msix).Length / 1MB, 2)
Write-Output "MSIX: $msix ($mb MB)  version=$ver4 identity=$IdentityName publisher=$Publisher"

# 6) optional local registration (Developer Mode). Runs from the stage folder - keep it until -Unregister.
if ($Register) {
    Add-AppxPackage -Register (Join-Path $stage 'AppxManifest.xml')
    $p = Get-AppxPackage -Name $IdentityName
    Write-Output "registered: $($p.PackageFullName)  family=$($p.PackageFamilyName)"
    Write-Output "launch: explorer.exe shell:AppsFolder\$($p.PackageFamilyName)!TodoMd"
}
