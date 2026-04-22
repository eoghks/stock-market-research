# build_skill.ps1
# 실행: powershell -File scripts/build_skill.ps1
# 버전 업 후 .skill 파일을 자동으로 재생성합니다.

Add-Type -Assembly "System.IO.Compression"
Add-Type -Assembly "System.IO.Compression.FileSystem"

$skillDir   = Split-Path -Parent $PSScriptRoot   # stock-market-research/
$outputFile = Join-Path (Split-Path -Parent $skillDir) "stock-market-research.skill"

# 현재 버전 읽기
$pkg = Get-Content (Join-Path $PSScriptRoot "package.json") | ConvertFrom-Json
$version = $pkg.version

Write-Host "📦 stock-market-research v$version 패키징 중..."

if (Test-Path $outputFile) { Remove-Item $outputFile -Force }

$zip = [System.IO.Compression.ZipFile]::Open($outputFile, [System.IO.Compression.ZipArchiveMode]::Create)

$excludeDirs  = @("__pycache__", "node_modules", "evals")
$excludeFiles = @(".DS_Store")
$excludeExts  = @(".pyc")
$parentDir    = (Get-Item $skillDir).Parent.FullName

Get-ChildItem -Path $skillDir -Recurse -File | ForEach-Object {
    $file         = $_
    $relativePath = $file.FullName.Substring($parentDir.Length + 1).Replace("\", "/")
    $parts        = $relativePath -split "/"

    $skip = $false
    foreach ($part in $parts) {
        if ($excludeDirs -contains $part) { $skip = $true; break }
    }
    if ($excludeFiles -contains $file.Name)  { $skip = $true }
    if ($excludeExts  -contains $file.Extension) { $skip = $true }

    if (-not $skip) {
        $entry       = $zip.CreateEntry($relativePath, [System.IO.Compression.CompressionLevel]::Optimal)
        $entryStream = $entry.Open()
        $fileStream  = [System.IO.File]::OpenRead($file.FullName)
        $fileStream.CopyTo($entryStream)
        $fileStream.Close()
        $entryStream.Close()
    }
}

$zip.Dispose()

$sizeKB = [math]::Round((Get-Item $outputFile).Length / 1KB, 1)
Write-Host "✅ 완료: $outputFile ($sizeKB KB)"
Write-Host "   → Claude customize에서 이 파일을 등록하세요."
