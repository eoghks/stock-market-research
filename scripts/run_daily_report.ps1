# run_daily_report.ps1 — 증시 보고서 자동 실행 래퍼
#
# Windows 작업 스케줄러가 매일 이 스크립트를 실행합니다.
# Claude Code CLI를 비대화형 모드로 호출 → 스킬 전체 파이프라인 자동 실행
# (데이터 수집 → DOCX 생성 → PDF 변환 → SendGrid 이메일 발송)
#
# 직접 실행:
#   & ".\run_daily_report.ps1"
#
# 스케줄러 등록:
#   & ".\setup_scheduler.ps1"

$LogDir  = "C:\Users\zhfld\OneDrive\바탕 화면\ai\stock"
$LogFile = "$LogDir\schedule_log.txt"

if (-not (Test-Path $LogDir)) {
    New-Item $LogDir -ItemType Directory | Out-Null
}

function Log($msg) {
    $ts = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
    $line = "[$ts] $msg"
    Add-Content $LogFile $line
    Write-Host $line
}

Log "▶ 증시 보고서 자동 실행 시작"

# Claude Code CLI — -p: non-interactive 단일 프롬프트 모드
# claude 명령이 PATH에 있어야 합니다 (Claude Code 설치 시 자동 등록)
try {
    $output = claude -p "오늘 증시 조사해줘" 2>&1
    $output | ForEach-Object { Add-Content $LogFile "  $_" }
    Log "■ 완료"
} catch {
    Log "✗ 오류: $_"
    Log "  claude 명령을 찾을 수 없습니다. Claude Code가 설치되어 있는지 확인하세요."
    exit 1
}

Add-Content $LogFile ""   # 실행 구분용 빈 줄
