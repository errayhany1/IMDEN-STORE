# Builds a signed release AAB using Android Studio's bundled JDK 21.
$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot
$jbr = 'C:\Program Files\Android\Android Studio\jbr'
if (-not (Test-Path "$jbr\bin\java.exe")) {
  Write-Error "Android Studio JBR (Java 21) not found at $jbr"
}
$env:JAVA_HOME = $jbr
$env:PATH = "$jbr\bin;" + $env:PATH
Set-Location $root
npm run android:release
Set-Location (Join-Path $root 'android')
.\gradlew.bat bundleRelease
$aab = Join-Path $root 'android\app\build\outputs\bundle\release\app-release.aab'
Write-Host "AAB ready: $aab"
