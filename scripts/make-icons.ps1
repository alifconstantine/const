Add-Type -AssemblyName System.Drawing

function Create-RoundedRectanglePath([float]$x, [float]$y, [float]$width, [float]$height, [float]$radius) {
    $path = New-Object System.Drawing.Drawing2D.GraphicsPath
    $diameter = $radius * 2
    $arc = New-Object System.Drawing.RectangleF($x, $y, $diameter, $diameter)
    
    # top-left
    $path.AddArc($arc, 180, 90)
    # top-right
    $arc.X = $x + $width - $diameter
    $path.AddArc($arc, 270, 90)
    # bottom-right
    $arc.Y = $y + $height - $diameter
    $path.AddArc($arc, 0, 90)
    # bottom-left
    $arc.X = $x
    $path.AddArc($arc, 90, 90)
    $path.CloseFigure()
    return $path
}

$buildDir = "d:\Code\Const\apps\learn\desktop\build"
$origFile = "$buildDir\icon-1024-circle-orig.png"

if (-not (Test-Path $origFile)) {
    Copy-Item "$buildDir\icon-1024.png" $origFile
}

$orig = [System.Drawing.Bitmap]::FromFile($origFile)
$target1024 = New-Object System.Drawing.Bitmap(1024, 1024, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
$g1024 = [System.Drawing.Graphics]::FromImage($target1024)
$g1024.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
$g1024.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
$g1024.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
$g1024.Clear([System.Drawing.Color]::Transparent)

# Inset 12px, radius 220px (22%)
$path1024 = Create-RoundedRectanglePath 12 12 1000 1000 220
$brush = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(255, 20, 20, 19))
$g1024.FillPath($brush, $path1024)
$g1024.SetClip($path1024)
$g1024.DrawImage($orig, 0, 0, 1024, 1024)
$g1024.Dispose()
$brush.Dispose()
$orig.Dispose()

$target1024.Save("$buildDir\icon-1024.png", [System.Drawing.Imaging.ImageFormat]::Png)
Write-Output "Generated icon-1024.png"

$target512 = New-Object System.Drawing.Bitmap(512, 512, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
$g512 = [System.Drawing.Graphics]::FromImage($target512)
$g512.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
$g512.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
$g512.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
$g512.Clear([System.Drawing.Color]::Transparent)
$g512.DrawImage($target1024, 0, 0, 512, 512)
$g512.Dispose()
$target512.Save("$buildDir\icon.png", [System.Drawing.Imaging.ImageFormat]::Png)
$target512.Dispose()
Write-Output "Generated icon.png"

$sizes = @(16, 24, 32, 48, 64, 128, 256)
$tempDir = "$buildDir\.ico_temp"
if (-not (Test-Path $tempDir)) {
    New-Item -ItemType Directory -Path $tempDir | Out-Null
}

foreach ($sz in $sizes) {
    $bmp = New-Object System.Drawing.Bitmap($sz, $sz, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
    $g = [System.Drawing.Graphics]::FromImage($bmp)
    $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
    $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
    $g.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
    $g.Clear([System.Drawing.Color]::Transparent)
    $g.DrawImage($target1024, 0, 0, $sz, $sz)
    $g.Dispose()
    $dest = "$tempDir\$sz.png"
    $bmp.Save($dest, [System.Drawing.Imaging.ImageFormat]::Png)
    $bmp.Dispose()
}

$target1024.Dispose()
Write-Output "Generated all temp size PNGs for ICO"
