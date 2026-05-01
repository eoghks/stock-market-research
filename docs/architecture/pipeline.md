# 파이프라인 구조

stock-market-research는 4단계 파이프라인으로 동작합니다.

```
[사용자 요청]
      │
      ▼
┌─────────────────────────────────────┐
│  Step 1: 병렬 데이터 수집            │
│  ┌─────────────┐  ┌──────────────┐  │
│  │ 서브에이전트A │  │ 서브에이전트B │  │
│  │Claude Chrome│  │  Naver MCP  │  │
│  │  크롤링     │  │  (선택사항)  │  │
│  └──────┬──────┘  └──────┬───────┘  │
│         │  chrome_data   │naver_data│
└─────────┼────────────────┼──────────┘
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

### 서브에이전트 A — Claude in Chrome 크롤링

11개 URL을 순차 방문하여 JSON 스키마에 맞는 데이터 수집:

| 순서 | URL | 수집 데이터 |
|------|-----|-----------|
| 1 | hankyung.com/koreamarket | 코스피·코스닥 현재가, 등락률 |
| 2 | markets.hankyung.com/indices/kospi | 코스피 상세 (거래량, 시가, 저가, 외국인 등) |
| 3 | markets.hankyung.com/indices/kosdaq | 코스닥 상세 지표 |
| 4 | hankyung.com/globalmarket | 미국 3대 지수 + 뉴스 헤드라인 5개 |
| 5 | datacenter.hankyung.com/major-indices | 글로벌 주요 지수 (닛케이·항셍·상해·DAX) |
| 6 | datacenter.hankyung.com/currencies | 환율 5쌍 (USD·JPY·CNY·EUR·HKD) |
| 7 | datacenter.hankyung.com/indicators | 거시경제 (CPI·GDP·실업률·경상수지) |
| 8 | markets.hankyung.com/index-info/marketcap | 코스피 시총 상위 10위 |
| 9 | hankyung.com/search?query={기업명} | 한국 시총 10위 기업별 최신 뉴스 2~3개 |
| 10 | hankyung.com/search?query={기업명} | 미국 시총 10위 기업별 뉴스 (고정 목록) |
| 11 | (합성) | 한·미 시총 기업 종합 분석 (`company_overall_summary`) |

**미국 시총 고정 목록:** Apple, Microsoft, NVIDIA, Amazon, Alphabet, Meta, Tesla, Berkshire Hathaway, Broadcom, JPMorgan

**출력:** `{WORK_DIR}/chrome_data.json`

### 서브에이전트 B — Naver MCP 수집 (조건부)

- Naver MCP 도구 존재 시 실행, 없으면 skip
- **주의:** `finance.naver.com`은 Claude in Chrome 보안 제한으로 직접 접근 불가. Naver MCP로만 가능
- **출력:** `{WORK_DIR}/naver_data.json` (status: "collected" | "skipped")

---

## Step 2 — 데이터 통합

```
1. chrome_data.json 읽기 (기본 소스)
2. naver_data.json 읽기
   ├─ status="skipped" → chrome_data만 사용
   └─ status="collected" → 숫자 교차 검증 (불일치 시 chrome_data 우선)
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

| 환경 | 이메일 | 비고 |
|---|---|---|
| **로컬 Windows** | ✅ SendGrid API | `config/email_config.json` 설정 필요 |
| **Cowork** | ❌ | 외부 인터넷 완전 차단 — 카카오톡으로 대체 |

로컬 자동화: [scheduler-setup.md](../usage/scheduler-setup.md)

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
