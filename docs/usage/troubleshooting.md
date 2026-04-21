# 문제 해결 가이드

## 자주 발생하는 문제

---

### 1. `finance.naver.com` 접근 불가

**증상:** Naver MCP 없이 Claude in Chrome으로 네이버 금융 접근 시도 시 실패

**원인:** Claude in Chrome 보안 정책으로 `finance.naver.com` 직접 크롤링 불가

**해결:**
- Naver MCP가 설치·활성화된 경우 자동으로 Naver MCP 경로 사용
- Naver MCP 없으면 자동 skip — 한국경제신문 데이터만으로 보고서 생성
- 네이버 데이터가 꼭 필요하다면 Naver MCP 설치 후 Claude Code에 등록

---

### 2. 시총 10위 기업 크롤링 실패

**증상:** `markets.hankyung.com/index-info/marketcap` 접근 불가 또는 데이터 파싱 실패

**원인:** 페이지 구조 변경 또는 일시적 접근 제한

**해결:** 자동 fallback — 코드 내 `DEFAULT_KR_TOP10`, `DEFAULT_US_TOP10` 고정 목록 사용

```js
// scripts/generate_report.js 내 기본 목록
const DEFAULT_KR_TOP10 = ['삼성전자', 'SK하이닉스', 'LG에너지솔루션', ...];
const DEFAULT_US_TOP10 = ['Apple', 'Microsoft', 'NVIDIA', 'Amazon', ...];
```

---

### 3. `docx` 패키지 설치 실패

**증상:** `Cannot find module 'docx'` 오류

**해결:**
```bash
cd stock-market-research/scripts
npm install docx
# 또는
npm install --prefix . docx
```

인터넷 연결 확인 후 재시도. 프록시 환경:
```bash
npm install --proxy http://proxy:port docx
```

---

### 4. `chartjs-node-canvas` 설치 오류

**증상:** `node-gyp` 빌드 실패 (Windows)

**원인:** Canvas 네이티브 모듈 컴파일 실패

**해결:**
```bash
# Visual Studio Build Tools 설치 (없는 경우)
npm install --global windows-build-tools

# 또는 prebuilt 바이너리 사용
npm install --ignore-scripts chartjs-node-canvas
```

---

### 5. PDF 변환 실패 (`soffice not found`)

**증상:** `LibreOffice를 찾을 수 없습니다` 또는 `soffice: command not found`

**해결:** [pdf-setup.md](pdf-setup.md) 참고

---

### 6. 뉴스 URL 수집 안 됨

**증상:** 뉴스 제목은 나오지만 링크가 없음

**동작:** 정상 — URL 수집 실패 시 자동으로 평문 텍스트로 fallback. 데이터 손실 없음

---

### 7. 차트 이미지가 보고서에 안 들어감

**증상:** 그래프 섹션이 비어있거나 "차트 생성 불가" 메시지

**원인 체크:**
- 데이터 소스(한국경제 datacenter)에서 시계열 데이터 수집 가능 여부 확인
- `chartjs-node-canvas` 설치 여부 확인: `node -e "require('chartjs-node-canvas')"`
- 주간/월간 차트는 각각 월요일/매월 1일에만 생성 (의도된 동작)

---

### 8. 보고서 생성 중 한글 깨짐

**증상:** docx 열었을 때 한글이 □□□ 또는 물음표

**해결:**
- Word 또는 LibreOffice Writer로 파일 열기 (메모장 X)
- 폰트가 없는 경우: 시스템에 맑은 고딕 또는 나눔고딕 설치

---

### 9. 카카오톡 발송 안 됨

**증상:** 보고서는 생성되는데 카카오톡 메시지 없음

**원인:** KakaoTalk MCP 미활성화 상태

**동작:** 정상 — KakaoTalk MCP가 없으면 발송 단계 자동 skip. 보고서 파일은 정상 생성됨

---

## 로그 확인

보고서 생성 실패 시 상세 로그:

```bash
node scripts/generate_report.js test_data_v2.json test_output.docx 2>&1 | head -50
```

데이터 수집 단계 문제는 `chrome_data.json` 파일 직접 확인:
```bash
cat chrome_data.json | node -e "const d=require('fs').readFileSync('/dev/stdin','utf8'); console.log(JSON.stringify(JSON.parse(d), null, 2))" | head -100
```
