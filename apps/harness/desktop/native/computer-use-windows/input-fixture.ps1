param([Parameter(Mandatory = $true)][string]$StatePath)
$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Windows.Forms
$form = New-Object System.Windows.Forms.Form
$form.Text = 'Const Computer Use Input Test'
$form.Size = New-Object System.Drawing.Size(600, 300)
$form.StartPosition = 'CenterScreen'
$editor = New-Object System.Windows.Forms.RichTextBox
$editor.AccessibleName = 'Test input'
$editor.Name = 'TestInput'
$editor.Multiline = $true
$editor.SetBounds(20, 20, 540, 140)
$button = New-Object System.Windows.Forms.Button
$button.Text = 'Test click'
$button.AccessibleName = 'Test click'
$button.Name = 'TestButton'
$button.SetBounds(20, 180, 140, 40)
$script:clicks = 0
function Save-TestState {
    $state = @{ text = $editor.Text; clicks = $script:clicks; pid = $PID; handle = $form.Handle.ToInt64(); focused = $form.ActiveControl.Name }
    [IO.File]::WriteAllText($StatePath, ($state | ConvertTo-Json -Compress), (New-Object System.Text.UTF8Encoding($false)))
}
$editor.Add_TextChanged({ Save-TestState })
$button.Add_Click({ $script:clicks++; Save-TestState })
$editor.Add_GotFocus({ Save-TestState })
$button.Add_GotFocus({ Save-TestState })
$form.Controls.Add($editor)
$form.Controls.Add($button)
$form.Add_Shown({ $form.Hide(); $form.Show(); $editor.Focus(); Save-TestState })
[System.Windows.Forms.Application]::Run($form)
$form.Dispose()
