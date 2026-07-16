# kill-and-start.ps1
# Kills any process using ports 5001 and 5173, then starts the dev server.

Write-Host "Stopping processes on ports 5001 and 5173..." -ForegroundColor Yellow

foreach ($port in @(5001, 5173)) {
    $connections = netstat -ano | Select-String ":$port\s" | Select-String "LISTENING"
    foreach ($line in $connections) {
        $parts = $line -split '\s+' | Where-Object { $_ -ne '' }
        $procId = $parts[-1]
        if ($procId -match '^\d+$' -and $procId -ne '0') {
            try {
                Stop-Process -Id $procId -Force -ErrorAction Stop
                Write-Host "  Killed PID $procId on port $port" -ForegroundColor Green
            } catch {
                Write-Host "  Could not kill PID $procId (already gone)" -ForegroundColor DarkYellow
            }
        }
    }
}

Write-Host ""
Write-Host "Starting app (npm start)..." -ForegroundColor Cyan
npm start
