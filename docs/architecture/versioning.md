# 버전 관리 정책 (Semantic Versioning)

이 플러그인은 **시맨틱 버저닝(SemVer) `MAJOR.MINOR.PATCH`** 규칙을 따릅니다.

---

## 버전 번호 체계

```
  2   .   1   .   3
  │       │       └── PATCH: 버그 수정, 오탈자, 내부 리팩터링
  │       └────────── MINOR: 신규 기능 추가 (하위 호환)
  └────────────────── MAJOR: 파괴적 변경 (스키마 호환 불가)
```

### MAJOR (예: `2.x.x → 3.0.0`)
하위 호환이 **불가능**한 변경일 때 올립니다.
- `merged_data.json` 필수 필드 삭제·타입 변경
- SKILL.md Step 구조 전면 개편 (기존 크롤링 에이전트 재작성 필요)
- `generate_report.js` CLI 인터페이스 변경 (인수 순서·이름)

### MINOR (예: `2.0.x → 2.1.0`)
하위 호환을 유지하면서 **신규 기능**이 추가될 때 올립니다.
- JSON 스키마에 선택적 필드 추가
- 새로운 보고서 섹션 추가
- 새로운 차트·시각화 추가
- 새로운 크롤링 URL 추가

### PATCH (예: `2.1.x → 2.1.1`)
기능 변경 없이 **결함을 수정**할 때 올립니다.
- 크롤링 셀렉터 오류 수정
- 렌더링 버그 패치
- 문서 오탈자·설명 개선
- 의존성 패치 업데이트

---

## 버전 관리 절차

```
# 1. 새 브랜치 생성
git checkout -b feat/my-feature        # MINOR
git checkout -b fix/my-bugfix          # PATCH
git checkout -b breaking/my-change     # MAJOR

# 2. 작업 후 커밋

# 3. 버전 범프 (scripts/package.json)
#    MAJOR: 3.0.0  /  MINOR: 2.1.0  /  PATCH: 2.0.1

# 4. changelog 파일 생성
#    docs/changelog/v2.1.0.md  또는  v2.0.1.md

# 5. SKILL.md 버전 표기 업데이트
#    # 📈 증시 조사 보고서 자동 생성 스킬 (v2.1.0)

# 6. main 머지 + 태그
git checkout main
git merge feat/my-feature
git tag -a v2.1.0 -m "v2.1.0 — 기능 설명"
git push origin main --tags
```

---

## changelog 파일 명명 규칙

```
docs/changelog/
├── v2.0.0.md    # 현재 릴리즈
├── v2.1.0.md    # 다음 MINOR
├── v2.1.1.md    # 다음 PATCH
└── v3.0.0.md    # 다음 MAJOR
```

각 changelog 파일은 아래 섹션을 포함합니다:

```markdown
# vX.Y.Z 변경 사항 (YYYY-MM-DD)

## 신규 기능 (MINOR)
## 버그 수정 (PATCH)  
## 파괴적 변경 (MAJOR)
## JSON 스키마 변경
## 의존성 변경
## 마이그레이션 가이드 (MAJOR일 때만)
```

---

## 현재 릴리즈 이력

| 버전 | 날짜 | 유형 | 주요 변경 |
|---|---|---|---|
| `v2.0.0` | 2026-04-22 | MAJOR | v1 → v2 전면 업그레이드 (18개 Phase) |

---

## 브랜치 전략

| 브랜치 접두사 | 용도 | 예시 |
|---|---|---|
| `feat/` | MINOR 기능 추가 | `feat/sector-heatmap` |
| `fix/` | PATCH 버그 수정 | `fix/crawl-selector` |
| `breaking/` | MAJOR 파괴적 변경 | `breaking/schema-v3` |
| `docs/` | 문서만 변경 (버전 불변) | `docs/update-readme` |
| `chore/` | 빌드·설정만 변경 (버전 불변) | `chore/update-deps` |
