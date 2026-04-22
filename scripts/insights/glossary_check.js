/**
 * glossary_check.js
 * 보고서 텍스트에서 신규 용어를 감지하고 glossary.json / glossary.md를 업데이트합니다.
 *
 * 규칙:
 *   - 이미 등록된 용어: skip (재기록 금지)
 *   - 신규 용어: glossary.json 및 glossary.md에 추가
 *   - 보고서 부록에 "이번 호 신규 용어" 섹션 반환 (신규 용어 있을 때만)
 *
 * Usage:
 *   const { checkAndUpdateGlossary } = require('./glossary_check');
 *   const newTerms = checkAndUpdateGlossary(reportText, glossaryDir);
 */

'use strict';

const fs   = require('fs');
const path = require('path');

// 사전에 감지할 후보 용어 목록 (보고서 텍스트에서 매칭)
const CANDIDATE_TERMS = [
  { term: 'PER',        def: '주가수익비율. 주가 ÷ 주당 순이익.', related: ['PBR', 'ROE'] },
  { term: 'PBR',        def: '주가순자산비율. 주가 ÷ 주당 순자산.', related: ['PER', 'ROE'] },
  { term: 'ROE',        def: '자기자본이익률. 순이익 ÷ 자기자본 × 100.', related: ['PER', 'PBR'] },
  { term: 'VIX',        def: '변동성 지수(공포지수). 20 이하=안정, 25 이상=주의.', related: ['공포지수'] },
  { term: 'FOMC',       def: '미국 연방공개시장위원회. 연 8회 기준금리 결정.', related: ['연준', '금리'] },
  { term: 'CPI',        def: '소비자물가지수. 기준연도 대비 현재 물가 수준.', related: ['물가', '금리'] },
  { term: 'GDP',        def: '국내총생산. 1년간 생산된 재화·서비스 총가치.', related: ['경제성장률'] },
  { term: 'WTI',        def: '서부텍사스산 원유 기준 가격.', related: ['유가', '에너지'] },
  { term: 'ETF',        def: '상장지수펀드. 주식처럼 거래소에서 거래되는 펀드.', related: ['섹터'] },
  { term: 'S&P500',     def: '미국 주요 500개 기업 시가총액 가중 지수.', related: ['나스닥'] },
  { term: '코스피',     def: '한국 유가증권시장 종합주가지수.', related: ['코스닥'] },
  { term: '코스닥',     def: '한국 중소형·성장기업 중심 주식시장.', related: ['코스피'] },
  { term: '코스피200',  def: '코스피 상위 200종목으로 구성된 지수.', related: ['코스피'] },
  { term: '시가총액',   def: '주가 × 발행 주식 수 = 기업의 전체 시장가치.', related: ['코스피200'] },
  { term: '순매수',     def: '매수 금액이 매도 금액을 초과한 상태.', related: ['수급'] },
  { term: '외국인 순매수', def: '외국인 투자자가 국내 주식을 순매수한 금액.', related: ['수급'] },
  { term: '환율',       def: '서로 다른 나라 통화의 교환 비율.', related: ['USD/KRW'] },
  { term: '나스닥',     def: '미국 기술주 중심 주식시장.', related: ['S&P500'] },
  { term: '연준',       def: '미국 연방준비제도(중앙은행). 기준금리 결정 기관.', related: ['FOMC'] },
  { term: '섹터',       def: '주식 시장을 업종별로 분류한 그룹.', related: ['ETF'] },
];

/**
 * @param {string} reportText   보고서 전체 텍스트 (용어 감지용)
 * @param {string} glossaryDir  glossary.json / glossary.md 위치
 * @returns {{ term: string, def: string }[]} 이번 보고서에서 새로 발견된 용어 목록
 */
function checkAndUpdateGlossary(reportText, glossaryDir) {
  const jsonPath = path.join(glossaryDir, 'glossary.json');
  const mdPath   = path.join(glossaryDir, 'glossary.md');

  if (!fs.existsSync(glossaryDir)) fs.mkdirSync(glossaryDir, { recursive: true });

  // 기존 용어 로드
  let existing = [];
  if (fs.existsSync(jsonPath)) {
    try { existing = JSON.parse(fs.readFileSync(jsonPath, 'utf8')); }
    catch { existing = []; }
  }
  const existingTerms = new Set(existing.map(e => e.term.toLowerCase()));

  const today = new Date().toISOString().split('T')[0];
  const newTerms = [];

  for (const candidate of CANDIDATE_TERMS) {
    const termLower = candidate.term.toLowerCase();
    // 이미 등록된 용어는 skip
    if (existingTerms.has(termLower)) continue;
    // 보고서 텍스트에 이 용어가 등장하는지 확인
    if (!reportText.includes(candidate.term)) continue;

    // 신규 용어 발견
    newTerms.push(candidate);
    existing.push({ term: candidate.term, first_added: today, related: candidate.related });
    existingTerms.add(termLower);
  }

  if (newTerms.length === 0) return [];

  // glossary.json 업데이트
  fs.writeFileSync(jsonPath, JSON.stringify(existing, null, 2), 'utf8');

  // glossary.md 에 신규 용어 추가 (파일 끝에 append)
  const mdAppend = newTerms.map(t =>
    `\n### ${t.term} *(신규 ${today})*\n${t.def}\n**관련:** ${(t.related || []).join(', ')}\n`
  ).join('');
  fs.appendFileSync(mdPath, mdAppend, 'utf8');

  console.log(`[용어사전] 신규 용어 ${newTerms.length}개 추가: ${newTerms.map(t => t.term).join(', ')}`);
  return newTerms;
}

module.exports = { checkAndUpdateGlossary };
