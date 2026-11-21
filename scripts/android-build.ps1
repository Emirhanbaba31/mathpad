# Builds the signed MathPad Android app (APK) into dist\ for GitHub Releases.
# Run scripts\android-setup.ps1 once before the first build. The first run creates the signing key and asks you to pick a password.
$ErrorActionPreference = 'Stop'
$env:JAVA_HOME = (Get-ChildItem 'C:\Program Files\Microsoft' -Directory -Filter 'jdk-21*' | Select-Object -First 1).FullName
$env:ANDROID_HOME = "$env:LOCALAPPDATA\Android\Sdk"
$root = (New-Object -ComObject Scripting.FileSystemObject).GetFolder((Split-Path $PSScriptRoot)).ShortPath  # 8.3 path: Gradle dislikes the 'ö' in the user folder

# Signing key lives outside the repo. If it or its password is lost, phones can't update over the old app anymore, so keep a backup.
$keyDir = Join-Path ([Environment]::GetFolderPath('MyDocuments')) 'MathPad-imza'
$env:MP_KEYSTORE = Join-Path $keyDir 'mathpad-upload.jks'
$plain = { param($s) [Runtime.InteropServices.Marshal]::PtrToStringBSTR([Runtime.InteropServices.Marshal]::SecureStringToBSTR($s)) }
try {
  if (-not (Test-Path $env:MP_KEYSTORE)) {
    Write-Host "Ilk kez: imza anahtari olusturuluyor -> $env:MP_KEYSTORE" -ForegroundColor Cyan
    Write-Host 'En az 8 karakterli bir sifre sec ve bir yere not et (her derlemede sorulacak).'
    while ($true) {
      $a = & $plain (Read-Host 'Sifre' -AsSecureString)
      if ($a.Length -lt 8) { Write-Host "En az 8 karakter olmali (sen $($a.Length) yazdin). Tekrar dene." -ForegroundColor Yellow; continue }
      $b = & $plain (Read-Host 'Sifre (tekrar)' -AsSecureString)
      if ($a -eq $b) { break }
      Write-Host 'Iki sifre ayni degil. Bastan tekrar dene.' -ForegroundColor Yellow
    }
    New-Item -ItemType Directory -Force $keyDir | Out-Null
    $env:MP_KS_PASS = $a
    & "$env:JAVA_HOME\bin\keytool.exe" -genkeypair -keystore $env:MP_KEYSTORE -alias mathpad -keyalg RSA -keysize 4096 -validity 10000 -dname 'CN=MathPad' -storepass:env MP_KS_PASS -keypass:env MP_KS_PASS
    if ($LASTEXITCODE) { throw 'Anahtar olusturulamadi' }
    Write-Host "Anahtar hazir. $keyDir klasorunu yedekle (USB, Drive...)." -ForegroundColor Green
  } else {
    $test = { & "$env:JAVA_HOME\bin\keytool.exe" -list -keystore $env:MP_KEYSTORE -storepass:env MP_KS_PASS *> $null; -not $LASTEXITCODE }
    # remembered password: encrypted with Windows DPAPI, only this Windows account on this PC can decrypt it
    $saved = Join-Path $keyDir 'sifre.dpapi'
    $ok = $false
    if (Test-Path $saved) {
      try { $env:MP_KS_PASS = & $plain ((Get-Content $saved -Raw).Trim() | ConvertTo-SecureString); $ok = & $test } catch { $ok = $false }
      if ($ok) { Write-Host 'Kayitli sifre kullanildi.' -ForegroundColor DarkGray }
      else { Remove-Item $saved -Force; Write-Host 'Kayitli sifre gecersiz, yeniden sorulacak.' -ForegroundColor Yellow }
    }
    # check the password against the key before the build, so a typo costs a retry instead of a failed build
    for ($try = 1; -not $ok; $try++) {
      $sec = Read-Host 'Imza anahtari sifresi' -AsSecureString
      $env:MP_KS_PASS = & $plain $sec
      if (& $test) {
        if ((Read-Host 'Bu bilgisayarda hatirlansin mi? Bir daha sorulmaz (E/H)') -match '^[eEyY]') {
          $sec | ConvertFrom-SecureString | Set-Content $saved
          Write-Host "Hatirlandi. Unutturmak icin $saved dosyasini sil." -ForegroundColor Green
        }
        break
      }
      if ($try -ge 3) { throw 'Sifre 3 kez yanlis girildi' }
      Write-Host 'Sifre yanlis, tekrar dene.' -ForegroundColor Yellow
    }
  }

  Set-Location $root
  npm run android
  if ($LASTEXITCODE) { throw 'Web dosyalari Android projesine kopyalanamadi' }
  Set-Location "$root\android"
  .\gradlew.bat assembleRelease --no-daemon
  if ($LASTEXITCODE) { throw 'Derlenemedi (sifre yanlis olabilir)' }
  $ver = (Get-Content "$root\package.json" -Raw | ConvertFrom-Json).version
  New-Item -ItemType Directory -Force "$root\dist" | Out-Null
  Copy-Item "$root\android\app\build\outputs\apk\release\app-release.apk" "$root\dist\MathPad-$ver.apk" -Force
  Write-Host ''
  Write-Host "Hazir: dist\MathPad-$ver.apk" -ForegroundColor Green
} finally {
  Remove-Item Env:MP_KS_PASS -ErrorAction SilentlyContinue
}
