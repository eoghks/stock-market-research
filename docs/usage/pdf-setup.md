# PDF 변환 설정 (LibreOffice)

보고서를 DOCX와 PDF 모두 생성하려면 **LibreOffice** (무료·오픈소스)가 필요합니다.

## Windows 설치

### 방법 1 — winget (권장, 터미널에서 1줄)

```powershell
winget install TheDocumentFoundation.LibreOffice
```

### 방법 2 — 직접 다운로드

1. https://www.libreoffice.org/download/libreoffice-fresh/ 접속
2. Windows 버전 다운로드 및 설치
3. 기본 경로: `C:\Program Files\LibreOffice\`

## PATH 등록

설치 후 터미널에서 `soffice` 명령이 인식되지 않으면 PATH를 추가합니다.

**PowerShell (현재 세션만):**
```powershell
$env:PATH += ";C:\Program Files\LibreOffice\program"
```

**영구 등록 (시스템 환경변수):**
1. `Win + R` → `sysdm.cpl` → 고급 탭 → 환경 변수
2. 시스템 변수 `Path` 편집
3. `C:\Program Files\LibreOffice\program` 추가
4. 터미널 재시작

## 설치 확인

```bash
soffice --version
# 출력 예: LibreOffice 25.2.2.2 (x86_64)
```

## 동작 방식

`generate_report.js` 실행 시 자동으로 PDF 변환을 시도합니다:

```
증시조사-20260422-1430.docx  →  generate_report.js  →  증시조사-20260422-1430.pdf
```

- LibreOffice 설치됨 → DOCX + PDF 모두 생성
- LibreOffice 미설치 → DOCX만 생성 (경고 메시지 출력, 오류 아님)

## 수동 변환

```bash
# 단독 실행
node scripts/pdf/convert_to_pdf.js "증시 조사-20260422-1430.docx"

# 출력 디렉토리 지정
node scripts/pdf/convert_to_pdf.js input.docx ./output/
```

## 문제 해결

| 증상 | 해결 |
|------|------|
| `soffice: command not found` | PATH 등록 후 터미널 재시작 |
| 변환 중 멈춤 | LibreOffice 기존 프로세스 종료: `taskkill /F /IM soffice.exe` |
| 한글 깨짐 | LibreOffice 언어팩(Korean) 설치 |
| 변환 실패 (방화벽) | LibreOffice를 방화벽 예외에 추가 |
