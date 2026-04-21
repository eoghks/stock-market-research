---
name: stock-market-research
description: 한국·미국 증시를 자동 조사하고 상세 Word 보고서를 생성하는 스킬. "증시 조사해줘", "오늘 코스피 어때", "미국 증시 분석", "시황 보고서 만들어줘", "주식 시장 리포트", "한국/미국 주식 현황", "나스닥 오늘 얼마야", "환율이랑 증시 같이 조사해줘" 같은 요청이 오면 반드시 이 스킬을 사용하세요. Claude in Chrome으로 한국경제신문·매일경제를 크롤링하는 서브에이전트와, 네이버 MCP 서브에이전트를 병렬로 실행하여 실시간 시세·환율·거시경제 지표를 수집합니다. 수집된 데이터로 날짜·시간이 포함된 .docx 보고서를 저장하고, 카카오톡 MCP가 활성화되어 있으면 요약 메시지도 발송합니다.
---

# 📈 증시 조사 보고서 자동 생성 스킬 (v2)

## 전체 아키텍처

```
[사용자 요청]
      │
      ├──▶ 서브에이전트 A: Claude in Chrome 크롤링 ──────┐
      │    (한국경제신문, 매일경제, 데이터센터,             │
      │     한국·미국 시총 10위 기업 뉴스)                ├──▶ 데이터 통합 ──▶ DOCX 생성 ──▶ [카톡 발송]
      │                                                  │
      └──▶ 서브에이전트 B: 네이버 MCP (있으면 수집/없으면 skip) ┘
```

**핵심 원칙:** 두 서브에이전트를 **동일한 메시지에서 Agent()로 동시에 호출**하여 병렬 실행합니다.

---

## Step 0: 작업 디렉토리 설정

```bash
TIMESTAMP=$(date '+%Y%m%d-%H%M')
WORK_DIR="/sessions/$(ls /sessions)/stock-research-${TIMESTAMP}"
mkdir -p "$WORK_DIR"
echo "작업 디렉토리: $WORK_DIR"
```

파일명 형식: `증시 조사-YYYYMMDD-HHMM.docx`

---

## Step 1: 병렬 서브에이전트 실행 (반드시 동시에 호출)

### 서브에이전트 A 태스크 — Claude in Chrome 크롤링

아래 내용을 그대로 Agent() prompt로 전달하세요 (`{WORK_DIR}` 는 실제 경로로 치환):

```
당신은 한국·미국 증시 데이터 수집 에이전트입니다.
Claude in Chrome 도구(tabs_context_mcp, navigate, find, read_page, get_page_text)를 사용하여
아래 URL을 순서대로 방문하고 데이터를 수집하세요.

접근이 막힌 사이트(finance.naver.com 등)는 조용히 건너뛰세요.

### 수집 URL 목록

1. https://www.hankyung.com/koreamarket
   - 코스피, 코스닥 지수 현재가·등락률

2. https://markets.hankyung.com/indices/kospi
   - 코스피 상세: 거래량, 거래대금, 시가, 저가, 외국인 순매수, 52주 최고/최저

3. https://markets.hankyung.com/indices/kosdaq
   - 코스닥 상세 지표

4. https://www.hankyung.com/globalmarket
   - 미국 3대 지수(다우, S&P500, 나스닥) 및 주요 뉴스 헤드라인 5개

5. https://datacenter.hankyung.com/major-indices
   - 전 세계 주요 지수 테이블 (나스닥, 다우, S&P500, 닛케이, 항셍, 상해, 독일DAX 등)

6. https://datacenter.hankyung.com/currencies
   - USD/KRW, JPY/KRW, CNY/KRW, EUR/KRW, HKD/KRW 환율

7. https://datacenter.hankyung.com/indicators
   - 소비자물가지수(CPI), GDP 성장률, 실업률, 경상수지

8. https://markets.hankyung.com/index-info/marketcap
   - 코스피 시가총액 상위 기업 목록 수집:
     1위~10위 기업의 이름, 종목코드, 현재가, 등락률, 시가총액을 가져오세요.
   - 접근 불가 시 아래 기본 목록 사용:
     삼성전자(005930), SK하이닉스(000660), LG에너지솔루션(373220),
     현대차(005380), 삼성바이오로직스(207940), 기아(000270),
     셀트리온(068270), POSCO홀딩스(005490), KB금융(105560), 신한지주(055550)

9. 한국 시총 10위 기업 뉴스 수집:
   위 8번에서 파악한 각 기업(또는 기본 목록)에 대해:
   - https://www.hankyung.com/search?query={기업명} 또는
   - https://markets.hankyung.com/stock/{종목코드} 페이지에서
   - 각 기업별 최신 뉴스 헤드라인 2~3개를 수집하세요.
   - 뉴스가 없으면 빈 배열([])로 처리하세요.
   - 각 기업의 뉴스를 한두 문장으로 요약하고, 투자자 관점에서 의미 해석을 한국어로 작성하세요.

10. 미국 시총 10위 기업 뉴스 수집:
    아래 고정 목록에 대해 각 기업의 최신 뉴스를 수집하세요:
    Apple(AAPL), Microsoft(MSFT), NVIDIA(NVDA), Amazon(AMZN), Alphabet(GOOGL),
    Meta(META), Tesla(TSLA), Berkshire Hathaway(BRK.B), Broadcom(AVGO), JPMorgan(JPM)
    
    수집 방법:
    - https://www.hankyung.com/search?query={기업명} 검색 페이지에서 뉴스 헤드라인 2~3개 수집
    - 예: https://www.hankyung.com/search?query=애플 또는 https://www.hankyung.com/search?query=Apple
    - 각 기업의 뉴스를 한두 문장으로 요약하고, 한국 투자자 관점에서 의미를 한국어로 작성하세요.

11. 종합 분석 작성:
    수집된 한국·미국 시총 상위 기업 뉴스 전체를 종합하여,
    현재 증시 흐름에서 이 기업들의 뉴스가 갖는 의미를 3~5문장으로 작성하세요.
    (company_overall_summary 필드에 저장)

### 출력 형식

수집 완료 후 반드시 아래 JSON 스키마로 {WORK_DIR}/chrome_data.json 에 저장하세요:

{
  "status": "collected",
  "source": "hankyung+mk",
  "collected_at": "<ISO 타임스탬프>",
  "base_date": "<장마감 날짜, 예: 2026년 04월 17일(목)>",
  "kr_indices": [
    {"name": "코스피", "value": "6,191.92", "change": "▼ 34.13", "change_pct": "-0.55%"},
    {"name": "코스닥", "value": "1,170.04", "change": "▲ 7.12",  "change_pct": "+0.61%"}
  ],
  "kospi_detail": {
    "trading_volume": "689,740 천주",
    "trading_value": "24조 6,196억원",
    "open": "6,230.32",
    "low": "6,159.88",
    "foreign_net": "-19,974억원",
    "high_52w": "6,347.41",
    "low_52w": "2,447.40",
    "listed_stocks": "5,510"
  },
  "kospi_returns": [
    {"period": "3개월",  "return_pct": "+26.94%"},
    {"period": "6개월",  "return_pct": "+60.31%"},
    {"period": "12개월", "return_pct": "+166.73%"}
  ],
  "us_indices": [
    {"name": "다우존스 (DJIA)", "value": "49,447.43", "change": "▲ 868.71",  "change_pct": "+1.79%"},
    {"name": "S&P 500",         "value": "7,126.06",  "change": "▲ 84.78",   "change_pct": "+1.20%"},
    {"name": "나스닥 (NASDAQ)", "value": "24,468.48", "change": "▲ 365.78",  "change_pct": "+1.52%"},
    {"name": "나스닥 100",      "value": "26,672.43", "change": "▲ 339.43",  "change_pct": "+1.29%"},
    {"name": "반도체 지수(SOX)","value": "9,555.88",  "change": "▲ 226.54",  "change_pct": "+2.43%"}
  ],
  "global_indices": [
    {"name": "일본 닛케이 225", "value": "58,475.90", "change": "▼ 1,042.44", "change_pct": "-1.75%"},
    {"name": "중국 상해종합",   "value": "4,051.43",  "change": "▼ 4.12",     "change_pct": "-0.10%"},
    {"name": "홍콩 항셍",       "value": "26,160.33", "change": "▼ 233.93",   "change_pct": "-0.89%"},
    {"name": "독일 DAX",        "value": "24,702.24", "change": "▲ 547.77",   "change_pct": "+2.27%"}
  ],
  "fx_rates": [
    {"pair": "USD/KRW", "rate": "1,467.04", "change": "+8.19", "change_pct": "+0.56%"},
    {"pair": "JPY/KRW", "rate": "924.73",   "change": "+0.50", "change_pct": "+0.05%"},
    {"pair": "CNY/KRW", "rate": "215.17",   "change": "+1.33", "change_pct": "+0.62%"},
    {"pair": "EUR/KRW", "rate": "1,725.65", "change": "+3.32", "change_pct": "+0.19%"},
    {"pair": "HKD/KRW", "rate": "187.14",   "change": "+0.84", "change_pct": "+0.45%"}
  ],
  "macro": [
    {"name": "소비자물가지수(CPI)",     "value": "118.80", "period": "2026.03"},
    {"name": "경제성장률(GDP, 실질)",   "value": "1.40%",  "period": "전년 대비"},
    {"name": "실업률",                 "value": "3.00%",  "period": "2026.03"},
    {"name": "경상수지",               "value": "23,192억원", "period": "2026.02"}
  ],
  "kr_news": [
    {"title": "헤드라인1", "url": "https://www.hankyung.com/article/..."},
    {"title": "헤드라인2", "url": "https://www.hankyung.com/article/..."}
  ],
  "us_news": [
    {"title": "헤드라인1", "url": "https://www.hankyung.com/article/..."},
    {"title": "헤드라인2", "url": null}
  ],
  "kr_top10": [
    {
      "rank": 1,
      "name": "삼성전자",
      "ticker": "005930",
      "sector": "반도체·전자",
      "price": "78,500",
      "change_pct": "+1.20%",
      "market_cap": "약 468조원",
      "news": [
        {"title": "뉴스 헤드라인1", "url": "https://www.hankyung.com/article/..."},
        {"title": "뉴스 헤드라인2", "url": null}
      ],
      "news_summary": "이 뉴스들이 투자자에게 의미하는 것을 2~3문장으로 한국어로 설명"
    }
  ],
  "us_top10": [
    {
      "rank": 1,
      "name": "Apple",
      "symbol": "AAPL",
      "sector": "Technology",
      "price": "$195.50",
      "change_pct": "+0.80%",
      "market_cap": "$3.2T",
      "news": [
        {"title": "news headline 1", "url": "https://www.hankyung.com/article/..."},
        {"title": "news headline 2", "url": null}
      ],
      "news_summary": "한국 투자자 관점에서 이 뉴스의 의미를 2~3문장으로 한국어로 설명"
    }
  ],
  "company_overall_summary": "양국 시총 상위 기업 뉴스 흐름을 종합하여, 현재 증시에 미치는 영향과 시사점을 3~5문장으로 작성"
}
```

---

### 서브에이전트 B 태스크 — 네이버 MCP 수집

아래 내용을 그대로 Agent() prompt로 전달하세요 (`{WORK_DIR}` 는 실제 경로로 치환):

```
당신은 네이버 금융 데이터 수집 에이전트입니다.

먼저 현재 사용 가능한 MCP/도구 목록을 확인하세요.
이름에 'naver', 'finance', '네이버' 등이 포함된 도구가 있으면 해당 도구로
코스피·코스닥·미국 지수·환율을 수집하세요.

해당 도구가 없으면 즉시 아래 JSON을 {WORK_DIR}/naver_data.json 으로 저장하고 종료하세요:
{"status": "skipped", "reason": "Naver MCP not available"}

도구가 있다면 수집 후 아래 형식으로 {WORK_DIR}/naver_data.json 저장:
{
  "status": "collected",
  "source": "naver_finance",
  "collected_at": "<ISO 타임스탬프>",
  "kr_indices": [
    {"name": "코스피", "value": "숫자", "change_pct": "±X.XX%"}
  ],
  "us_indices": [
    {"name": "다우존스", "value": "숫자", "change_pct": "±X.XX%"}
  ],
  "fx_rates": [
    {"pair": "USD/KRW", "rate": "숫자"}
  ]
}
```

---

## Step 2: 데이터 통합

두 서브에이전트가 완료되면:

1. `chrome_data.json` 읽기 (기본 데이터)
2. `naver_data.json` 읽기:
   - status가 `"skipped"` → chrome_data만 사용
   - status가 `"collected"` → 숫자 교차 검증 (불일치 시 chrome_data 우선), 추가 데이터 병합
3. 최종 `merged_data.json` 저장 (= chrome_data에 naver 보완 반영본)

```python
import json, os

chrome = json.load(open(f"{WORK_DIR}/chrome_data.json"))
naver  = json.load(open(f"{WORK_DIR}/naver_data.json"))

merged = chrome.copy()
if naver.get("status") == "collected":
    merged["naver_verified"] = True
    # 네이버에서 추가 데이터 있으면 병합
    for key in ["kr_indices", "us_indices", "fx_rates"]:
        if key in naver and naver[key]:
            merged[f"naver_{key}"] = naver[key]
else:
    merged["naver_verified"] = False

json.dump(merged, open(f"{WORK_DIR}/merged_data.json", "w"), ensure_ascii=False, indent=2)
```

---

## Step 3: DOCX 보고서 생성

### 의존성 설치

```bash
SCRIPT_WORK="/tmp/stock_docx_$$"
mkdir -p "$SCRIPT_WORK"
cd "$SCRIPT_WORK"
npm install docx 2>/dev/null
```

### 보고서 생성

```bash
SKILL_DIR="<이 SKILL.md가 있는 디렉토리 경로>"
OUTPUT_PATH="/path/to/mnt/claude/증시 조사-${TIMESTAMP}.docx"

node "${SKILL_DIR}/scripts/generate_report.js" \
  "${WORK_DIR}/merged_data.json" \
  "${OUTPUT_PATH}" \
  "${SCRIPT_WORK}"
```

`generate_report.js` 는 3번째 인수로 node_modules 경로를 받습니다.

### 보고서 구성 (8섹션)

| 섹션 | 내용 |
|------|------|
| 1. 한국 증시 | 코스피/코스닥 지수, 상세 지표, 기간 수익률, 이슈 |
| 2. 미국 증시 | 다우·S&P500·나스닥·반도체 지수, 이슈 |
| 3. 글로벌 지수 | 아시아·유럽 주요국 지수 |
| 4. 환율 | 환율 설명 박스 + 5개 통화쌍 상세 (초보자 설명 포함) |
| 5. 거시경제 지표 | CPI·GDP·실업률·경상수지 + 쉬운 설명 + 분석 박스 |
| 6. 한국 시총 10위 기업 | 기업별 뉴스 카드 + 뉴스 의미 해석 |
| 7. 미국 시총 10위 기업 | 빅테크·반도체·금융 기업별 뉴스 카드 + 해석 |
| 8. 종합 결론 | 핵심 시사점 + 기업 뉴스 종합 분석 + 투자자 체크리스트 |

---

## Step 4: 카카오톡 발송 (선택)

사용자가 카카오톡 발송을 원하거나 KakaoTalk MCP가 활성화된 경우,
수집된 데이터로 **8개 메시지를 순서대로** 발송합니다:

```
메시지 1: 📊 헤더 (보고서 개요 + 기준일)
메시지 2: 🇰🇷 한국 증시 (코스피/코스닥 현재가·등락률·이슈)
메시지 3: 🇺🇸 미국 증시 (다우·S&P500·나스닥 현재가·등락률·이슈)
메시지 4: 🌍 글로벌 주요 지수
메시지 5: 💱 환율 현황 (원달러·엔·위안·유로 + 간단 설명)
메시지 6: 📉 거시경제 지표
메시지 7: 🏢 한국·미국 시총 10위 기업 주요 뉴스 요약
메시지 8: ✅ 종합 결론 및 시사점
```

---

## 문서 산출물 저장 규칙

**이 플러그인과 관련된 모든 문서는 `docs/` 폴더 하위에 저장합니다.**

| 카테고리 | 저장 위치 | 예시 |
|----------|-----------|------|
| 아키텍처·설계 | `docs/architecture/` | `pipeline.md`, `data-sources.md` |
| 사용법·가이드 | `docs/usage/` | `getting-started.md`, `pdf-setup.md` |
| 버전별 변경 이력 | `docs/changelog/` | `v2.0.0.md` |
| 용어 사전 | `docs/glossary/` | `glossary.md`, `glossary.json` |
| 생성 보고서 (로컬만) | `docs/reports/` | `.gitignore` 적용됨 |

**명명 규칙:** `docs/{카테고리}/{kebab-case-제목}.md`

**용어 사전 규칙:** `docs/glossary/glossary.md` 에 누적 관리. 한 번 등록한 용어는 재기록 금지.
새로운 스킬 실행 결과로 생성되는 문서도 이 규칙을 따릅니다.

---

## 주의사항

- `finance.naver.com` 은 Claude in Chrome 보안 제한으로 직접 접근 불가 → 네이버 MCP로만 가능
- 데이터 크롤링은 실시간이 아닐 수 있으므로 보고서에 수집 시각 명시
- `docx` npm 패키지가 없으면 자동 설치 (인터넷 필요)
- 두 서브에이전트의 Agent() 호출은 **반드시 같은 메시지**에 포함 (병렬 실행의 핵심)
- 기업 뉴스 수집 시 접근 불가 페이지는 조용히 건너뛰고 빈 배열([])로 처리
- 뉴스 요약(news_summary)은 반드시 **한국어**로 작성 (미국 기업도 한국어 해석 포함)
