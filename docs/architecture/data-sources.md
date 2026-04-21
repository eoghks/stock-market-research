# 데이터 소스 매핑

## 수집 소스 요약

| 데이터 | 소스 | 방식 | 비고 |
|--------|------|------|------|
| 한국 지수 (코스피/코스닥) | hankyung.com | Chrome 크롤링 | Naver MCP로 교차 검증 |
| 미국 지수 (다우·S&P500·나스닥) | hankyung.com/globalmarket | Chrome 크롤링 | |
| 글로벌 지수 (닛케이·항셍 등) | datacenter.hankyung.com/major-indices | Chrome 크롤링 | |
| 환율 5쌍 | datacenter.hankyung.com/currencies | Chrome 크롤링 | 실시간 아님 |
| 거시경제 지표 | datacenter.hankyung.com/indicators | Chrome 크롤링 | CPI, GDP, 실업률, 경상수지 |
| 한국 기업 뉴스 | hankyung.com/search?query= | Chrome 크롤링 | 동적, 최신 2~3개 |
| 미국 기업 뉴스 | hankyung.com/search?query= | Chrome 크롤링 | 고정 목록 10개 기업 |
| 네이버 금융 데이터 | finance.naver.com | Naver MCP | 선택적, 보완용 |
| 섹터별 등락률 (한국) | hankyung.com marketcap/industry | Chrome 크롤링 | v2 신규 |
| 섹터 ETF (미국) | Yahoo Finance 섹터 ETF | Chrome 크롤링 | v2 신규 |
| VIX, 美 금리, 원자재 | datacenter.hankyung.com | Chrome 크롤링 | v2 신규 |
| 이벤트 캘린더 | hankyung.com/economy/calendar | Chrome 크롤링 | v2 신규 |
| 거시 정세 뉴스 | hankyung.com/international, /economy | Chrome 크롤링 | v2 신규 |

---

## 출력 JSON 스키마

### `chrome_data.json` (기본 데이터)

```json
{
  "status": "collected",
  "source": "hankyung+mk",
  "collected_at": "<ISO 타임스탬프>",
  "base_date": "<장마감 날짜>",

  "macro_headlines": [
    {
      "title": "뉴스 제목",
      "summary": "한 줄 요약",
      "url": "https://...",
      "category": "전쟁|금리|유가|지정학|무역",
      "importance": "high|medium|low"
    }
  ],

  "kr_indices": [
    { "name": "코스피", "value": "2,590.48", "change": "-12.30", "change_pct": "-0.47%" }
  ],

  "kospi_detail": {
    "volume": "거래량",
    "amount": "거래대금",
    "open": "시가",
    "low": "저가",
    "foreign_net": "외국인 순매도",
    "high_52w": "52주 최고",
    "low_52w": "52주 최저"
  },

  "kospi_returns": [
    { "period": "1개월", "return_pct": "+3.2%" }
  ],

  "us_indices": [
    { "name": "다우존스", "value": "...", "change": "...", "change_pct": "..." }
  ],

  "global_indices": [
    { "name": "닛케이225", "value": "...", "change": "...", "change_pct": "..." }
  ],

  "fx_rates": [
    { "pair": "USD/KRW", "rate": "1,372.50", "change": "+2.30", "change_pct": "+0.17%" }
  ],

  "macro": [
    { "name": "CPI", "value": "113.60", "base": "2020=100", "status": "주의" }
  ],

  "kr_news": ["뉴스 헤드라인 1", "뉴스 헤드라인 2"],

  "us_news": [
    { "title": "뉴스 제목", "summary": "요약", "url": "https://..." }
  ],

  "kr_top10": [
    {
      "rank": 1,
      "name": "삼성전자",
      "code": "005930",
      "sector": "반도체",
      "price": "75,400",
      "market_cap": "450조",
      "news": [
        { "title": "제목", "summary": "요약", "url": "https://...", "investment_meaning": "투자자 관점 한국어 해석" }
      ]
    }
  ],

  "us_top10": [
    {
      "rank": 1,
      "name": "Apple",
      "ticker": "AAPL",
      "sector": "Technology",
      "price": "$189.50",
      "market_cap": "$2.9T",
      "news": [
        { "title": "제목", "summary": "요약", "url": "https://...", "investment_meaning": "한국 투자자 관점 해석" }
      ]
    }
  ],

  "company_overall_summary": "한·미 시총 상위 기업 뉴스 종합 (3~5문장)",

  "sector_kr": [
    { "name": "반도체", "change_pct": "+1.2%" }
  ],

  "sector_us": [
    { "name": "Technology (XLK)", "change_pct": "+0.8%" }
  ],

  "flow_kr": {
    "kospi": { "foreign": "+2,340억", "institution": "-1,200억", "retail": "-1,140억" },
    "kosdaq": { "foreign": "+450억", "institution": "-200억", "retail": "-250억" },
    "top_buy": [{ "name": "삼성전자", "foreign_net": "+850억" }],
    "top_sell": [{ "name": "SK하이닉스", "foreign_net": "-320억" }]
  },

  "sentiment": {
    "vix": { "value": "18.5", "change": "-0.3" },
    "us_10y": { "value": "4.32%", "change": "+0.05%" },
    "wti": { "value": "$78.20", "change": "+1.10" },
    "gold": { "value": "$2,340", "change": "-8.00" },
    "btc": { "value": "$68,500", "change": "+1,200" }
  },

  "events": [
    { "date": "2026-04-22", "region": "미국", "event": "FOMC 의사록", "impact": "high" }
  ],

  "watchlist_kr": [
    { "name": "종목명", "code": "000000", "reason": "주목 이유", "news_url": "https://..." }
  ],

  "watchlist_us": [
    { "name": "NVIDIA", "ticker": "NVDA", "reason": "주목 이유", "news_url": "https://..." }
  ]
}
```

---

## 접근 제한 및 Fallback

| 상황 | 처리 방식 |
|------|----------|
| finance.naver.com 접근 불가 | Naver MCP 사용 또는 skip |
| 시총 10위 크롤링 실패 | `DEFAULT_KR_TOP10`, `DEFAULT_US_TOP10` 고정 목록 사용 |
| 개별 뉴스 접근 불가 | 빈 배열 처리, 조용히 건너뜀 |
| URL 수집 실패 | `url: null`, 렌더링 시 평문으로 fallback |
