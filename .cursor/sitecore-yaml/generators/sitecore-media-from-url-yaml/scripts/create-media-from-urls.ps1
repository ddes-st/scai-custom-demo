# Creates Sitecore media library YAML items from image URLs.
param(
    [Parameter(Mandatory = $true)][string]$MediaRoot,
    [Parameter(Mandatory = $true)][string]$SiteMediaPath,
    [Parameter(Mandatory = $true)][string]$SiteRootItemId,
    [Parameter(Mandatory = $true)][hashtable[]]$Assets,
    # Origin for resolving relative/root-relative URLs (e.g. capture source URL or source-url.txt).
    [string]$BaseUrl = ''
)

$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Drawing

$MediaFolderTemplate = 'fe5dd826-48c6-436d-b87a-7c4210c7413b'
$MediaFileTemplate = 'f1828a2c-7e5d-4bbd-98ca-320474871548'

function Resolve-AssetUrl([string]$url, [string]$baseUrl) {
    if ($url -match '^https?://') { return $url }
    if ($url -match '^//') { return "https:$url" }
    if (-not $baseUrl) { throw "BaseUrl required for relative URL: $url" }
    $base = $baseUrl.TrimEnd('/')
    if ($url.StartsWith('/')) { return "$base$url" }
    return "$base/$url"
}

function Get-DownloadUrl([string]$url) {
    $u = $url -replace '&amp;', '&'
    # CDN query params may return AVIF/WebP while the path extension stays .jpg/.png.
    $u = $u -replace '([?&])savif=1(&|$)', '$1' -replace '([?&])swebp=1(&|$)', '$1'
    $u = $u -replace '\?&', '?' -replace '[?&]$', ''
    return $u
}

function Get-DecodedPath([string]$url) {
    $uri = [Uri]$url
    $path = [Uri]::UnescapeDataString($uri.AbsolutePath.TrimStart('/'))
    # Sitecore CDN: https://{host}/-/media/{library-path}/file.ext
    # After TrimStart('/') the path is -/media/... — strip prefix so folders do not start with "-".
    if ($path -match '^-/media/(.+)$') {
        return $Matches[1]
    }
    # XM Cloud edge CDN: {tenant}/media/project/{package}/rest → rest (stable under site media root).
    # Scrapers often unwrap raicdn wrappers to edge.sitecorecloud.io URLs with a long tenant prefix.
    if ($uri.Host -match '(?i)edge\.sitecorecloud\.io$' -and $path -match '^[^/]+/media/project/[^/]+/(.+)$') {
        return $Matches[1]
    }
    # Static / absolute CDN paths (no /-/media/ prefix): use URI path segments as-is.
    # e.g. https://cdn.example.com/assets/images/hero.jpg → assets/images/hero.jpg
    return $path
}

function Split-MediaPath([string]$decodedPath) {
    $segments = $decodedPath -split '/'
    $last = $segments[-1]
    if ($last -match '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$') {
        $fileSegment = $segments[-2]
        $folderSegments = $segments[0..($segments.Length - 3)]
    }
    else {
        $fileSegment = $segments[-1]
        $folderSegments = $segments[0..($segments.Length - 2)]
    }
    $ext = [System.IO.Path]::GetExtension($fileSegment)
    $itemName = [System.IO.Path]::GetFileNameWithoutExtension($fileSegment)
    return @{ FolderSegments = $folderSegments; ItemName = $itemName; Extension = $ext.TrimStart('.').ToLower() }
}

function Get-MimeType([string]$ext) {
    switch ($ext) {
        'svg' { 'image/svg+xml' }
        'png' { 'image/png' }
        'jpg' { 'image/jpeg' }
        'jpeg' { 'image/jpeg' }
        default { 'application/octet-stream' }
    }
}

function Get-ImageDimensions([byte[]]$bytes, [string]$ext) {
    if ($ext -eq 'svg') {
        $text = [Text.Encoding]::UTF8.GetString($bytes)
        if ($text -match 'viewBox="\s*[\d.]+\s+[\d.]+\s+([\d.]+)\s+([\d.]+)\s*"') {
            return @{ Width = [int][double]$Matches[1]; Height = [int][double]$Matches[2] }
        }
        if ($text -match 'width="([\d.]+)"[^>]*height="([\d.]+)"') {
            return @{ Width = [int][double]$Matches[1]; Height = [int][double]$Matches[2] }
        }
        return @{ Width = 60; Height = 60 }
    }
    $ms = New-Object IO.MemoryStream(,$bytes)
    try {
        $img = [System.Drawing.Image]::FromStream($ms)
        try { return @{ Width = $img.Width; Height = $img.Height } }
        finally { $img.Dispose() }
    }
    catch {
        return @{ Width = 1920; Height = 1080 }
    }
    finally { $ms.Dispose() }
}

function Read-YmlId([string]$path) {
    $content = Get-Content -Raw $path
    if ($content -match '(?m)^ID:\s*"([^"]+)"') { return $Matches[1] }
    throw "Cannot read ID from $path"
}

function Get-MediaLibraryRoot {
    # serialized-content/media-library (parent of {collection}/{site} MediaRoot).
    return Split-Path (Split-Path $MediaRoot -Parent) -Parent
}

function Find-YmlBySitecorePath([string]$sitecoreItemPath, [string]$templateId) {
    # Folder and file items may live in path-segment trees or hash folders after validate --fix.
    # Always match on Sitecore Path:, never on disk folder layout alone.
    $mediaLibraryRoot = Get-MediaLibraryRoot
    $escapedPath = [regex]::Escape($sitecoreItemPath)
    $pattern = "(?m)^Path:\s*`"$escapedPath`""
    foreach ($file in Get-ChildItem -Path $mediaLibraryRoot -Recurse -Filter '*.yml' -File) {
        $content = Get-Content -Raw $file.FullName
        if ($content -match $pattern -and $content -match "(?m)^Template:\s*`"$templateId`"") {
            return $file
        }
    }
    return $null
}

function Find-ExistingMediaByPath([string]$sitecoreItemPath) {
    return Find-YmlBySitecorePath $sitecoreItemPath $MediaFileTemplate
}

function Find-ExistingFolderByPath([string]$sitecoreFolderPath) {
    return Find-YmlBySitecorePath $sitecoreFolderPath $MediaFolderTemplate
}

function Get-FolderChildDiskPath([string]$folderYmlPath) {
    $folderDir = Split-Path $folderYmlPath -Parent
    $segName = [System.IO.Path]::GetFileNameWithoutExtension($folderYmlPath)
    return Join-Path $folderDir $segName
}

function Ensure-Folder([string[]]$segments, [string]$parentId) {
    $diskPath = $MediaRoot
    $sitecorePath = $SiteMediaPath
    $currentParent = $parentId
    foreach ($seg in $segments) {
        $sitecorePath = "$sitecorePath/$seg"
        $folderYml = Join-Path $diskPath "$seg.yml"
        $existingFolder = Find-ExistingFolderByPath $sitecorePath

        if ($existingFolder) {
            $id = Read-YmlId $existingFolder.FullName
            $diskPath = Get-FolderChildDiskPath $existingFolder.FullName
            Write-Host "Reusing existing folder: $sitecorePath ($($existingFolder.FullName))"
        }
        elseif (-not (Test-Path $folderYml)) {
            $id = [guid]::NewGuid().ToString().ToLower()
            $yaml = @"
---
ID: "$id"
Parent: "$currentParent"
Template: "$MediaFolderTemplate"
Path: "$sitecorePath"
Languages:
- Language: en
  Versions:
  - Version: 1
"@
            Set-Content -Path $folderYml -Value $yaml -Encoding utf8 -NoNewline
            $diskPath = Join-Path $diskPath $seg
        }
        else {
            $id = Read-YmlId $folderYml
            $diskPath = Join-Path $diskPath $seg
        }

        if (-not (Test-Path $diskPath)) { New-Item -ItemType Directory -Path $diskPath -Force | Out-Null }
        $currentParent = $id
    }
    return @{ ParentId = $currentParent; DiskPath = $diskPath; SitecorePath = $sitecorePath }
}

function New-MediaItem([string]$url, [string]$alt, [string]$baseUrl) {
    $resolvedUrl = Resolve-AssetUrl $url $baseUrl
    $decoded = Get-DecodedPath $resolvedUrl
    $parts = Split-MediaPath $decoded
    $folder = Ensure-Folder $parts.FolderSegments $SiteRootItemId
    $ymlPath = Join-Path $folder.DiskPath ($parts.ItemName + '.yml')
    $sitecoreItemPath = "$($folder.SitecorePath)/$($parts.ItemName)"

    $existing = Find-ExistingMediaByPath $sitecoreItemPath
    if ($existing) {
        Write-Host "Reusing existing media: $sitecoreItemPath ($($existing.FullName))"
        return @{ Url = $url; ResolvedUrl = $resolvedUrl; MediaId = (Read-YmlId $existing.FullName); Path = $existing.FullName; Skipped = $true }
    }

    if (Test-Path $ymlPath) {
        Write-Host "Reusing existing media: $sitecoreItemPath ($ymlPath)"
        return @{ Url = $url; ResolvedUrl = $resolvedUrl; MediaId = (Read-YmlId $ymlPath); Path = $ymlPath; Skipped = $true }
    }

    Write-Host "Downloading $resolvedUrl"
    $downloadUrl = Get-DownloadUrl $resolvedUrl
    $bytes = (New-Object System.Net.WebClient).DownloadData($downloadUrl)
    $b64 = [Convert]::ToBase64String($bytes)
    $dims = Get-ImageDimensions $bytes $parts.Extension
    $mime = Get-MimeType $parts.Extension
    $size = $bytes.Length
    $id = [guid]::NewGuid().ToString().ToLower()
    $blobId = [guid]::NewGuid().ToString().ToLower()
    $altEscaped = $alt -replace '"', '\"'

    $yaml = @"
---
ID: "$id"
Parent: "$($folder.ParentId)"
Template: "$MediaFileTemplate"
Path: "$sitecoreItemPath"
SharedFields:
- ID: "22eac599-f13b-4607-a89d-c091763a467d"
  Hint: Width
  Value: $($dims.Width)
- ID: "40e50ed9-ba07-4702-992e-a912738d32dc"
  Hint: Blob
  BlobID: "$blobId"
  Value: $b64
- ID: "6954b7c7-2487-423f-8600-436cb3b6dc0e"
  Hint: Size
  Value: $size
- ID: "6f47a0a5-9c94-4b48-abeb-42d38def6054"
  Hint: Mime Type
  Value: $mime
- ID: "c06867fe-9a43-4c7d-b739-48780492d06f"
  Hint: Extension
  Value: $($parts.Extension)
- ID: "cb09946f-3218-4823-87d2-d5007c199a96"
  Hint: Dimensions
  Value: $($dims.Width) x $($dims.Height)
- ID: "de2ca9e4-c117-4c8a-a139-1ff4b199d15a"
  Hint: Height
  Value: $($dims.Height)
Languages:
- Language: en
  Versions:
  - Version: 1
    Fields:
    - ID: "65885c44-8fcd-4a7f-94f1-ee63703fe193"
      Hint: Alt
      Value: "$altEscaped"
"@

    Set-Content -Path $ymlPath -Value $yaml -Encoding utf8 -NoNewline
    return @{ Url = $url; MediaId = $id; Path = $ymlPath; Skipped = $false }
}

$results = @()
if (-not (Test-Path $MediaRoot)) {
    New-Item -ItemType Directory -Path $MediaRoot -Force | Out-Null
}
foreach ($asset in $Assets) {
    $results += New-MediaItem -url $asset.Url -alt $asset.Alt -baseUrl $BaseUrl
}
$results | ConvertTo-Json -Depth 3
