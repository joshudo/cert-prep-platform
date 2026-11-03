# Checks every URL in data/sources.js. Run: powershell -ExecutionPolicy Bypass -File tools/check-links.ps1
$root = Split-Path -Parent $PSScriptRoot
$text = Get-Content (Join-Path $root 'data/sources.js') -Raw
$prefix = 'https://learn.microsoft.com/en-us/'
$failed = 0
foreach ($m in [regex]::Matches($text, "(\w+):\s*(?:L \+ )?'([^']+)'")) {
  $key = $m.Groups[1].Value
  $val = $m.Groups[2].Value
  if ($key -in @('d', 'old', 'id', 'name', 'range')) { continue }
  if ($val -notmatch '^https?://' -and $m.Value -notmatch 'L \+') { continue }
  $url = if ($m.Value -match 'L \+') { $prefix + $val } else { $val }
  try {
    $r = Invoke-WebRequest -Uri $url -UseBasicParsing -Method Get -MaximumRedirection 5 -TimeoutSec 30
    if ($r.StatusCode -ne 200) { Write-Output "FAIL $($r.StatusCode) $key $url"; $failed++ }
  } catch {
    $code = if ($_.Exception.Response) { [int]$_.Exception.Response.StatusCode } else { 'ERR' }
    Write-Output "FAIL $code $key $url"; $failed++
  }
}
Write-Output "Done. Failed: $failed"
