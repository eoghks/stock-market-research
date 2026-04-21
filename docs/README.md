# 📁 docs — 문서 인덱스

stock-market-research 플러그인의 모든 문서는 이 폴더에 보관됩니다.

## 폴더 구조

| 폴더 | 용도 |
|------|------|
| `architecture/` | 파이프라인 구조, 데이터 소스, 섹션 설계 |
| `usage/` | 시작 가이드, 옵션, 문제 해결 |
| `changelog/` | 버전별 변경 이력 |
| `glossary/` | 용어 사전 (누적 관리, 중복 금지) |
| `reports/` | 생성된 보고서 로컬 보관 (git 제외) |

## 문서 명명 규칙

```
docs/{카테고리}/{kebab-case-제목}.md
```

예시:
- `docs/architecture/pipeline.md`
- `docs/usage/getting-started.md`
- `docs/changelog/v2.0.0.md`

## 문서 작성 규칙

1. **이 폴더에 저장:** 플러그인 관련 모든 문서는 반드시 `docs/` 하위에 저장
2. **중복 금지:** 동일 내용은 하나의 파일에만 작성, 참조 시 링크 사용
3. **용어 사전:** `docs/glossary/glossary.md` 에 누적 관리 — 한 번 등록한 용어는 재기록 X
4. **보고서:** `docs/reports/` 는 로컬 보관 전용 (`.gitignore` 적용됨)

## 문서 목록

### architecture/
- [`pipeline.md`](architecture/pipeline.md) — 4단계 수집→통합→생성→발송 파이프라인
- [`data-sources.md`](architecture/data-sources.md) — 수집 URL 및 데이터 매핑
- [`report-sections.md`](architecture/report-sections.md) — 보고서 섹션 구조와 헬퍼 함수

### usage/
- [`getting-started.md`](usage/getting-started.md) — 빠른 시작 가이드
- [`troubleshooting.md`](usage/troubleshooting.md) — 자주 발생하는 문제 해결
- [`pdf-setup.md`](usage/pdf-setup.md) — LibreOffice 설치 및 PDF 변환 설정

### changelog/
- [`v2.0.0.md`](changelog/v2.0.0.md) — v2 전체 변경 이력

### glossary/
- [`glossary.md`](glossary/glossary.md) — 투자 용어 사전
