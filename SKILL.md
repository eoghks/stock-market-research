---
name: stock-market-research
description: 한국·미국 증시를 자동 조사하고 상세 Word 보고서를 생성하는 스킬. "증시 조사해줘", "오늘 코스피 어때", "미국 증시 분석", "시황 보고서 만들어줘", "주식 시장 리포트", "한국/미국 주식 현황", "나스닥 오늘 얼마야", "환율이랑 증시 같이 조사해줘" 같은 요청이 오면 반드시 이 스킬을 사용하세요. Claude in Chrome으로 한국경제신문·매일경제를 크롤링하는 서브에이전트와, 네이버 MCP 서브에이전트를 병렬로 실행하여 실시간 시세·환율·거시경제 지표를 수집합니다. 수집된 데이터로 날짜·시간이 포함된 .docx 보고서를 저장하고, 카카오톡 MCP가 활성화되어 있으면 요약 메시지도 발송합니다.
---

# 📈 증시 조사 보고서 자동 생성 스킬 (v2.1.0)

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

11. 수급 동향 수집 (flow_data):
    https://markets.hankyung.com/indices/kospi 또는
    https://datacenter.hankyung.com/investors 에서
    코스피·코스닥의 외국인/기관/개인 당일 순매수 금액을 수집하세요.
    외국인 순매수 상위 5종목 / 순매도 상위 5종목도 함께 수집하세요.
    접근 불가 시 빈 객체({})로 처리하세요.

12. 시장 심리 지표 수집 (sentiment):
    아래 5개 지표를 수집하세요. 접근 불가 시 해당 항목 제외.
    - VIX(공포지수): https://www.hankyung.com/globalmarket 또는 Yahoo Finance
    - 美 10년 국채금리: https://datacenter.hankyung.com/major-indices
    - WTI 유가: https://datacenter.hankyung.com/major-indices 또는 hankyung 원자재 섹션
    - 금(Gold): 동일 소스
    - 비트코인: https://www.hankyung.com/globalmarket
    신호(signal)는 VIX<20→안정, VIX≥25→위험, 금리상승→주의, 유가급등→주의로 판단하세요.

13. 이벤트 캘린더 수집 (event_calendar):
    이번주~다음주 아래 이벤트를 수집하세요:
    - FOMC 회의, 미국 CPI/PPI/고용지표 발표일
    - 한국 금통위 회의, 한국 경제지표 발표
    - 주요 기업 실적발표 (삼성전자, SK하이닉스, Apple, NVIDIA 등)
    출처: https://www.hankyung.com/economy 또는 Investing.com 경제캘린더
    접근 불가 시 빈 배열([])로 처리하세요.

14. 주목 종목 수집 (watchlist):
    아래 기준으로 한국 5종목, 미국 5종목을 선별하세요:
    - 거래대금 급증 (평소 대비 2배 이상)
    - 외국인 대량 순매수 (수급 동향 기반)
    - 당일 5% 이상 급등락
    - 실적 어닝 서프라이즈 발표
    - 거시 뉴스(금리·지정학)와 직접 연관된 종목
    각 종목에 "왜 주목해야 하는가" 한 줄 이유와 관련 뉴스 제목을 포함하세요.

15. AI 데일리 인사이트 작성 (daily_insight):
    수집된 모든 데이터를 종합하여 핵심 3줄을 작성하세요:
    ① 오늘의 가장 큰 시장 흐름 (한 문장)
    ② 가장 중요한 변화 또는 리스크 (한 문장)
    ③ 내일·이번주 주목할 점 (한 문장)
    반드시 실제 수집 데이터에 근거해 작성하세요. 일반론 금지.

16. 한국·미국 섹터별 등락률 수집 (kr_sectors / us_sectors):
    한국: https://markets.hankyung.com/index-info/industry 에서
    반도체·자동차·금융·바이오·2차전지·게임·조선·건설·통신·철강 업종 등락률 수집.
    미국: https://www.hankyung.com/globalmarket 또는
    Yahoo Finance 섹터 ETF (XLK/XLF/XLE/XLV/XLY/XLI/XLB/XLP/XLRE/XLU) 등락률 수집.
    접근 불가 시 빈 배열([])로 처리하세요.

12. 글로벌 거시 정세 뉴스 수집 (macro_headlines):
    아래 두 URL에서 거시 뉴스를 최대 6개 수집하세요.
    키워드 우선순위: 전쟁·제재·금리·유가·환율·지정학 리스크 순.
    - https://www.hankyung.com/international  (국제 섹션)
    - https://www.hankyung.com/economy        (경제 섹션)
    각 뉴스에 대해 category(금리/지정학/에너지/환율/무역/기타)와
    importance(high/medium/low)를 판단해 부여하세요.
    접근 불가 시 빈 배열([])로 처리하세요.

12. 종합 분석 작성:
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
  "daily_insight": [
    "오늘 미국 증시는 Fed 금리 동결 기대감으로 S&P500이 1.2% 상승했으나 한국은 외국인 매도로 코스피가 0.5% 하락했습니다.",
    "원/달러 환율이 1,467원으로 연고점 수준이며, 에너지 수입 의존도가 높은 한국 경제에 물가 상승 압력이 가중되고 있습니다.",
    "이번 주 목요일 미국 CPI 발표가 핵심 변수 — 예상치(3.2%) 상회 시 금리 인하 기대 후퇴로 나스닥 조정 가능성 주의."
  ],
  "event_calendar": [
    {"date": "04/23 (수)", "region": "미국", "event": "FOMC 의사록 공개",    "impact": "높음", "note": "금리 인하 시점 힌트 여부 주목"},
    {"date": "04/24 (목)", "region": "미국", "event": "미국 CPI 발표",       "impact": "높음", "note": "예상 3.2% — 상회 시 긴축 우려 재점화"},
    {"date": "04/25 (금)", "region": "한국", "event": "삼성전자 잠정실적",   "impact": "높음", "note": "반도체 업황 회복 시그널 확인"},
    {"date": "04/28 (월)", "region": "미국", "event": "NVIDIA 실적발표",     "impact": "높음", "note": "AI 수요 지속 여부 가늠자"},
    {"date": "04/29 (화)", "region": "한국", "event": "한국 금통위 회의",    "impact": "보통", "note": "기준금리 동결 전망 — 코멘트 주목"}
  ],
  "watchlist": {
    "kr": [
      {"name": "HD현대중공업", "ticker": "329180", "price": "185,500", "change_pct": "+5.3%",
       "reason": "조선 수주 급증 — 외국인 대량 매수 유입",
       "news_title": "HD현대중공업, LNG선 10척 수주 계약 체결"},
      {"name": "에코프로비엠",  "ticker": "247540", "price": "125,000", "change_pct": "+4.1%",
       "reason": "2차전지 소재 수출 호조 — 거래대금 급증",
       "news_title": "에코프로비엠, 미국 GM과 배터리 소재 공급 계약"}
    ],
    "us": [
      {"name": "NVIDIA (NVDA)", "ticker": "NVDA", "price": "$875.40", "change_pct": "+3.2%",
       "reason": "AI 서버 수요 폭발 — 실적발표 전 기대감",
       "news_title": "NVIDIA GTC서 Blackwell GPU 양산 일정 확정"},
      {"name": "ExxonMobil (XOM)", "ticker": "XOM", "price": "$112.30", "change_pct": "+2.8%",
       "reason": "중동 긴장 고조로 유가 급등 — 에너지주 수혜",
       "news_title": "WTI 원유 배럴당 90달러 돌파, 호르무즈 긴장"}
    ]
  },
  "flow_data": {
    "kospi":  {"foreign": "+1,234억원", "institution": "-567억원", "retail": "-667억원"},
    "kosdaq": {"foreign": "-234억원",  "institution": "+123억원",  "retail": "+111억원"},
    "top_buys": [
      {"rank": 1, "name": "삼성전자",      "ticker": "005930", "foreign_net": "+1,234억원"},
      {"rank": 2, "name": "SK하이닉스",    "ticker": "000660", "foreign_net": "+456억원"}
    ],
    "top_sells": [
      {"rank": 1, "name": "LG에너지솔루션","ticker": "373220", "foreign_net": "-567억원"},
      {"rank": 2, "name": "현대차",        "ticker": "005380", "foreign_net": "-234억원"}
    ]
  },
  "sentiment": [
    {"name": "VIX (공포지수)",    "value": "18.5",  "change": "-1.2",   "change_pct": "-6.1%",  "signal": "안정"},
    {"name": "美 10년 국채금리",  "value": "4.35%", "change": "+0.05%", "change_pct": "",        "signal": "주의"},
    {"name": "WTI 유가",          "value": "$85.2", "change": "+$1.5",  "change_pct": "+1.8%",  "signal": "주의"},
    {"name": "금(Gold)",          "value": "$2,320","change": "+$15",   "change_pct": "+0.7%",  "signal": "안전"},
    {"name": "비트코인(BTC)",     "value": "$68,500","change": "+$1,200","change_pct": "+1.8%", "signal": "위험"}
  ],
  "kr_sectors": [
    {"name": "반도체", "change_pct": "+1.23%"},
    {"name": "자동차", "change_pct": "-0.45%"},
    {"name": "금융",   "change_pct": "+0.30%"},
    {"name": "바이오", "change_pct": "+2.10%"},
    {"name": "2차전지","change_pct": "-1.20%"},
    {"name": "게임",   "change_pct": "+0.80%"},
    {"name": "조선",   "change_pct": "+3.50%"},
    {"name": "건설",   "change_pct": "-0.60%"}
  ],
  "us_sectors": [
    {"name": "기술(XLK)",     "change_pct": "+1.50%"},
    {"name": "금융(XLF)",     "change_pct": "+0.80%"},
    {"name": "에너지(XLE)",   "change_pct": "-0.30%"},
    {"name": "헬스케어(XLV)", "change_pct": "+0.20%"},
    {"name": "소비재(XLY)",   "change_pct": "+1.10%"},
    {"name": "산업재(XLI)",   "change_pct": "+0.60%"},
    {"name": "소재(XLB)",     "change_pct": "-0.40%"},
    {"name": "필수소비(XLP)", "change_pct": "+0.10%"}
  ],
  "macro_headlines": [
    {
      "title": "Fed 금리 동결 결정 — 시장 기대 부합",
      "summary": "연준이 기준금리를 5.25-5.50%로 유지. 연내 1회 인하 전망 유지.",
      "url": "https://www.hankyung.com/article/...",
      "category": "금리",
      "importance": "high"
    },
    {
      "title": "중동 긴장 고조 — 호르무즈 해협 통항 우려",
      "summary": "이란-이스라엘 갈등 격화로 유가 급등 압력. WTI 배럴당 90달러 돌파.",
      "url": "https://www.hankyung.com/article/...",
      "category": "지정학",
      "importance": "high"
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

## Step 1.5: 시계열 데이터 수집 (차트용, 선택적)

Step 1 완료 후 차트 이미지 생성을 원하면 아래 데이터를 수집해 `merged_data.json`의 `timeseries` 필드에 추가하세요.
**수집이 어려우면 skip해도 보고서 생성에 지장 없습니다** (차트만 생략됨).

### 수집 대상 및 필드명

| 필드 키 | 심볼 | 출처 URL |
|---|---|---|
| `KOSPI_daily` | 코스피 7일 | `https://markets.hankyung.com/indices/kospi` |
| `KOSDAQ_daily` | 코스닥 7일 | `https://markets.hankyung.com/indices/kosdaq` |
| `SP500_daily` | S&P 500 7일 | `https://finance.yahoo.com/quote/%5EGSPC/history/` |
| `NASDAQ_daily` | 나스닥 7일 | `https://finance.yahoo.com/quote/%5EIXIC/history/` |
| `USD_KRW_daily` | 달러/원 7일 | `https://markets.hankyung.com/forex/USD` |

월요일에는 `*_weekly` (최근 4주), 매월 1일에는 `*_monthly` (최근 12개월) 키도 수집하세요.

### merged_data.json timeseries 필드 스키마

```json
{
  "timeseries": {
    "KOSPI_daily": [
      {"date": "04/15", "value": 2587.23},
      {"date": "04/16", "value": 2601.45},
      {"date": "04/17", "value": 2595.10}
    ],
    "KOSDAQ_daily": [...],
    "SP500_daily":  [...],
    "NASDAQ_daily": [...],
    "USD_KRW_daily":[...]
  }
}
```

> **주의:** `date`는 `MM/DD` 형식, `value`는 순수 숫자(쉼표·단위 없음).
> 주간(`weekly`) 키는 최근 4주 데이터(4개 포인트), 월간(`monthly`) 키는 최근 12개월(12개 포인트).

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
**3개 메시지를 순서대로** 발송합니다.

목표: 아침에 카톡 열자마자 **15초 안에** 오늘 투자 방향 파악.

---

### 메시지 1 — 시장 체온계

```
📊 {base_date} 장마감

🌡️ 오늘 시장 신호: {종합신호}

🇰🇷 코스피  {값}  {등락}
🇰🇷 코스닥  {값}  {등락}
🇺🇸 S&P500  {값}  {등락}
🇺🇸 나스닥  {값}  {등락}
💵 원달러   {값}  {등락}

⚠️ 핵심 변수: {오늘 가장 중요한 이벤트/이슈 1줄}
```

**종합신호 판정 규칙** (아래 5개 지표로 자동 계산):

| 지표 | 🟢 매수 유리 | 🟡 중립·관망 | 🔴 매도 유의 |
|---|---|---|---|
| VIX | <18 | 18~25 | >25 |
| 외국인 코스피 수급 | 순매수 | 혼조 | 순매도 |
| 원달러 환율 | <1,350 | 1,350~1,430 | >1,430 |
| 美 10년 국채금리 | <4.0% | 4.0~4.5% | >4.5% |
| 코스피 방향 | ▲ | 보합 | ▼ |

- 🟢 **매수 유리**: 4~5개 🟢
- 🟡 **중립·관망**: 3개 혼조 또는 🟢·🔴 혼재
- 🔴 **매도 유의**: 3개 이상 🔴

종합신호 뒤에 괄호로 행동 힌트 한 마디 추가:
- 🟢 매수 유리 (신규 진입 고려)
- 🟡 중립·관망 (분할 대응 / 현금 비중 유지)
- 🔴 매도 유의 (손절선 점검 / 신규 매수 보류)

---

### 메시지 2 — 오늘의 주목 포인트

수집 데이터에서 **가장 투자 판단에 영향 있는 것 3가지**를 골라 bullet로 작성.
각 항목은 **사실 → 투자 해석** 순서로 2줄 이내.

```
🔍 오늘 주목할 3가지

① {수급/섹터/거시 중 가장 임팩트 큰 것}
   → {투자자 관점 해석 — 어떤 행동을 고려할지}

② {워치리스트 상위 종목 또는 섹터 이슈}
   → {왜 주목해야 하는지}

③ {심리지표 또는 글로벌 이슈}
   → {한국 시장에 미치는 영향}
```

**선정 우선순위:**
1. 외국인 수급 방향 (3일 이상 연속이면 반드시 포함)
2. VIX 급변 또는 국채금리 급등
3. 오늘 급등락 섹터 (히트맵 기준 ±2% 이상)
4. 워치리스트 상위 종목 이슈
5. 거시 뉴스 importance=high

---

### 메시지 3 — 이번 주 캘린더

```
📅 이번 주 주요 일정

{MM/DD (요일)} {이모지} {이벤트명} — {한 줄 포인트}
...
(최대 4개, impact=높음 우선)

📄 상세 보고서: 증시조사-{YYYYMMDD}.docx
```

이벤트 이모지 기준:
- 🔥 FOMC·CPI·GDP 등 최상위 지표
- ⚡ 기업 실적발표·금통위
- 📌 그 외 경제 지표

---

### 발송 공통 규칙

- KakaoTalk MCP 도구가 없으면 조용히 skip (에러 출력 금지)
- 숫자는 원본 데이터 그대로 사용 (반올림·가공 금지)
- 등락 표시: 상승 `▲`, 하락 `▼`, 보합 `─`
- 메시지 간 0.5초 간격 (MCP 연속 호출 안정성)
- 각 메시지는 **500자 이내** 유지

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

## 버전 관리

이 플러그인은 **시맨틱 버저닝(SemVer)** `MAJOR.MINOR.PATCH`를 따릅니다.

| 버전 올리는 시점 | 유형 | 예시 |
|---|---|---|
| JSON 스키마 호환 불가 변경, CLI 인터페이스 변경 | **MAJOR** | `2.x.x → 3.0.0` |
| 신규 섹션·기능·선택적 스키마 필드 추가 | **MINOR** | `2.0.x → 2.1.0` |
| 버그 수정, 셀렉터 패치, 문서 수정 | **PATCH** | `2.1.x → 2.1.1` |

상세 규칙 → [docs/architecture/versioning.md](docs/architecture/versioning.md)  
변경 이력 → [docs/changelog/](docs/changelog/)

---

## 주의사항

- `finance.naver.com` 은 Claude in Chrome 보안 제한으로 직접 접근 불가 → 네이버 MCP로만 가능
- 데이터 크롤링은 실시간이 아닐 수 있으므로 보고서에 수집 시각 명시
- `docx` npm 패키지가 없으면 자동 설치 (인터넷 필요)
- 두 서브에이전트의 Agent() 호출은 **반드시 같은 메시지**에 포함 (병렬 실행의 핵심)
- 기업 뉴스 수집 시 접근 불가 페이지는 조용히 건너뛰고 빈 배열([])로 처리
- 뉴스 요약(news_summary)은 반드시 **한국어**로 작성 (미국 기업도 한국어 해석 포함)
