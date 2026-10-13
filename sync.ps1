$src = 'C:\Users\akula\.gemini\antigravity-ide\scratch\nesty'
$dst = 'C:\Users\akula\Desktop\nesty-publish'

if (!(Test-Path $dst)) {
    New-Item -ItemType Directory -Path $dst -Force | Out-Null
}

# Root files
Copy-Item -Path "$src\package.json" -Destination "$dst\package.json" -Force
Copy-Item -Path "$src\package-lock.json" -Destination "$dst\package-lock.json" -Force
Copy-Item -Path "$src\render.yaml" -Destination "$dst\render.yaml" -Force
Copy-Item -Path "$src\Dockerfile" -Destination "$dst\Dockerfile" -Force
Copy-Item -Path "$src\index.html" -Destination "$dst\index.html" -Force
if (Test-Path "$src\.gitignore") {
    Copy-Item -Path "$src\.gitignore" -Destination "$dst\.gitignore" -Force
}

# Directories: public, dist, server, src
if (Test-Path "$src\public") {
    Copy-Item -Path "$src\public" -Destination "$dst" -Recurse -Force
}
if (Test-Path "$src\dist") {
    Copy-Item -Path "$src\dist" -Destination "$dst" -Recurse -Force
}
if (Test-Path "$src\server") {
    Copy-Item -Path "$src\server" -Destination "$dst" -Recurse -Force
}
if (Test-Path "$src\src") {
    Copy-Item -Path "$src\src" -Destination "$dst" -Recurse -Force
}

Write-Output "Full project synced successfully from $src to $dst"
