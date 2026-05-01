# setup_scheduler.ps1 — Windows 작업 스케줄러 등록
#
# 한 번만 실행하면 매일 자동으로 증시 보고서가 생성·발송됩니다.
# 관리자 권한 불필요 (현재 사용자 범위로 등록).
#
# 실행:
#   & ".\setup_scheduler.ps1"
#
# 등록 확인:
#   Get-ScheduledTask -TaskName "증시보고서_자동생성"
#
# 즉시 테스트 실행:
#   Start-ScheduledTask -TaskName "증시보고서_자동생성"
#
# 등록 삭제:
#   Unregister-ScheduledTask -TaskName "증시보고서_자동생성" -Confirm:$false

$TaskName   = "증시보고서_자동생성"
$ScriptPath = "C:\Users\zhfld\OneDrive\바탕 화면\ai\claude\stock-market-research\scripts\run_daily_report.ps1"
$RunAt      = "18:30"   # KST 18:30 — 한국 장 마감(15:30) 후 3시간, 미국 장 개장 전

# 스크립트 존재 확인
if (-not (Test-Path $ScriptPath)) {
    Write-Host "❌ 스크립트를 찾을 수 없습니다: $ScriptPath" -ForegroundColor Red
    exit 1
}

$action = New-ScheduledTaskAction `
    -Execute  "powershell.exe" `
    -Argument "-NonInteractive -ExecutionPolicy Bypass -File `"$ScriptPath`""

$trigger = New-ScheduledTaskTrigger -Daily -At $RunAt

$settings = New-ScheduledTaskSettingsSet `
    -ExecutionTimeLimit (New-TimeSpan -Minutes 30) `
    -StartWhenAvailable `       # PC가 꺼져 있다가 켜졌을 때 놓친 실행 자동 재시도
    -MultipleInstances IgnoreNew  # 중복 실행 방지

Register-ScheduledTask `
    -TaskName   $TaskName `
    -Action     $action `
    -Trigger    $trigger `
    -Settings   $settings `
    -RunLevel   Limited `       # 관리자 권한 불필요
    -Force                      # 이미 등록돼 있으면 덮어씀

Write-Host ""
Write-Host "✅ 작업 스케줄러 등록 완료!" -ForegroundColor Green
Write-Host "   작업 이름: $TaskName"
Write-Host "   실행 시각: 매일 $RunAt KST"
Write-Host "   스크립트:  $ScriptPath"
Write-Host ""
Write-Host "지금 바로 테스트하려면:" -ForegroundColor Cyan
Write-Host "   Start-ScheduledTask -TaskName `"$TaskName`""
