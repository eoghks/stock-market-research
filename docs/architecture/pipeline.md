# 파이프라인 구조

stock-market-research는 4단계 파이프라인으로 동작합니다.

```
[사용자 요청]
      │
      ▼
┌─────────────────────────────────────┐
│  Step 1: 병렬 데이터 수집            │
│  ┌─────────────────┐  ┌──────────┐  │
│  │   서브에이전트A   │  │서브에이전트B│  │
│  │Yahoo Finance API│  │Naver MCP │  │
│  │ + WebFetch      │  │(선택사항) │  │
│  └────────┬────────┘  └────┬─────┘  │
│           │  yahoo_data    │naver_data│
└───────────┼────────────────┼─────────┘
          │                │
          ▼                ▼
┌─────────────────────────────────────┐
│  Step 2: 데이터 통합 및 검증         │
│  chrome_data + naver_data           │
│  → merged_data.json                 │
│  (Naver 데이터로 교차 검증,          │
│   불일치 시 chrome_data 우선)        │
└────────────────┬────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────┐
│  Step 3: DOCX/PDF 보고서 생성       │
│  node scripts/generate_report.js    │
│  merged_data.json → 증시조사.docx   │
│  → LibreOffice → 증시조사.pdf       │
└────────────────┬────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────┐
│  Step 4: 카카오톡 발송 (선택)        │
│  KakaoTalk MCP 활성화 시 8개 메시지  │
│  순차 발송                          │
└─────────────────────────────────────┘
```

## Step 1 — 병렬 데이터 수집

**중요:** 두 서브에이전트는 반드시 **같은 메시지**에서 동시에 호출해야 합니다 (병렬 실행).

### 서브에이전트 A — Yahoo Finance API + WebFetch (v2.4.0~)

브라우저 없이 WebFetch·WebSearch 도구만 사용. 사용자 화면 건드리지 않음.

**1단계: 지수·환율·심리지표·종목 (Yahoo Finance v7 API 배치 호출)**

```
https://query1.finance.yahoo.com/v7/finance/quote?symbols=
  ^KS11,^KQ11,^GSPC,^IXIC,^DJI,^NDX,^SOX,^VIX,
  KRW=X,^TNX,GC=F,CL=F,BTC-USD,
  XLK,XLF,XLE,XLV,XLY,...  (45개 심볼, 인증 불필요)
```

**2단계: 뉴스·섹터·수급 (WebFetch + WebSearch)**

| 소스 | 수집 데이터 |
|------|-----------|
| hankyung.com/koreamarket | 코스피·코스닥 뉴스·수급 |
| hankyung.com/globalmarket | 미국 3대 지수 뉴스 |
| hankyung.com/international | 글로벌 거시 뉴스 |
| datacenter.hankyung.com | 거시경제 지표 |
| WebSearch | 한·미 시총 10위 기업 최신 뉴스 |

**출력:** `{WORK_DIR}/yahoo_data.json`

### 서브에이전트 B — Naver MCP 수집 (조건부)

- Naver MCP 도구 존재 시 실행, 없으면 skip
- **주의:** `finance.naver.com`은 Claude in Chrome 보안 제한으로 직접 접근 불가. Naver MCP로만 가능
- **출력:** `{WORK_DIR}/naver_data.json` (status: "collected" | "skipped")

---

## Step 2 — 데이터 통합

```
1. yahoo_data.json 읽기 (기본 소스, Yahoo Finance API + WebFetch)
2. naver_data.json 읽기
   ├─ status="skipped" → yahoo_data만 사용
   └─ status="collected" → 숫자 교차 검증 (불일치 시 yahoo_data 우선)
                           추가 데이터 병합
3. merged_data.json 저장 (naver_verified 플래그 포함)
```

---

## Step 3 — 보고서 생성

```bash
node scripts/generate_report.js <data.json> <output.docx> [node_modules_dir]
```

- `docx` 패키지 자동 설치 (인터넷 필요)
- 출력 파일명 형식: `증시 조사-YYYYMMDD-HHMM.docx`
- LibreOffice가 설치된 경우 PDF 자동 생성

자세한 내용: [report-sections.md](report-sections.md)

---

## Step 3.5 — 이메일 발송 (환경별)

`generate_report.js`가 `process.platform`으로 환경을 자동 감지합니다.

| 시나리오 | 이메일 | 비고 |
|---|---|---|
| **Cowork (skill 호출)** | ❌ skip | Linux 감지 → 자동 skip, 카카오톡으로 대체 |
| **로컬 Windows 직접 실행** | ✅ SendGrid API | `config/email_config.json` 설정 필요 |
| **Windows 작업 스케줄러** | ✅ SendGrid API | `run_daily_report.ps1` → 매일 19:30 KST |

이메일 설정: [email-setup.md](../usage/email-setup.md)  
스케줄러 설정: [scheduler-setup.md](../usage/scheduler-setup.md)

---

## Step 4 — 카카오톡 발송

KakaoTalk MCP 활성화 시 자동 실행. 8개 메시지 순차 발송:

| 메시지 | 내용 |
|--------|------|
| 1️⃣ | 헤더 — 보고서 개요 + 기준일 |
| 2️⃣ | 거시 정세 — 글로벌 주요 뉴스 |
| 3️⃣ | 한국 증시 — 코스피/코스닥 |
| 4️⃣ | 미국 증시 — 다우·S&P500·나스닥 |
| 5️⃣ | 글로벌 주요 지수 |
| 6️⃣ | 환율 현황 |
| 7️⃣ | 거시경제 지표 |
| 8️⃣ | 한국·미국 시총 10위 + 종합 결론 |
