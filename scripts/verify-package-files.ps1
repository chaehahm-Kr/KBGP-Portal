Add-Type -AssemblyName System.Drawing

$packageDir = "Manuals\MAN-B-REG-001_Regulatory-Compliance\02_CLAUDE_PACKAGE"
$root = "C:\Users\ChaeHahm\OneDrive - Letusto Inc\Developement\Claude_Dev\KSelectNetwork-Portal"

Write-Host "=== PHYSICAL FILE VERIFICATION ==="
Get-ChildItem -Path $packageDir -Recurse | Where-Object { -not $_.PSIsContainer } | ForEach-Object {
    $rel = $_.FullName.Replace($root + "\", "")
    $hash = (Get-FileHash -Path $_.FullName -Algorithm SHA256).Hash.Substring(0, 16)
    
    if ($_.Extension -eq ".png") {
        $img = [System.Drawing.Image]::FromFile($_.FullName)
        $w = $img.Width
        $h = $img.Height
        $img.Dispose()
        Write-Host ("PNG | {0} | Exists:{1} | {2} bytes | {3}x{4} | SHA256:{5}" -f $rel, $_.Exists, $_.Length, $w, $h, $hash)
    } else {
        $lines = Get-Content $_.FullName
        $firstLine = ($lines | Where-Object { $_ -match "^#+" } | Select-Object -First 1)
        if ($firstLine -is [System.Array]) { $firstLine = $firstLine[0] }
        Write-Host ("MD  | {0} | Exists:{1} | {2} bytes | FirstLine: {3} | SHA256:{4}" -f $rel, $_.Exists, $_.Length, $firstLine, $hash)
    }
}
