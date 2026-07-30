$ErrorActionPreference = "Stop"

$portProcesses = Get-NetTCPConnection -LocalPort 3000 -ErrorAction SilentlyContinue |
  Select-Object -ExpandProperty OwningProcess -Unique

if ($portProcesses) {
  $portProcesses | ForEach-Object {
    Stop-Process -Id $_ -Force -ErrorAction SilentlyContinue
  }
  Start-Sleep -Seconds 2
}

if (Test-Path .next) {
  for ($attempt = 1; $attempt -le 5; $attempt++) {
    try {
      Remove-Item -Recurse -Force .next
      break
    } catch {
      if ($attempt -eq 5) {
        throw
      }
      Start-Sleep -Seconds 1
    }
  }
}

npx next dev
