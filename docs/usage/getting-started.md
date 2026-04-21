# 빠른 시작 가이드

## 사전 요구사항

| 항목 | 버전 | 확인 명령 |
|------|------|-----------|
| Node.js | v18 이상 | `node -v` |
| Claude Code | 최신 | `claude -v` |
| Claude in Chrome MCP | 활성화 | Claude Code 설정에서 확인 |
| LibreOffice (PDF용) | 선택사항 | `soffice --version` |

## 설치

```bash
# 1. Claude Code 플러그인 등록
# ~/.claude/skills/ 또는 플러그인 마켓플레이스에서 설치

# 2. Node 의존성 (generate_report.js 최초 실행 시 자동 설치)
cd stock-market-research/scripts
npm install docx chartjs-node-canvas chart.js

# 3. LibreOffice 설치 (PDF 출력 원할 경우)
# → docs/usage/pdf-setup.md 참고
```

## 실행 방법

Claude Code에서 아래처럼 요청합니다:

```
한국 미국 증시 조사해줘
```

또는 스킬 직접 호출:
```
/stock-market-research
```

## 파이프라인 흐름

```
Step 1 (병렬)
  ├─ Claude in Chrome → hankyung.com 크롤링 → chrome_data.json
  └─ Naver MCP (있으면) → naver_data.json

Step 2: 데이터 통합 → merged_data.json

Step 3: 보고서 생성
  ├─ node scripts/generate_report.js → 증시조사-YYYYMMDD-HHMM.docx
  └─ LibreOffice (있으면) → 증시조사-YYYYMMDD-HHMM.pdf

Step 4 (선택): KakaoTalk MCP → 8개 메시지 발송
```

## 출력 파일

| 파일 | 설명 |
|------|------|
| `증시 조사-YYYYMMDD-HHMM.docx` | Word 보고서 (항상 생성) |
| `증시 조사-YYYYMMDD-HHMM.pdf` | PDF 보고서 (LibreOffice 설치 시) |
| `chrome_data.json` | 크롤링 원본 데이터 (임시, gitignore) |
| `naver_data.json` | Naver 보완 데이터 (임시, gitignore) |
| `merged_data.json` | 통합 데이터 (임시, gitignore) |

## 차트 생성 규칙

| 차트 | 생성 조건 | 기간 |
|------|-----------|------|
| 일일 차트 | 매일 | 최근 7거래일 |
| 주간 차트 | 월요일만 | 최근 4주 |
| 월간 차트 | 매월 1일만 | 최근 1년 (월별) |

## 의존성 목록

```json
{
  "dependencies": {
    "docx": "^8.x",
    "chartjs-node-canvas": "^4.x",
    "chart.js": "^4.x"
  }
}
```

> 문제가 발생하면 [troubleshooting.md](troubleshooting.md) 를 참고하세요.
