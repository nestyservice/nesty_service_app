$src = 'C:\Users\akula\Desktop\nesty-publish'
$dest = 'C:\Users\akula\Desktop\nesty_all_code'
$zip = 'C:\Users\akula\Desktop\nesty_all_code.zip'

if (Test-Path $dest) {
    Remove-Item -Path $dest -Recurse -Force
}
if (Test-Path $zip) {
    Remove-Item -Path $zip -Force
}

New-Item -ItemType Directory -Path $dest -Force | Out-Null

# Copy all project files except node_modules, .git, and dist
Get-ChildItem -Path $src -Exclude 'node_modules', '.git' | ForEach-Object {
    Copy-Item -Path $_.FullName -Destination $dest -Recurse -Force
}

# If node_modules or .git got copied inside subfolders, clean them
if (Test-Path "$dest\node_modules") {
    Remove-Item -Path "$dest\node_modules" -Recurse -Force
}
if (Test-Path "$dest\.git") {
    Remove-Item -Path "$dest\.git" -Recurse -Force
}

# Create a zip archive for one-click downloading or moving
Compress-Archive -Path "$dest\*" -DestinationPath $zip -Force

Write-Output "Successfully created $dest and $zip"
