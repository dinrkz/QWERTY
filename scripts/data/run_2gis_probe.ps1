param(
    [Parameter(Mandatory = $true)]
    [string]$Python,
    [ValidatePattern('^[0-9a-f]{64}$')]
    [string]$RecoverAnchorStop
)

# Run in a separate local console:
$ErrorActionPreference = 'Stop'
$probe = Join-Path $PSScriptRoot 'probe_2gis.py'
if (-not (Test-Path -LiteralPath $Python -PathType Leaf)) {
    throw 'Python executable not found.'
}

$probeArguments = @('--live', '--transient-use-permitted', '--approved-plan')
if ($RecoverAnchorStop) {
    $probeArguments += 'bc21a1607f818ef46d6dabff3f7ecb0cd3f0b7c313ca3304642523e3c12fff20'
    $probeArguments += @('--recover-anchor-stop', $RecoverAnchorStop)
    Write-Host 'Approved recovery: first attempt remains counted; at most 9 more attempts.'
    Write-Host 'The mall lookup repeats; optional second-page query is omitted. No automatic retries.'
} else {
    $probeArguments += '198208620c72501ddd9da68627f19cd65e2f7b74a954dd868f33b61d131c1ce6'
    Write-Host 'Approved probe: at most 10 attempts, no retries.'
}
Write-Host 'Have your 2GIS key ready. Check account usage before starting.'
Write-Host 'Do not record this console or paste the key into chat.'
Write-Host 'The next prompt hides the key. Review the mall and landmark when asked.'
Write-Host 'For a numbered candidate, TYPE its number (e.g. 1), then Enter. Blank means STOP.'
Write-Host 'Then type mall or landmark as requested; later type CONTINUE to proceed.'
$ready = Read-Host 'Press Enter when ready, or type STOP to exit before creating the ledger'
if ($ready -ne '') { return }

& $Python $probe @probeArguments
Write-Host "Probe exit code: $LASTEXITCODE. Do not rerun or delete its ledger."
Write-Host 'Tell the agent when finished; it can read the aggregate report locally.'
