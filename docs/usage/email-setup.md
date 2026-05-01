# 이메일 발송 설정 가이드

SendGrid API를 이용해 증시 보고서(PDF)를 자동으로 이메일로 받아볼 수 있습니다.

## 이메일 정책 — 3가지 시나리오

| 시나리오 | 이메일 발송 | 설명 |
|---|---|---|
| **① Cowork (skill 호출)** | ❌ skip | 샌드박스 외부 인터넷 완전 차단(DNS 불가). 자동 감지 후 skip. 카카오톡으로 요약 수신. |
| **② 로컬 Windows 직접 실행** | ✅ 자동 발송 | `config/email_config.json` 설정 시 SendGrid API로 PDF 첨부 발송 |
| **③ Windows 작업 스케줄러** | ✅ 자동 발송 | `scripts/run_daily_report.ps1`을 통해 매일 19:30 KST 무인 실행 + 발송 |

> `generate_report.js`가 `process.platform`을 확인해 Linux(Cowork)이면 자동 skip,  
> Windows이면 `config/email_config.json` 유무를 확인 후 SendGrid 발송을 시도합니다.

---

## 사전 조건

1. **SendGrid 계정**: [sendgrid.com](https://sendgrid.com) 가입 후 API 키 발급
2. **발신 이메일 인증**: SendGrid에서 발신 주소(Sender Authentication) 등록 필요
3. **LibreOffice 설치**: PDF 첨부 발송 필수 — [pdf-setup.md](pdf-setup.md) 참조

---

## 설정 파일 작성

`config/email_config.json` 생성 (템플릿: `config/email_config.example.json`):

```json
{
  "provider": "sendgrid",
  "sendgrid": {
    "api_key": "SG.xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
  },
  "from": "your-verified-sender@gmail.com",
  "to": "recipient@naver.com",
  "subject_prefix": "[증시 보고서]"
}
```

| 필드 | 설명 |
|---|---|
| `api_key` | SendGrid API 키 (SG. 으로 시작) |
| `from` | SendGrid에서 인증한 발신자 이메일 |
| `to` | 수신자 이메일 |
| `subject_prefix` | 제목 앞에 붙는 접두사 (기본: `[증시 보고서]`) |

> ⚠️ **보안 주의:** `config/email_config.json`은 `.gitignore`에 등록되어 있습니다.  
> 절대 git에 커밋하거나 공개 저장소에 업로드하지 마세요.

---

## 시나리오 ② 로컬 직접 실행

Claude Code에서 직접 실행할 때:

```
증시 조사해줘
```

보고서 생성 후 `generate_report.js`가 자동으로:
1. `config/email_config.json` 확인
2. PDF 파일 확인 (LibreOffice 필요)
3. SendGrid API로 PDF 첨부 발송
4. 발송 성공 시 DOCX·PDF 파일 자동 삭제

콘솔 출력 예시:
```
📧 이메일 발송 완료 → zhfldk7316@naver.com | 제목: [증시 보고서] 2026-05-01 증시 보고서
🗑️  삭제: 증시 조사-20260501-1930.pdf
🗑️  삭제: 증시 조사-20260501-1930.docx
```

---

## 시나리오 ③ Windows 작업 스케줄러 자동 실행

매일 정해진 시각에 자동으로 보고서 생성 + 이메일 발송:

```powershell
cd scripts
& ".\setup_scheduler.ps1"   # 1회만 실행
```

→ 매일 **19:30 KST** 자동 실행. 설치 가이드: [scheduler-setup.md](scheduler-setup.md)

---

## 발송 실패 시 확인 사항

| 증상 | 원인 | 해결 |
|---|---|---|
| `ℹ️ 이메일 설정 없음` | `email_config.json` 파일 미존재 | 파일 생성 |
| `ℹ️ PDF 없음` | LibreOffice 미설치 | [pdf-setup.md](pdf-setup.md) 참조 |
| `ℹ️ Cowork/Linux 환경` | Cowork 샌드박스 | 정상 동작 (의도된 skip) |
| `⚠️ SendGrid 발송 실패` | API 키 오류 또는 발신자 미인증 | SendGrid 대시보드에서 확인 |
| `403 Forbidden` | Sender Authentication 미완료 | SendGrid에서 발신 주소 인증 |
