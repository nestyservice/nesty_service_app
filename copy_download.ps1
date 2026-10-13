$zipSrc = 'C:\Users\akula\Desktop\nesty_all_code.zip'
$downloadFolder = 'C:\Users\akula\Downloads'
$artifactFolder = 'C:\Users\akula\.gemini\antigravity-ide\brain\5b7fdd81-aa93-4b8d-b4a4-5f0e9ea29194'

if (Test-Path $downloadFolder) {
    Copy-Item -Path $zipSrc -Destination "$downloadFolder\nesty_all_code.zip" -Force
    Write-Output "Copied to Downloads folder: $downloadFolder\nesty_all_code.zip"
}

Copy-Item -Path $zipSrc -Destination "$artifactFolder\nesty_all_code.zip" -Force
Write-Output "Copied to Artifacts folder: $artifactFolder\nesty_all_code.zip"

Get-Item "$zipSrc", "$downloadFolder\nesty_all_code.zip", "$artifactFolder\nesty_all_code.zip" | Select-Object FullName, Length
