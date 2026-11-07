$ErrorActionPreference = "Stop"
$root = Resolve-Path (Join-Path $PSScriptRoot "..")
$out = Join-Path $root "web"

if (Test-Path $out) {
  Remove-Item $out -Recurse -Force
}
New-Item -ItemType Directory -Path $out | Out-Null

Copy-Item (Join-Path $root "index.html") $out
Copy-Item (Join-Path $root "css") (Join-Path $out "css") -Recurse
Copy-Item (Join-Path $root "js") (Join-Path $out "js") -Recurse
Copy-Item (Join-Path $root "Assets") (Join-Path $out "Assets") -Recurse

$deploy = Join-Path $root "deploy"
if (Test-Path $deploy) {
  Copy-Item (Join-Path $deploy "*") $out -Force
}

$readme = @"
Pick-it — статическая веб-версия
================================

Загрузите ВСЁ содержимое этой папки на сервер в каталог сайта
(корень домена или подпапку). Точка входа: index.html

Структура на сервере:
  index.html
  css/game.css
  js/game.js
  Assets/...
"@
Set-Content -Path (Join-Path $out "README-UPLOAD.txt") -Value $readme -Encoding UTF8

Write-Host "OK: $out"
