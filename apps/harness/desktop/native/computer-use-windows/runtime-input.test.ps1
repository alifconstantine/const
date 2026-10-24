$ErrorActionPreference = "Stop"
$tokens = $null
$parseErrors = $null
$ast = [System.Management.Automation.Language.Parser]::ParseFile((Join-Path $PSScriptRoot 'runtime.ps1'), [ref]$tokens, [ref]$parseErrors)
if ($parseErrors.Count -gt 0) { throw $parseErrors[0] }

# Stub native delivery so focus failures can be tested without touching the desktop.
Add-Type -TypeDefinition @"
using System;
public static class ConstDesktopWin32 {
    public static IntPtr Foreground = (IntPtr)100;
    public static bool CanFocus = false;
    public static int Deliveries;
    public static string Text;
    public static ushort LastKey;
    public static byte[] LastModifiers;
    public static IntPtr GetForegroundWindow() { return Foreground; }
    public static bool IsChild(IntPtr parent, IntPtr child) { return false; }
    public static uint GetWindowThreadProcessId(IntPtr handle, out uint pid) { pid = (uint)handle.ToInt64(); return pid + 10; }
    public static bool ForceForegroundWindow(IntPtr handle) { if (CanFocus) Foreground = handle; return CanFocus; }
    public static void SendKeyChord(byte[] modifiers, ushort key) { Deliveries++; LastKey = key; LastModifiers = modifiers; }
    public static void SendUnicodeText(string text) { Deliveries++; Text = text; }
    public static bool SetCursorPos(int x, int y) { return true; }
    public static short VkKeyScan(char character) {
        if (character == '!') return 0x131;
        if (character == '+') return 0x1bb;
        if (character == (char)96) return 0xc0;
        return (short)char.ToUpperInvariant(character);
    }
    public static void SendModifiedClick(byte[] modifiers, uint down, uint up) { Deliveries++; }
}
"@

foreach ($name in @('Test-ConstWindowFocused', 'Wait-ConstWindowFocused', 'Assert-ConstKeyboardFocus', 'Get-ConstVirtualKey', 'Get-ConstModifierVirtualKey', 'Get-ConstClickModifierVirtualKeys', 'Send-ConstKey', 'Send-ConstHotkey', 'Send-ConstText', 'Send-ConstMouseClick', 'Get-ConstRequiredNumber', 'Get-ConstPositiveInteger', 'Get-ConstScreenPoint')) {
    $function = $ast.Find({ param($node) $node -is [System.Management.Automation.Language.FunctionDefinitionAst] -and $node.Name -eq $name }, $true)
    if ($null -eq $function) { throw "Missing runtime function: $name" }
    Invoke-Expression $function.Extent.Text
}
$MouseEvents = @{ LeftDown = 2; LeftUp = 4; RightDown = 8; RightUp = 16; MiddleDown = 32; MiddleUp = 64 }
function Assert-Equal($Actual, $Expected, [string]$Label) { if ($Actual -cne $Expected) { throw "$Label expected '$Expected', received '$Actual'" } }
function Assert-Throws([scriptblock]$Action, [string]$Pattern) {
    try { & $Action } catch { if ($_.Exception.Message -like $Pattern) { return }; throw }
    throw "Expected failure: $Pattern"
}

$focus = @(Test-ConstWindowFocused ([IntPtr]200))
Assert-Equal $focus.Count 1 'focus returns one scalar'
Assert-Equal $focus[0] $false 'different foreground window is not focused'
Assert-Equal (Test-ConstWindowFocused ([IntPtr]0)) $false 'zero handle is not focused'
Assert-Throws { Send-ConstKey ([IntPtr]200) 'Return' } 'window_not_focused*'
Assert-Equal ([ConstDesktopWin32]::Deliveries) 0 'blocked input was not delivered'

[ConstDesktopWin32]::CanFocus = $true
Send-ConstHotkey ([IntPtr]200) 'Ctrl+F4'
Assert-Equal ([ConstDesktopWin32]::LastKey) 0x73 'F4 supported'
Assert-Equal ([ConstDesktopWin32]::LastModifiers -join ',') '17' 'Ctrl held'
Send-ConstHotkey ([IntPtr]200) 'Win+E'
Assert-Equal ([ConstDesktopWin32]::LastModifiers -join ',') '91' 'Windows key supported'
Assert-Equal (Get-ConstVirtualKey 'F1') 0x70 'F1 supported'
Assert-Equal (Get-ConstVirtualKey 'F24') 0x87 'F24 supported'
Assert-Throws { Get-ConstVirtualKey 'F25' } 'Unsupported key*'
Assert-Throws { Send-ConstHotkey ([IntPtr]200) 'Ctrl++F' } 'Unsupported key*'

$unicode = 'Hai ' + [char]0x03a9 + ' +^%{}'
Send-ConstText ([IntPtr]200) $unicode
Assert-Equal ([ConstDesktopWin32]::Text) $unicode 'literal Unicode delivery'
Assert-Equal (Get-ConstPositiveInteger $null 'count') 1 'default click count'
Assert-Throws { Get-ConstPositiveInteger 1.5 'count' } '*positive integer*'
Assert-Throws { Get-ConstPositiveInteger 0 'count' } '*positive integer*'
Send-ConstMouseClick ([IntPtr]200) 30 40 'left' 1 ''
Assert-Equal ([ConstDesktopWin32]::Deliveries) 4 'checked native clicks used without modifiers'
Send-ConstKey ([IntPtr]200) '!'
Assert-Equal ([ConstDesktopWin32]::Text) '!' 'punctuation is typed literally rather than interpreted as PageUp'
Send-ConstHotkey ([IntPtr]200) 'Ctrl+!'
Assert-Equal ([ConstDesktopWin32]::LastKey) 0x31 'punctuation shortcut uses keyboard layout mapping'
Assert-Equal ([ConstDesktopWin32]::LastModifiers -join ',') '17,16' 'punctuation includes implicit Shift'
Send-ConstHotkey ([IntPtr]200) 'Ctrl++'
Assert-Equal ([ConstDesktopWin32]::LastKey) 0xbb 'literal plus shortcut'
Send-ConstHotkey ([IntPtr]200) 'Ctrl+A'
Assert-Equal ([ConstDesktopWin32]::LastModifiers -join ',') '17' 'uppercase shortcut names do not imply Shift'

$bounds = [pscustomobject]@{ x = 100; y = 200; width = 800; height = 600 }
$point = Get-ConstScreenPoint ([pscustomobject]@{ x = 20; y = 30 }) $bounds
Assert-Equal $point.x 120 'window-local x'
Assert-Equal $point.y 230 'window-local y'
Assert-Throws { Get-ConstScreenPoint ([pscustomobject]@{ x = -1; y = 0 }) $bounds } 'invalid_coordinates*'
Assert-Throws { Get-ConstScreenPoint ([pscustomobject]@{ x = 800; y = 0 }) $bounds } 'invalid_coordinates*'
Write-Output 'windows-input-regression-tests-ok'
