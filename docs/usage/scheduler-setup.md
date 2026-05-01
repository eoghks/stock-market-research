# Windows 작업 스케줄러 자동화 설정

매일 정해진 시각에 로컬 PC에서 자동으로 증시 보고서를 생성하고 이메일을 발송합니다.

## 배경 — Cowork vs 로컬

| 환경 | 데이터 수집 | 이메일 발송 |
|---|---|---|
| **로컬 PC** (Windows) | ✅ | ✅ SendGrid API |
| **Cowork** | ✅ | ❌ 외부 인터넷 완전 차단 |

Cowork 샌드박스는 DNS 조회 자체가 불가하여 어떤 방식으로도 외부 이메일 서버에 연결할 수 없습니다.
→ **로컬 PC에서 Windows 작업 스케줄러로 자동화**하는 것이 권장 방식입니다.

## 사전 조건

1. **Claude Code** 설치 및 `claude` 명령이 PATH에 등록되어 있을 것
2. **`config/email_config.json`** 설정 완료 (SendGrid API 키 포함)
3. **LibreOffice** 설치 (PDF 변환용)
4. PC가 매일 18:30 KST 전후로 켜져 있을 것 (꺼져 있어도 `StartWhenAvailable`로 나중에 자동 실행)

## 설치 (1회만)

```powershell
cd "C:\Users\zhfld\OneDrive\바탕 화면\ai\claude\stock-market-research\scripts"
& ".\setup_scheduler.ps1"
```

완료 후 매일 **18:30 KST** 자동 실행됩니다.

## 실행 시각 변경

`setup_scheduler.ps1` 내 `$RunAt` 값을 수정한 뒤 재실행:

```powershell
$RunAt = "19:00"   # 예: 19:00 KST로 변경
```

## 수동 테스트

```powershell
# 지금 바로 실행
Start-ScheduledTask -TaskName "증시보고서_자동생성"

# 실행 로그 확인
Get-Content "C:\Users\zhfld\OneDrive\바탕 화면\ai\stock\schedule_log.txt" -Tail 30
```

## 등록 확인 / 삭제

```powershell
# 등록 확인
Get-ScheduledTask -TaskName "증시보고서_자동생성"

# 삭제
Unregister-ScheduledTask -TaskName "증시보고서_자동생성" -Confirm:$false
```

## 파이프라인 흐름

```
Windows 작업 스케줄러 (18:30 KST)
  └─▶ run_daily_report.ps1
        └─▶ claude -p "오늘 증시 조사해줘"
              ├─▶ 서브에이전트 A: Yahoo Finance API + WebFetch (데이터 수집)
              ├─▶ 서브에이전트 B: 네이버 MCP (보완)
              ├─▶ node generate_report.js → 증시 조사-YYYYMMDD-HHMM.docx
              ├─▶ node convert_to_pdf.js  → 증시 조사-YYYYMMDD-HHMM.pdf
              ├─▶ SendGrid API → zhfldk7316@naver.com (PDF 첨부)
              └─▶ 카카오톡 MCP → 요약 메시지
```
