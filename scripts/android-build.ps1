# Builds the MathPad Android app (APK) into dist\. Run scripts\android-setup.ps1 once before the first build.
$ErrorActionPreference = 'Stop'
$env:JAVA_HOME = (Get-ChildItem 'C:\Program Files\Microsoft' -Directory -Filter 'jdk-21*' | Select-Object -First 1).FullName
$env:ANDROID_HOME = "$env:LOCALAPPDATA\Android\Sdk"
$root = (New-Object -ComObject Scripting.FileSystemObject).GetFolder((Split-Path $PSScriptRoot)).ShortPath  # 8.3 path: Gradle dislikes the 'ö' in the user folder
Set-Location $root
npm run android
if ($LASTEXITCODE) { throw 'Web dosyalari Android projesine kopyalanamadi' }
Set-Location "$root\android"
.\gradlew.bat assembleDebug --no-daemon
if ($LASTEXITCODE) { throw 'APK derlenemedi' }
$ver = (Get-Content "$root\package.json" -Raw | ConvertFrom-Json).version
New-Item -ItemType Directory -Force "$root\dist" | Out-Null
Copy-Item "$root\android\app\build\outputs\apk\debug\app-debug.apk" "$root\dist\MathPad-$ver.apk" -Force
Write-Host ''
Write-Host "Hazir: dist\MathPad-$ver.apk" -ForegroundColor Green
