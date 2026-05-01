# 📈 stock-market-research

> 한국·미국 증시를 자동 조사하고 **상세 Word·PDF 보고서**를 생성하는 Claude Code 플러그인

![Version](https://img.shields.io/badge/version-2.4.2-blue)
![Node](https://img.shields.io/badge/Node.js-18%2B-green)
![License](https://img.shields.io/badge/license-MIT-lightgrey)
![SemVer](https://img.shields.io/badge/versioning-SemVer%202.0-orange)
![Claude](https://img.shields.io/badge/Claude-Code%20Plugin-purple)

---

## ✨ 주요 기능

| 기능 | 설명 |
|---|---|
| 🌐 글로벌 거시 정세 | 금리·지정학·에너지·무역 헤드라인 우선 출력 |
| 🤖 AI 데일리 인사이트 | 데이터 기반 핵심 3줄 (오늘의 흐름·변화·내일 주목점) |
| 📊 시계열 차트 | 코스피·코스닥·S&P500·나스닥·USD/KRW 7일/4주/12개월 |
| 🌡️ 섹터 히트맵 | 한국 업종별·미국 SPDR ETF 등락률 히트맵 |
| 💰 수급 동향 | 외국인·기관·개인 순매수 + 외국인 상위/하위 5종목 |
| 😨 시장 심리 패널 | VIX·미10년물·WTI·금·비트코인 신호 표시 |
| 📅 이벤트 캘린더 | FOMC·CPI·금통위·실적발표 단기 변동성 일정 |
| 🔍 워치리스트 | 거래대금급증·외인매수·급등락 기준 한국5+미국5 종목 |
| 🏢 시총 10위 뉴스 | 한국·미국 시가총액 상위 기업 뉴스 + 클릭 링크 |
| 📄 PDF 출력 | LibreOffice headless로 DOCX와 PDF 동시 생성 |
| 📖 용어 사전 | 신규 등장 용어 자동 감지·누적 등록 (중복 방지) |
| 💬 카카오톡 발송 | KakaoTalk MCP 연동 시 9개 요약 메시지 자동 발송 |
| 📧 이메일 발송 | SendGrid API로 PDF+DOCX 첨부 자동 발송 (로컬 전용) |
| ⏰ 자동 실행 | Windows 작업 스케줄러로 매일 정해진 시각 무인 실행 |

---

## 🚀 빠른 시작

### 1. Claude Code에 플러그인 등록

`~/.claude/settings.json` 또는 프로젝트 `.claude/settings.json` 의 `plugins` 배열에 추가:

```json
{
  "plugins": ["/path/to/stock-market-research"]
}
```

### 2. 의존성 설치

```bash
cd stock-market-research/scripts
npm install
```

### 3. 이메일 설정 (선택)

`config/email_config.json` 생성 (`config/email_config.example.json` 참고):

```json
{
  "provider": "sendgrid",
  "sendgrid": { "api_key": "SG.xxxx..." },
  "from": "sender@gmail.com",
  "to": "recipient@naver.com",
  "subject_prefix": "[증시 보고서]"
}
```

> ⚠️ `email_config.json`은 `.gitignore` 등록 — 절대 커밋하지 마세요.

### 4. 실행

Claude Code 채팅창에서:

```
증시 조사해줘
오늘 코스피 어때?
시황 보고서 만들어줘
```

보고서는 `~/Documents/` 또는 `/sessions/` 경로에 `증시 조사-YYYYMMDD-HHMM.docx` 형식으로 저장됩니다.

### 5. 자동 실행 설정 (Windows 로컬 전용)

매일 정해진 시각에 자동 실행하려면:

```powershell
cd scripts
& ".\setup_scheduler.ps1"   # 1회만 실행
```

→ 매일 **18:30 KST** 자동 실행. 자세한 내용: [docs/usage/scheduler-setup.md](docs/usage/scheduler-setup.md)

> **Cowork 환경:** 외부 인터넷이 차단되어 이메일 발송 불가. 카카오톡으로만 알림 수신. 이메일이 필요하면 로컬 자동 실행을 사용하세요.

---

## 📦 의존성

| 패키지 | 용도 |
|---|---|
| `docx` | Word(.docx) 보고서 생성 |
| `chartjs-node-canvas` | 시계열 라인차트·히트맵 PNG 생성 |
| `chart.js` | 차트 렌더링 엔진 |
| LibreOffice (선택) | DOCX→PDF 변환 (`soffice --headless`) |

LibreOffice 설치 → [docs/usage/pdf-setup.md](docs/usage/pdf-setup.md) 참조

---

## 🗂️ 폴더 구조

```
stock-market-research/
├── SKILL.md                    # 플러그인 스킬 정의 (Claude Code 진입점)
├── README.md                   # 이 파일
├── scripts/
│   ├── generate_report.js      # 보고서 생성 메인 스크립트
│   ├── run_daily_report.ps1    # 자동 실행 래퍼 (스케줄러 호출용)
│   ├── setup_scheduler.ps1     # Windows 작업 스케줄러 등록 (1회 실행)
│   ├── email/
│   │   └── send_report.js      # SendGrid API 이메일 발송
│   ├── charts/
│   │   ├── fetch_timeseries.js # 시계열 데이터 추출
│   │   ├── render_chart.js     # 라인차트 PNG 생성
│   │   ├── render_heatmap.js   # 섹터 히트맵 PNG 생성
│   │   └── schedule.js         # 일/주/월 차트 스케줄 결정
│   ├── insights/
│   │   └── glossary_check.js   # 신규 용어 감지·누적 등록
│   └── pdf/
│       └── convert_to_pdf.js   # LibreOffice PDF 변환
└── docs/
    ├── README.md               # docs 인덱스 및 명명 규칙
    ├── architecture/
    │   ├── pipeline.md         # 4단계 데이터 파이프라인
    │   ├── data-sources.md     # 수집 URL 및 JSON 스키마
    │   └── report-sections.md  # 섹션 구조 및 헬퍼 함수
    ├── usage/
    │   ├── getting-started.md  # 빠른 시작 가이드
    │   ├── pdf-setup.md        # LibreOffice 설치 가이드
    │   └── troubleshooting.md  # 자주 묻는 문제
    ├── changelog/
    │   └── v2.0.0.md           # v2 변경 사항 (Phase 18 완료 후)
    └── glossary/
        ├── glossary.md         # 마스터 용어 사전 (누적 관리)
        └── glossary.json       # 기계 판독용 용어 메타데이터
```

---

## 📊 보고서 섹션 구성 (v2)

```
[표지]  기준일 · KPI 3개 (코스피/S&P500/USD/KRW)
[AI 인사이트]  오늘의 핵심 ①②③ (데이터 기반)
 0. 글로벌 거시 정세     — 금리·지정학·에너지 헤드라인
 0-A. 시장 심리 패널    — VIX·금리·유가·금·비트코인
 1. 한국 증시           — 코스피/코스닥 + 시계열차트 + 수급 + 히트맵
 2. 미국 증시           — 3대 지수 + 시계열차트 + 히트맵
 3. 글로벌 주요 지수
 4. 환율 현황           — 5개 통화쌍 + USD/KRW 차트
 5. 한국 거시경제 지표
 6. 한국 시총 10위 기업 뉴스 (클릭 링크)
 7. 미국 시총 10위 기업 뉴스 (클릭 링크)
 8. 워치리스트          — 오늘 주목할 한국5+미국5 종목
 8-A. 이벤트 캘린더    — 이번주 FOMC·CPI·실적발표
 9. 종합 결론 및 시사점 + 투자자 체크리스트
[부록]  이번 호 신규 용어
```

---

## 🌐 데이터 소스

| 소스 | 수집 내용 |
|---|---|
| `hankyung.com/koreamarket` | 코스피·코스닥 지수 |
| `markets.hankyung.com` | 코스피 상세·섹터·수급 |
| `hankyung.com/globalmarket` | 미국 3대 지수·환율 |
| `datacenter.hankyung.com` | 전세계 지수·거시경제 |
| `hankyung.com/international` | 글로벌 거시 뉴스 |
| 네이버 MCP (선택) | 교차 검증 보완 |

---

## 📖 문서

- [파이프라인 구조](docs/architecture/pipeline.md)
- [데이터 소스 및 스키마](docs/architecture/data-sources.md)
- [보고서 섹션 구조](docs/architecture/report-sections.md)
- [버전 관리 정책 (SemVer)](docs/architecture/versioning.md)
- [빠른 시작](docs/usage/getting-started.md)
- [PDF 설정](docs/usage/pdf-setup.md)
- [문제 해결](docs/usage/troubleshooting.md)
- [변경 이력](docs/changelog/)
- [용어 사전](docs/glossary/glossary.md)

---

## 📄 라이선스

MIT — 자유롭게 사용·수정·배포 가능합니다.

---

## 🤝 기여

1. Fork → 브랜치 생성 (`feat/your-feature`)
2. 변경 후 커밋
3. Pull Request 제출

이슈·제안은 [GitHub Issues](https://github.com/eoghks/stock-market-research/issues)에 남겨주세요.
