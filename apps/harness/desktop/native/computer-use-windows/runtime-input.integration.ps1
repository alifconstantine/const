param([switch]$RunInteractive)
$ErrorActionPreference = 'Stop'
if (-not $RunInteractive) {
    Write-Output 'Skipped: pass -RunInteractive to test real input in a dedicated temporary window.'
    exit 0
}
$testDir = Join-Path ([IO.Path]::GetTempPath()) ('const-input-test-' + [guid]::NewGuid())
[void][IO.Directory]::CreateDirectory($testDir)
$statePath = Join-Path $testDir 'state.json'
$operationPath = Join-Path $testDir 'handshake.json'
$fixtureProcess = $null
function Assert-Test($Value, [string]$Message) { if (-not $Value) { throw $Message } }
function Read-TestState { Get-Content -Raw -LiteralPath $statePath -Encoding UTF8 | ConvertFrom-Json }
function Wait-TestState([scriptblock]$Predicate, [string]$Message) {
    $deadline = [DateTime]::UtcNow.AddSeconds(3)
    do {
        try { $observed = Read-TestState; if (& $Predicate $observed) { return } } catch {}
        Start-Sleep -Milliseconds 50
    } while ([DateTime]::UtcNow -lt $deadline)
    throw ($Message + '; observed: ' + ($observed | ConvertTo-Json -Compress))
}
try {
    [IO.File]::WriteAllText($operationPath, '{"tool":"handshake"}')
    $handshake = . (Join-Path $PSScriptRoot 'runtime.ps1') -OperationPath $operationPath
    Assert-Test (($handshake | ConvertFrom-Json).ok) 'Native runtime did not compile/handshake'
    $fixturePath = Join-Path $PSScriptRoot 'input-fixture.ps1'
    $fixtureProcess = Start-Process -FilePath (Join-Path $PSHOME 'powershell.exe') -ArgumentList @('-NoProfile', '-STA', '-File', ('"' + $fixturePath + '"'), '-StatePath', ('"' + $statePath + '"')) -WindowStyle Hidden -PassThru
    $deadline = [DateTime]::UtcNow.AddSeconds(10)
    while (-not (Test-Path -LiteralPath $statePath) -and [DateTime]::UtcNow -lt $deadline) { Start-Sleep -Milliseconds 100 }
    Assert-Test (Test-Path -LiteralPath $statePath) 'Fixture window failed to start'
    $target = 'pid:' + (Read-TestState).pid
    $deadline = [DateTime]::UtcNow.AddSeconds(5)
    do {
        $state = Invoke-ConstOperation ([pscustomobject]@{ tool = 'get_app_state'; app = $target; restoreWindow = $true })
        $editor = $state.snapshot.elements | Where-Object { $_.name -eq 'Test input' -or $_.className -like '*EDIT*' } | Select-Object -First 1
        if ($null -ne $editor.frame) { break }
        Start-Sleep -Milliseconds 50
    } while ([DateTime]::UtcNow -lt $deadline)
    Assert-Test $state.ok 'Could not inspect fixture'
    Assert-Test ($null -ne $state.snapshot.screenshotPngBase64) 'No native screenshot returned'
    Assert-Test ($null -ne $editor.frame) ('Input field missing from accessibility tree: ' + ($state.snapshot.treeLines -join '|'))
    $click = Invoke-ConstOperation ([pscustomobject]@{ tool = 'click'; app = $target; restoreWindow = $true; x = $editor.frame.x + 20; y = $editor.frame.y + 20 })
    Assert-Test $click.ok 'Coordinate click failed'
    Wait-TestState { param($observed) $observed.focused -eq 'TestInput' -and $observed.clicks -eq 0 } ('Coordinate click did not focus the editor: ' + ($editor.frame | ConvertTo-Json -Compress))
    $unicode = 'Hai ' + [char]0x03a9 + ' ' + [char]::ConvertFromUtf32(0x1F60A) + ' +^%{}'
    $typed = Invoke-ConstOperation ([pscustomobject]@{ tool = 'type_text'; app = $target; restoreWindow = $true; text = $unicode })
    Assert-Test $typed.ok 'Unicode typing failed'
    Wait-TestState { param($observed) $observed.text -ceq $unicode } 'Typed Unicode text did not reach the fixture editor'
    [void](Invoke-ConstOperation ([pscustomobject]@{ tool = 'hotkey'; app = $target; restoreWindow = $true; key = 'Ctrl+A' }))
    [void](Invoke-ConstOperation ([pscustomobject]@{ tool = 'type_text'; app = $target; restoreWindow = $true; text = 'Replaced' }))
    Wait-TestState { param($observed) $observed.text -ceq 'Replaced' } 'Ctrl+A did not select the editor text'
    [void](Invoke-ConstOperation ([pscustomobject]@{ tool = 'paste_text'; app = $target; restoreWindow = $true; text = ' pasted' }))
    Wait-TestState { param($observed) $observed.text -ceq 'Replaced pasted' } 'Clipboard paste did not reach editor'
    [void](Invoke-ConstOperation ([pscustomobject]@{ tool = 'press_key'; app = $target; restoreWindow = $true; key = '!' }))
    Wait-TestState { param($observed) $observed.text -ceq 'Replaced pasted!' } 'Punctuation press_key did not type a literal character'
    $state = Invoke-ConstOperation ([pscustomobject]@{ tool = 'get_app_state'; app = $target; restoreWindow = $true })
    $button = $state.snapshot.elements | Where-Object { $_.name -eq 'Test click' } | Select-Object -First 1
    Assert-Test ($null -ne $button.frame) 'Test button missing'
    [void](Invoke-ConstOperation ([pscustomobject]@{ tool = 'click'; app = $target; restoreWindow = $true; x = $button.frame.x + 20; y = $button.frame.y + 15 }))
    Wait-TestState { param($observed) $observed.clicks -eq 1 } 'Physical mouse click did not activate button exactly once'
    $closed = Invoke-ConstOperation ([pscustomobject]@{ tool = 'hotkey'; app = $target; restoreWindow = $true; key = 'Alt+F4' })
    Assert-Test $closed.ok 'Alt+F4 delivery failed'
    Assert-Test ($fixtureProcess.WaitForExit(3000)) 'Alt+F4 did not close fixture'
    Assert-Test ($closed.action.verification.state -eq 'unverified') 'Post-close observation must remain unverified'
    Write-Output 'windows-input-integration-tests-ok: screenshot, coordinate click, Unicode, Ctrl+A, paste, physical button click, Alt+F4'
} finally {
    if ($null -ne $fixtureProcess -and -not $fixtureProcess.HasExited) { Stop-Process -InputObject $fixtureProcess -ErrorAction SilentlyContinue }
    foreach ($testFile in @($statePath, $operationPath)) { Remove-Item -LiteralPath $testFile -Force -ErrorAction SilentlyContinue }
    Remove-Item -LiteralPath $testDir -ErrorAction SilentlyContinue
}
