# Runs the complete backend suite three times consecutively and records
# exit code, duration and vitest summary lines for each run.
$summary = Join-Path $PSScriptRoot '..\test-runs-summary.txt'
if (Test-Path $summary) { Remove-Item $summary }

foreach ($i in 1..3) {
  $log = Join-Path $PSScriptRoot "..\test-run-$i.log"
  $start = Get-Date
  npm --prefix (Join-Path $PSScriptRoot '..') test *> $log
  $code = $LASTEXITCODE
  $secs = [int]((Get-Date) - $start).TotalSeconds
  $lines = Select-String -Path $log -Pattern 'Test Files|Tests  ' | ForEach-Object { $_.Line.Trim() }
  "RUN $i exit=$code duration=${secs}s | $($lines -join ' | ')" | Out-File -Append $summary
}
"DONE" | Out-File -Append $summary

