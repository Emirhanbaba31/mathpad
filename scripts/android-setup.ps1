# One-time Android SDK setup for building the MathPad APK.
# Downloads Google's command-line tools if missing, then shows the SDK licenses (type y to accept) and installs the packages.
$ErrorActionPreference = 'Stop'
$env:JAVA_HOME = (Get-ChildItem 'C:\Program Files\Microsoft' -Directory -Filter 'jdk-21*' | Select-Object -First 1).FullName
$env:ANDROID_HOME = "$env:LOCALAPPDATA\Android\Sdk"
$sdkm = "$env:ANDROID_HOME\cmdline-tools\latest\bin\sdkmanager.bat"
if (-not (Test-Path $sdkm)) {
  Write-Host 'Android komut satiri araclari indiriliyor (yaklasik 150 MB)...'
  $zip = "$env:TEMP\mathpad-cmdline-tools.zip"
  $ProgressPreference = 'SilentlyContinue'
  Invoke-WebRequest 'https://dl.google.com/android/repository/commandlinetools-win-16111833_latest.zip' -OutFile $zip -UseBasicParsing
  $tmp = "$env:ANDROID_HOME\cmdline-tools\_x"
  New-Item -ItemType Directory -Force $tmp | Out-Null
  tar -xf $zip -C $tmp
  Move-Item "$tmp\cmdline-tools" "$env:ANDROID_HOME\cmdline-tools\latest"
  Remove-Item $tmp, $zip -Recurse -Force
}
& $sdkm --licenses
# the inner quotes keep cmd.exe from splitting the package names at ';'
& $sdkm 'platform-tools' '"platforms;android-36"' '"build-tools;36.0.0"'
Write-Host ''
Write-Host 'Android SDK hazir. Bu pencereyi kapatabilirsin.' -ForegroundColor Green
