# 보고서 섹션 구조 및 헬퍼 함수

## 보고서 섹션 순서 (v2)

| # | 섹션 | 파일 위치 | 비고 |
|---|------|-----------|------|
| 0 | 표지 | generate_report.js | 제목, 기준일, 핵심 지표 3개 |
| 1 | 오늘의 핵심 (AI 인사이트) | generate_report.js | v2 신규. 데이터 종합 3줄 |
| 2 | 글로벌 거시 정세 | generate_report.js | v2 신규. 한국/미국 장 앞에 배치 |
| 3 | 시장 심리 패널 | generate_report.js | v2 신규. VIX·금리·원자재 |
| 4 | 한국 증시 | generate_report.js | 코스피/코스닥 + 수급 + 섹터 히트맵 |
| 5 | 미국 증시 | generate_report.js | 3대 지수 + 섹터 히트맵 |
| 6 | 글로벌 지수 | generate_report.js | 아시아·유럽 주요국 |
| 7 | 환율 | generate_report.js | 5개 통화쌍 + 초보자 설명 |
| 8 | 거시경제 지표 | generate_report.js | CPI·GDP·실업률·경상수지 |
| 9 | 이번주 이벤트 캘린더 | generate_report.js | v2 신규. FOMC·실적발표 등 |
| 10 | 한국 시총 10위 기업 | generate_report.js | 뉴스 카드 + 투자 의미 |
| 11 | 주의깊게 볼만한 기업 (한국) | generate_report.js | v2 신규. 워치리스트 |
| 12 | 미국 시총 10위 기업 | generate_report.js | 뉴스 카드 + 한국 투자자 관점 |
| 13 | 주의깊게 볼만한 기업 (미국) | generate_report.js | v2 신규. 워치리스트 |
| 14 | 종합 결론 | generate_report.js | 핵심 시사점 + 체크리스트 |
| 15 | 용어 사전 부록 | generate_report.js | v2 신규. 신규 용어만 표시 |

---

## 헬퍼 함수 레퍼런스 (`scripts/generate_report.js`)

### 셀 생성 함수

| 함수 | 용도 | 주요 옵션 |
|------|------|-----------|
| `hCell(text)` | 헤더 셀 | 진파랑 배경(#1F4E79), 흰색 텍스트, 굵음 |
| `dCell(text, opts)` | 데이터 셀 | `bold`, `color`, `align`, `bg` |
| `chgCell(text)` | 변화율 셀 | `+` → 빨강(#C00000), `-` → 파랑(#1F4E79) 자동 |
| `multiCell(lines)` | 다중행 셀 | 줄바꿈 처리, 초보자 설명용 |

### 박스 생성 함수

| 함수 | 용도 | 스타일 |
|------|------|--------|
| `infoBox(title, text)` | 노란색 설명 박스 | 배경 #FFFBF0, 테두리 #F0B429 |
| `statusBox(text, type)` | 상태 박스 | `type='green'` → 초록, `type='red'` → 빨강 |

### 테이블 생성 함수

| 함수 | 용도 | 열 구성 |
|------|------|--------|
| `indexTable(indices)` | 지수 테이블 | 지수명·현재가·전일비·등락률 (4열) |
| `kospiDetailTable(detail)` | 코스피 상세 | 8개 항목 2열 배치 |
| `returnTable(returns)` | 기간별 수익률 | 기간·수익률 (2열) |
| `fxDetailTable(rates)` | 환율 상세 | 통화쌍·환율·전일비·등락률·설명·의미 (6열) |
| `macroTable(macro)` | 거시경제 | 지표명·수치·기준·설명·의미 (5열) |

### 카드 생성 함수

| 함수 | 용도 | 레이아웃 |
|------|------|--------|
| `companyCard(company)` | 기업 뉴스 카드 | 헤더 + 2열(뉴스 + 투자 의미) |

---

## 디자인 시스템

### 색상 토큰

```js
const COLORS = {
  primary:    '1F4E79',  // 진파랑 — 헤더, 하락
  rise:       'C00000',  // 빨강 — 상승
  fall:       '1F4E79',  // 파랑 — 하락 (primary와 동일)
  neutral:    '595959',  // 회색 — 중립 텍스트
  bg_light:   'F2F7FF',  // 연청 — 짝수 행 배경
  bg_white:   'FFFFFF',  // 흰색 — 홀수 행 배경
  info_bg:    'FFFBF0',  // 노란 — infoBox 배경
  info_border:'F0B429',  // 주황 — infoBox 테두리
  card_a_bg:  'EFF5FF',  // 회청 — 카드 뉴스 열 배경
  card_b_bg:  'F0FFF4',  // 연초 — 카드 의미 열 배경
};
```

### 내장 설명 데이터

**`FX_EXPLAIN`** — 환율 5개 통화쌍별 초보자 설명:
- USD/KRW, JPY/KRW, CNY/KRW, EUR/KRW, HKD/KRW
- 각각: "무엇인가요?" (2줄) + "현재 수치의 의미" (2줄)

**`MACRO_EXPLAIN`** — 거시경제 4개 지표별 설명:
- CPI, GDP, 실업률, 경상수지
- 각각: "무엇인가요?" (2줄) + "현재 수치의 의미" (2줄)

### Fallback 기본값

```js
DEFAULT_KR_ISSUES     // 한국 증시 이슈 3개 (크롤링 실패 시)
DEFAULT_US_ISSUES     // 미국 증시 이슈 3개 (크롤링 실패 시)
DEFAULT_CONCLUSIONS   // 종합 결론 5개 (크롤링 실패 시)
DEFAULT_KR_TOP10      // 한국 시총 10위 기업 고정 목록
DEFAULT_US_TOP10      // 미국 시총 10위 기업 고정 목록
```

---

## 문서 설정

| 항목 | 값 |
|------|-----|
| 페이지 크기 | A4 (12240 × 15840 twips) |
| 여백 | 1440 (1인치) 상하좌우 |
| 헤더 | 문서 제목 + 기준일 |
| 푸터 | 페이지 번호 |
| Heading 1 | 36pt, 진파랑, 굵음 |
| Heading 2 | 28pt, 진파랑 |
| 본문 | 22pt, 행간 1.3 |

---

## 실행 명령

```bash
# 기본 실행
node scripts/generate_report.js merged_data.json 증시조사-output.docx

# 커스텀 node_modules 경로
node scripts/generate_report.js data.json out.docx /custom/node_modules

# 테스트 (샘플 데이터)
node scripts/generate_report.js test_data_v2.json test_output_v3.docx
```
