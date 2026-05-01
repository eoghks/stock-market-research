#!/usr/bin/env node
/**
 * generate_report.js
 *
 * Usage: node generate_report.js <data.json> <output.docx> [node_modules_dir]
 *
 * Generates a comprehensive Korean/US stock market Word report
 * from structured JSON data collected by the stock-market-research skill.
 * v2: Added Korea & US top-10 market-cap company news sections (6, 7)
 */

const dataPath   = process.argv[2];
const outputPath = process.argv[3];
const modulesDir = process.argv[4]; // optional: custom node_modules path

if (!dataPath || !outputPath) {
  console.error('Usage: node generate_report.js <data.json> <output.docx> [node_modules_dir]');
  process.exit(1);
}

// Allow custom node_modules path
if (modulesDir) {
  const Module = require('module');
  const origResolve = Module._resolveFilename.bind(Module);
  Module._resolveFilename = (req, parent, isMain, opts) => {
    try { return origResolve(req, parent, isMain, opts); }
    catch(e) {
      const path = require('path');
      return origResolve(path.join(modulesDir, 'node_modules', req), parent, isMain, opts);
    }
  };
  require('module').globalPaths.unshift(require('path').join(modulesDir, 'node_modules'));
}

const {
  Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell,
  Header, Footer, AlignmentType, HeadingLevel, BorderStyle, WidthType,
  ShadingType, VerticalAlign, PageNumber, LevelFormat, TableOfContents,
  PageBreak, ExternalHyperlink, ImageRun
} = require('docx');
const fs   = require('fs');
const path = require('path');

// ── 차트 모듈 로드 ─────────────────────────────────────────────────────────
let prepareChartData, renderLineChart, getChartSchedule;
try {
  ({ prepareChartData } = require(path.join(__dirname, 'charts', 'fetch_timeseries.js')));
  ({ renderLineChart }  = require(path.join(__dirname, 'charts', 'render_chart.js')));
  ({ getChartSchedule } = require(path.join(__dirname, 'charts', 'schedule.js')));
} catch (e) {
  console.warn('[차트] 차트 모듈 로드 실패 (차트 없이 계속):', e.message);
}

let renderHeatmap;
try {
  ({ renderHeatmap } = require(path.join(__dirname, 'charts', 'render_heatmap.js')));
} catch (e) {
  console.warn('[히트맵] 히트맵 모듈 로드 실패 (히트맵 없이 계속):', e.message);
}

let checkAndUpdateGlossary;
try {
  ({ checkAndUpdateGlossary } = require(path.join(__dirname, 'insights', 'glossary_check.js')));
} catch (e) {
  console.warn('[용어사전] 모듈 로드 실패 (용어사전 없이 계속):', e.message);
}

// ── 데이터 로드 ──────────────────────────────────────────────────────────────
const raw  = JSON.parse(fs.readFileSync(dataPath, 'utf8'));

// ── 시장 세션 날짜 계산 (KST 기준) ───────────────────────────────────────────
// KST = UTC+9. 스크립트는 어느 환경에서나 KST 기준으로 날짜를 계산합니다.
const _nowUtcMs = Date.now();
const _kstNow   = new Date(_nowUtcMs + 9 * 3600 * 1000); // UTC → KST
const pad  = n => String(n).padStart(2, '0');
const _kstH = _kstNow.getUTCHours();   // KST 현재 시
const _kstM = _kstNow.getUTCMinutes(); // KST 현재 분

// 날짜 포맷 헬퍼
function _kstDateStr(d) {
  const days = ['일','월','화','수','목','금','토'];
  return `${d.getUTCFullYear()}년 ${pad(d.getUTCMonth()+1)}월 ${pad(d.getUTCDate())}일(${days[d.getUTCDay()]})`;
}
function _addDays(d, n) {
  return new Date(d.getTime() + n * 86400000);
}

// 한국 장: 09:00~15:30 KST
// 15:30 이후 → 오늘 마감 세션 / 09:00 이전 → 전일 세션
const _krToday   = new Date(_kstNow);
_krToday.setUTCHours(0,0,0,0); // KST 자정
const _krSession = (_kstH > 15 || (_kstH === 15 && _kstM >= 30)) ? _krToday
                 : (_kstH < 9)                                     ? _addDays(_krToday, -1)
                 : _krToday; // 장중

// 미국 장: 09:30~16:00 ET = 23:30~06:00 KST(익일)
// KST 06:00 이후 → 오늘 새벽에 마감된 미국 세션(= 어제 ET 날짜)
// KST 06:00 이전 → 전날 새벽에 마감된 미국 세션(= 2일 전 ET 날짜)
const _usSession = _kstH >= 6 ? _addDays(_krToday, -1) : _addDays(_krToday, -2);

const KR_SESSION_DATE = _kstDateStr(_krSession); // 한국 장 기준일
const US_SESSION_DATE = _kstDateStr(_usSession); // 미국 장 기준일 (ET 날짜)

// ── 폰트 상수 — 한글+영문 모두 지원하는 Malgun Gothic 사용 ─────────────────
// Arial은 한글 글리프가 없어 LibreOffice PDF 변환 시 글자 깨짐 발생
const FONT = 'Malgun Gothic';

const now  = _kstNow; // 하위 코드 호환
const REPORT_DATE = `${_krToday.getUTCFullYear()}년 ${pad(_krToday.getUTCMonth()+1)}월 ${pad(_krToday.getUTCDate())}일`;
const REPORT_TIME = `${pad(_kstH)}${pad(_kstM)}`;
const BASE_DATE   = KR_SESSION_DATE; // raw.base_date 무시 — 항상 실행시각 기준
const SOURCES     = (raw.meta?.sources || ['한국경제신문(hankyung.com)', '매일경제 마켓(stock.mk.co.kr)']).join(' · ');
const NAVER_OK    = raw.naver_verified === true;

const kr_indices    = raw.kr_indices    || [];
const us_indices    = raw.us_indices    || [];
const global_idx    = raw.global_indices|| [];
const fx_rates      = raw.fx_rates      || [];
const macro         = raw.macro         || [];
const kospi_detail  = raw.kospi_detail  || {};
const kospi_returns = raw.kospi_returns || [];
const kr_news       = raw.kr_news       || [];
const us_news       = raw.us_news       || [];
const kr_issues     = raw.kr_issues     || kr_news.slice(0, 5);
const us_issues     = raw.us_issues     || us_news.slice(0, 5);
const conclusions   = raw.conclusions   || [];
const kr_top10          = raw.kr_top10          || [];
const us_top10          = raw.us_top10          || [];
const co_summary        = raw.company_overall_summary || '';
const macro_headlines   = raw.macro_headlines   || [];
const kr_sectors        = raw.kr_sectors        || [];
const us_sectors        = raw.us_sectors        || [];
const flow_data         = raw.flow_data         || {};   // Phase 11: 수급
const sentiment         = raw.sentiment         || [];   // Phase 12: 심리 패널
const event_calendar    = raw.event_calendar    || [];   // Phase 13: 이벤트 캘린더
const watchlist         = raw.watchlist         || {};   // Phase 14: 워치리스트
const daily_insight     = raw.daily_insight     || [];   // Phase 15: AI 인사이트 3줄

// ── 섹션 투자 신호 사전 계산 ─────────────────────────────────────────────────
function _sig(val) {
  // 숫자 문자열에서 ▲/▼/+/- 제거해 부호 판별
  const s = String(val || '');
  if (s.startsWith('+') || s.startsWith('▲')) return 'green';
  if (s.startsWith('-') || s.startsWith('▼')) return 'red';
  return 'yellow';
}
const _SEC_SIGNAL = (() => {
  // VIX
  const vixItem  = sentiment.find(s => (s.name||'').includes('VIX'));
  const vixNum   = vixItem ? parseFloat(vixItem.value) : NaN;
  const vixSig   = isNaN(vixNum) ? 'yellow' : vixNum < 18 ? 'green' : vixNum > 25 ? 'red' : 'yellow';

  // 외국인 코스피 수급
  const flowFgn  = (flow_data.kospi || {}).foreign || '';
  const flowSig  = flowFgn.startsWith('+') ? 'green' : flowFgn.startsWith('-') ? 'red' : 'yellow';

  // USD/KRW
  const usdItem  = fx_rates.find(r => r.pair === 'USD/KRW');
  const usdNum   = usdItem ? parseFloat(String(usdItem.rate).replace(/,/g,'')) : NaN;
  const fxSig    = isNaN(usdNum) ? 'yellow' : usdNum < 1350 ? 'green' : usdNum > 1430 ? 'red' : 'yellow';

  // 美 10년 국채
  const bondItem = sentiment.find(s => (s.name||'').includes('국채'));
  const bondNum  = bondItem ? parseFloat(bondItem.value) : NaN;
  const bondSig  = isNaN(bondNum) ? 'yellow' : bondNum < 4.0 ? 'green' : bondNum > 4.5 ? 'red' : 'yellow';

  // 코스피 방향
  const kospiItem = kr_indices.find(r => (r.name||'').includes('코스피'));
  const kospiSig  = _sig(kospiItem ? kospiItem.change_pct : '');

  // 미국 S&P500 방향
  const sp500Item = us_indices.find(r => (r.name||'').includes('S&P') || (r.name||'').includes('S&amp;P'));
  const usSig     = _sig(sp500Item ? sp500Item.change_pct : '');

  // 종합 (5개 지표 중 🟢/🔴 개수)
  const all   = [vixSig, flowSig, fxSig, bondSig, kospiSig];
  const green = all.filter(s => s === 'green').length;
  const red   = all.filter(s => s === 'red').length;
  const overall = green >= 4 ? 'green' : red >= 3 ? 'red' : 'yellow';

  return { vixSig, flowSig, fxSig, bondSig, kospiSig, usSig, fxSig, overall };
})();

// ── 디자인 토큰 ──────────────────────────────────────────────────────────────
const COLORS = {
  primary:     '1F4E79',  // 진파랑 — 헤더, 주색상
  rise:        'C00000',  // 빨강 — 상승
  fall:        '1F4E79',  // 파랑 — 하락
  neutral:     '595959',  // 회색 — 보조 텍스트
  text:        '1A1A1A',  // 거의 검정 — 본문
  bg_stripe:   'F2F7FF',  // 연청 — 짝수 행 배경
  bg_white:    'FFFFFF',  // 흰색
  info_bg:     'FFFBF0',  // 노란 — infoBox 배경
  info_border: 'F0B429',  // 주황 — infoBox 테두리
  card_news:   'EFF5FF',  // 회청 — 카드 뉴스 열
  card_mean:   'F0FFF4',  // 연초 — 카드 의미 열
  cover_kpi:   'E8F0FE',  // 연청 — 표지 KPI 카드 배경
  summary_bg:  'F7F9FC',  // 아주 연한 회청 — 섹션 요약 박스
  summary_bdr: '90B4D6',  // 중간 파랑 — 요약 박스 테두리
};

// ── 공통 스타일 헬퍼 ─────────────────────────────────────────────────────────
const FULL_WIDTH = 9360;
const bdr  = { style: BorderStyle.SINGLE, size: 1, color: 'CCCCCC' };
const bdrs = { top: bdr, bottom: bdr, left: bdr, right: bdr };

function hCell(text, w) {
  return new TableCell({
    borders: bdrs, width: { size: w, type: WidthType.DXA },
    shading: { fill: COLORS.primary, type: ShadingType.CLEAR },
    margins: { top: 100, bottom: 100, left: 160, right: 160 },
    verticalAlign: VerticalAlign.CENTER,
    children: [new Paragraph({ alignment: AlignmentType.CENTER,
      children: [new TextRun({ text, bold: true, color: 'FFFFFF', size: 20, font: 'Arial' })] })]
  });
}

function dCell(text, w, { bold=false, color=COLORS.text, align=AlignmentType.CENTER, bg=COLORS.bg_white }={}) {
  return new TableCell({
    borders: bdrs, width: { size: w, type: WidthType.DXA },
    shading: { fill: bg, type: ShadingType.CLEAR },
    margins: { top: 100, bottom: 100, left: 160, right: 160 },
    verticalAlign: VerticalAlign.CENTER,
    children: [new Paragraph({ alignment: align,
      children: [new TextRun({ text: String(text), bold, color, size: 20, font: 'Arial' })] })]
  });
}

function multiCell(lines, w, bg=COLORS.bg_white) {
  return new TableCell({
    borders: bdrs, width: { size: w, type: WidthType.DXA },
    shading: { fill: bg, type: ShadingType.CLEAR },
    margins: { top: 120, bottom: 120, left: 180, right: 180 },
    verticalAlign: VerticalAlign.TOP,
    children: lines.map(({ text, bold=false, size=19, color=COLORS.text }) =>
      new Paragraph({ spacing: { before: 50, after: 50 },
        children: [new TextRun({ text, bold, size, color, font: 'Arial' })] }))
  });
}

// 섹션 한 줄 요약 박스
function sectionSummary(text) {
  return new Table({
    width: { size: FULL_WIDTH, type: WidthType.DXA }, columnWidths: [FULL_WIDTH],
    rows: [new TableRow({ children: [new TableCell({
      borders: {
        top:    { style: BorderStyle.SINGLE, size: 3, color: COLORS.summary_bdr },
        bottom: { style: BorderStyle.SINGLE, size: 3, color: COLORS.summary_bdr },
        left:   { style: BorderStyle.SINGLE, size: 14, color: COLORS.primary },
        right:  { style: BorderStyle.SINGLE, size: 3, color: COLORS.summary_bdr },
      },
      width: { size: FULL_WIDTH, type: WidthType.DXA },
      shading: { fill: COLORS.summary_bg, type: ShadingType.CLEAR },
      margins: { top: 120, bottom: 120, left: 260, right: 260 },
      children: [new Paragraph({
        children: [
          new TextRun({ text: '📋 ', size: 20, font: 'Arial' }),
          new TextRun({ text, size: 20, font: 'Arial', color: COLORS.primary, bold: true }),
        ]
      })]
    })]})],
  });
}

// 섹션 상단 신호등 헤더 (🟢🟡🔴 + 한 줄 요약 + 행동 힌트)
function signalHeader(signal, title, summary, action) {
  const C = {
    green:  { bg: 'E8F5E9', border: '4CAF50', accent: '2E7D32', icon: '🟢' },
    yellow: { bg: 'FFFDE7', border: 'FFC107', accent: '7B6000', icon: '🟡' },
    red:    { bg: 'FFEBEE', border: 'EF5350', accent: 'B71C1C', icon: '🔴' },
  };
  const c = C[signal] || C.yellow;
  const bdr4 = (color, size=4) => ({ style: BorderStyle.SINGLE, size, color });
  return new Table({
    width: { size: FULL_WIDTH, type: WidthType.DXA }, columnWidths: [FULL_WIDTH],
    rows: [new TableRow({ children: [new TableCell({
      borders: {
        top:    bdr4(c.border, 2),
        bottom: bdr4(c.border, 2),
        left:   bdr4(c.accent, 16),
        right:  bdr4(c.border, 2),
      },
      width: { size: FULL_WIDTH, type: WidthType.DXA },
      shading: { fill: c.bg, type: ShadingType.CLEAR },
      margins: { top: 140, bottom: 140, left: 280, right: 280 },
      children: [
        new Paragraph({ spacing: { before: 0, after: 60 }, children: [
          new TextRun({ text: `${c.icon} ${title}`, bold: true, size: 22, font: 'Arial', color: c.accent }),
        ]}),
        new Paragraph({ spacing: { before: 0, after: 60 }, children: [
          new TextRun({ text: summary, size: 19, font: 'Arial', color: COLORS.text }),
        ]}),
        new Paragraph({ spacing: { before: 0, after: 0 }, children: [
          new TextRun({ text: `→ ${action}`, size: 18, font: 'Arial', color: c.accent, bold: true, italics: true }),
        ]}),
      ],
    })]})],
  });
}

function chgColor(v) {
  const s = String(v);
  if (s.startsWith('+') || s.startsWith('▲')) return 'C00000';
  if (s.startsWith('-') || s.startsWith('▼')) return '1F4E79';
  return '000000';
}
function chgCell(text, w, bg='FFFFFF') {
  return new TableCell({
    borders: bdrs, width: { size: w, type: WidthType.DXA },
    shading: { fill: bg, type: ShadingType.CLEAR },
    margins: { top: 80, bottom: 80, left: 120, right: 120 },
    verticalAlign: VerticalAlign.CENTER,
    children: [new Paragraph({ alignment: AlignmentType.CENTER,
      children: [new TextRun({ text: String(text), bold: true, color: chgColor(text), size: 19, font: 'Arial' })] })]
  });
}

// 노란 설명 박스
function infoBox(title, bodyText) {
  return new Table({ width: { size: FULL_WIDTH, type: WidthType.DXA }, columnWidths: [FULL_WIDTH],
    rows: [new TableRow({ children: [new TableCell({
      borders: {
        top:    { style: BorderStyle.SINGLE, size: 4, color: 'F0B429' },
        bottom: { style: BorderStyle.SINGLE, size: 4, color: 'F0B429' },
        left:   { style: BorderStyle.SINGLE, size: 12, color: 'F0B429' },
        right:  { style: BorderStyle.SINGLE, size: 4, color: 'F0B429' },
      },
      width: { size: FULL_WIDTH, type: WidthType.DXA },
      shading: { fill: 'FFFBF0', type: ShadingType.CLEAR },
      margins: { top: 120, bottom: 120, left: 240, right: 240 },
      children: [
        new Paragraph({ spacing: { before: 0, after: 60 },
          children: [new TextRun({ text: `📌 ${title}`, bold: true, size: 20, font: 'Arial', color: '7B4F00' })] }),
        new Paragraph({ spacing: { before: 0, after: 0 },
          children: [new TextRun({ text: bodyText, size: 18, font: 'Arial', color: '3D2B00' })] }),
      ]
    })]})],
  });
}

// 초록/빨강 상태 박스
function statusBox(title, bodyText, positive=true) {
  const accent = positive ? '2E7D32' : 'B71C1C';
  const bg     = positive ? 'F1F8E9' : 'FFF3F3';
  const bc     = positive ? '81C784' : 'EF9A9A';
  return new Table({ width: { size: FULL_WIDTH, type: WidthType.DXA }, columnWidths: [FULL_WIDTH],
    rows: [new TableRow({ children: [new TableCell({
      borders: {
        top:    { style: BorderStyle.SINGLE, size: 4, color: bc },
        bottom: { style: BorderStyle.SINGLE, size: 4, color: bc },
        left:   { style: BorderStyle.SINGLE, size: 12, color: accent },
        right:  { style: BorderStyle.SINGLE, size: 4, color: bc },
      },
      width: { size: FULL_WIDTH, type: WidthType.DXA },
      shading: { fill: bg, type: ShadingType.CLEAR },
      margins: { top: 120, bottom: 120, left: 240, right: 240 },
      children: [
        new Paragraph({ spacing: { before: 0, after: 60 },
          children: [new TextRun({ text: title, bold: true, size: 20, font: 'Arial', color: accent })] }),
        new Paragraph({ spacing: { before: 0, after: 0 },
          children: [new TextRun({ text: bodyText, size: 18, font: 'Arial', color: '1A1A1A' })] }),
      ]
    })]})],
  });
}

function sp(before=200) {
  return new Paragraph({ spacing: { before, after: 0 }, children: [] });
}
function body(text, { bold=false, size=19, color='000000', before=80, after=80 }={}) {
  return new Paragraph({ spacing: { before, after },
    children: [new TextRun({ text, bold, size, font: 'Arial', color })] });
}
function divider() {
  return new Paragraph({
    border: { bottom: { style: BorderStyle.SINGLE, size: 6, color: '1F4E79', space: 1 } },
    spacing: { before: 200, after: 200 }, children: []
  });
}
function bullet(text) {
  return new Paragraph({ numbering: { reference: 'bullets', level: 0 },
    children: [new TextRun({ text, size: 19, font: 'Arial' })] });
}

// 뉴스 항목 — URL이 있으면 클릭 가능한 하이퍼링크, 없으면 평문
function newsRun(title, url) {
  if (url && url.startsWith('http')) {
    return new ExternalHyperlink({
      link: url,
      children: [new TextRun({
        text: title,
        size: 19, font: 'Arial',
        color: '1558B0',       // 링크 파랑
        underline: { type: 'single', color: '1558B0' },
      })],
    });
  }
  return new TextRun({ text: title, size: 19, font: 'Arial', color: COLORS.text });
}

// 뉴스 불릿 — URL 포함 버전
function newsBullet(title, url) {
  return new Paragraph({
    numbering: { reference: 'bullets', level: 0 },
    children: [newsRun(title, url)],
  });
}

// ── 테이블 생성 함수 ─────────────────────────────────────────────────────────
function indexTable(data, cols) {
  const [c1,c2,c3,c4] = cols;
  return new Table({ width: { size: FULL_WIDTH, type: WidthType.DXA }, columnWidths: cols,
    rows: [
      new TableRow({ tableHeader: true,
        children: [hCell('지수명',c1), hCell('현재가',c2), hCell('전일비',c3), hCell('등락률',c4)] }),
      ...data.map((r,i) => {
        const bg = i%2===0 ? 'F2F7FF' : 'FFFFFF';
        return new TableRow({ children: [
          dCell(r.name,      c1, { bold:true, align:AlignmentType.LEFT, bg }),
          dCell(r.value,     c2, { bg }),
          chgCell(r.change,  c3, bg),
          chgCell(r.change_pct, c4, bg),
        ]});
      })
    ]
  });
}

function kospiDetailTable() {
  const cols  = [2340,2340,2340,2340];
  const rows2 = [
    ['거래량',          kospi_detail.trading_volume || '-', '거래대금',    kospi_detail.trading_value  || '-'],
    ['시가',            kospi_detail.open           || '-', '저가',        kospi_detail.low             || '-'],
    ['외국인 순매도',   kospi_detail.foreign_net    || '-', '52주 최고',   kospi_detail.high_52w        || '-'],
    ['52주 최저',       kospi_detail.low_52w        || '-', '상장종목수',  kospi_detail.listed_stocks   || '-'],
  ];
  return new Table({ width: { size: FULL_WIDTH, type: WidthType.DXA }, columnWidths: cols,
    rows: [
      new TableRow({ tableHeader: true,
        children: [hCell('항목',cols[0]),hCell('수치',cols[1]),hCell('항목',cols[2]),hCell('수치',cols[3])] }),
      ...rows2.map((r,i) => {
        const bg = i%2===0 ? 'F2F7FF' : 'FFFFFF';
        return new TableRow({ children: [
          dCell(r[0],cols[0],{bold:true,bg}), dCell(r[1],cols[1],{bg}),
          dCell(r[2],cols[2],{bold:true,bg}), dCell(r[3],cols[3],{bg}),
        ]});
      })
    ]
  });
}

function returnTable() {
  const cols = [3120, 6240];
  return new Table({ width: { size: FULL_WIDTH, type: WidthType.DXA }, columnWidths: cols,
    rows: [
      new TableRow({ tableHeader: true, children: [hCell('기간',cols[0]),hCell('수익률',cols[1])] }),
      ...kospi_returns.map((r,i) => new TableRow({ children: [
        dCell(r.period,     cols[0], { bold:true, bg: i%2===0?'F2F7FF':'FFFFFF' }),
        chgCell(r.return_pct, cols[1], i%2===0?'F2F7FF':'FFFFFF'),
      ]}))
    ]
  });
}

// 환율 상세 테이블 (설명 포함)
const FX_EXPLAIN = {
  'USD/KRW': {
    what: [
      { text: '달러 대 원화 환율 (가장 중요한 환율)', bold: true },
      { text: '1달러를 사려면 원화가 얼마 필요한지를 나타냅니다. 숫자가 높을수록 원화 가치가 낮은(약한) 것입니다.' },
    ],
    how: (r) => [
      { text: `${r.rate}원 → 원화 약세 지속`, bold: true, color: 'B71C1C' },
      { text: '중동 불안 + 외국인 주식 매도로 원화 가치 하락. 수입 물가 상승 → 소비자 가격 상승 가능.' },
    ]
  },
  'JPY/KRW': {
    what: [
      { text: '일본 엔화 대 원화 환율', bold: true },
      { text: '100엔을 사려면 원화가 얼마인지 나타냅니다. 엔/원이 높을수록 엔화가 강한 것입니다.' },
    ],
    how: (r) => [
      { text: `${r.rate}원 → 엔화 대비 원화 약세`, bold: true, color: '7B4F00' },
      { text: '일본 여행 비용 비교적 저렴할 수 있으나, 일본산 부품 수입 비용 증가 요인입니다.' },
    ]
  },
  'CNY/KRW': {
    what: [
      { text: '중국 위안화 대 원화 환율', bold: true },
      { text: '1위안에 원화가 얼마인지 나타냅니다. 한중 교역량이 많아 중요합니다.' },
    ],
    how: (r) => [
      { text: `${r.rate}원 → 위안화 강세, 원화 약세`, bold: true, color: '7B4F00' },
      { text: '중국산 수입품 가격 상승 요인. 대중국 무역 의존 기업에 비용 부담.' },
    ]
  },
  'EUR/KRW': {
    what: [
      { text: '유럽 유로화 대 원화 환율', bold: true },
      { text: '1유로에 원화가 얼마인지 나타냅니다. 유럽 여행·수입차·명품 가격과 직결됩니다.' },
    ],
    how: (r) => [
      { text: `${r.rate}원 → 유로 강세, 원화 약세`, bold: true, color: '7B4F00' },
      { text: '유럽 여행 비용 증가, 유럽산 수입품(자동차·명품) 가격 상승 요인.' },
    ]
  },
  'HKD/KRW': {
    what: [
      { text: '홍콩 달러 대 원화 환율', bold: true },
      { text: '1홍콩달러에 원화가 얼마인지 나타냅니다. 홍콩은 아시아 금융 허브로 글로벌 자금 흐름의 바로미터.' },
    ],
    how: (r) => [
      { text: `${r.rate}원 → 소폭 상승(원화 약세)`, bold: true, color: '7B4F00' },
      { text: '홍콩 증시 약세와 맞물려 아시아 달러 수요 증가 흐름 반영.' },
    ]
  },
};

function fxDetailTable() {
  const cols = [1300, 1300, 1000, 1000, 2380, 2380];
  return new Table({ width: { size: FULL_WIDTH, type: WidthType.DXA }, columnWidths: cols,
    rows: [
      new TableRow({ tableHeader: true, children: [
        hCell('통화쌍',cols[0]), hCell('환율(원)',cols[1]),
        hCell('전일비',cols[2]), hCell('등락률',cols[3]),
        hCell('이 환율이 무엇인가요?',cols[4]), hCell('현재 수치의 의미',cols[5])
      ]}),
      ...fx_rates.map((r,i) => {
        const bg   = i%2===0 ? 'F2F7FF' : 'FFFFFF';
        const expl = FX_EXPLAIN[r.pair];
        const what = expl ? expl.what : [{ text: r.pair }];
        const how  = expl ? expl.how(r) : [{ text: `${r.rate}원` }];
        return new TableRow({ children: [
          dCell(r.pair,         cols[0], { bold:true, align:AlignmentType.LEFT, bg }),
          dCell(r.rate,         cols[1], { bg }),
          chgCell(r.change,     cols[2], bg),
          chgCell(r.change_pct, cols[3], bg),
          multiCell(what, cols[4], bg),
          multiCell(how,  cols[5], bg),
        ]});
      })
    ]
  });
}

// 거시경제 설명 테이블
const MACRO_EXPLAIN = {
  '소비자물가지수(CPI)': {
    what: [
      { text: '물가가 얼마나 올랐는지 보여주는 지수', bold: true },
      { text: '기준연도(2020년=100) 대비 현재 물가 수준. 숫자가 클수록 물가가 많이 오른 것입니다.' },
    ],
    how: (v) => [
      { text: `${v} → 2020년 대비 물가 약 ${(parseFloat(v)-100).toFixed(1)}% 상승`, bold: true, color: 'C00000' },
      { text: '물가 오름세 지속 → 한국은행 금리 인하를 어렵게 만드는 요인입니다.' },
    ]
  },
  '경제성장률(GDP, 실질)': {
    what: [
      { text: '나라 경제가 1년간 얼마나 성장했는지', bold: true },
      { text: '플러스면 성장, 마이너스면 후퇴. 한국의 잠재성장률은 약 2~2.5%입니다.' },
    ],
    how: (v) => [
      { text: `${v} → 잠재성장률(2~2.5%)보다 낮은 저성장`, bold: true, color: '7B4F00' },
      { text: '내수 부진 + 수출 둔화로 저성장 우려. IMF도 한국 재정 경고.' },
    ]
  },
  '실업률': {
    what: [
      { text: '일하고 싶은데 일자리를 못 찾는 사람의 비율', bold: true },
      { text: '낮을수록 좋습니다. 한국은 3~4%대가 안정적 수준입니다.' },
    ],
    how: (v) => [
      { text: `${v} → 비교적 안정적인 고용 상태 ✅`, bold: true, color: '2E7D32' },
      { text: '고용시장은 현재 안정적입니다.' },
    ]
  },
  '경상수지': {
    what: [
      { text: '외국과 거래해서 번 돈 - 쓴 돈', bold: true },
      { text: '플러스면 흑자(돈이 들어옴), 마이너스면 적자. 수출 많은 한국은 보통 흑자입니다.' },
    ],
    how: (v) => [
      { text: `${v} 흑자 → 외화 유입 유지 ✅`, bold: true, color: '2E7D32' },
      { text: '무역 흑자 기조 유지 중. 수출 회복세가 경상수지를 지지하고 있습니다.' },
    ]
  },
};

function macroTable() {
  const cols = [2200,1200,1300,2330,2330];
  return new Table({ width: { size: FULL_WIDTH, type: WidthType.DXA }, columnWidths: cols,
    rows: [
      new TableRow({ tableHeader: true, children: [
        hCell('지표명',cols[0]), hCell('수치',cols[1]), hCell('기준',cols[2]),
        hCell('이 지표가 무엇인가요?',cols[3]), hCell('현재 수치의 의미',cols[4])
      ]}),
      ...macro.map((m,i) => {
        const bg   = i%2===0 ? 'F2F7FF' : 'FFFFFF';
        const expl = MACRO_EXPLAIN[m.name];
        const what = expl ? expl.what           : [{ text: m.name }];
        const how  = expl ? expl.how(m.value)   : [{ text: m.value }];
        return new TableRow({ children: [
          dCell(m.name,   cols[0], { bold:true, align:AlignmentType.LEFT, bg }),
          dCell(m.value,  cols[1], { bold:true, bg }),
          dCell(m.period, cols[2], { bg }),
          multiCell(what, cols[3], bg),
          multiCell(how,  cols[4], bg),
        ]});
      })
    ]
  });
}

// ── 기업 뉴스 카드 (시총 10위) ────────────────────────────────────────────────
function companyCard(c, idx) {
  const ticker = c.ticker || c.symbol || '';
  const displayName = ticker ? `${c.name} (${ticker})` : c.name;
  const rankStr   = c.rank   ? `#${c.rank}  ` : '';
  const sectorStr = c.sector ? `  ·  ${c.sector}` : '';
  const priceStr  = c.price  || '-';
  const chgStr    = c.change_pct || '';
  const mcapStr   = c.market_cap || '-';
  const headerText = `${rankStr}${displayName}${sectorStr}  |  ${priceStr}  ${chgStr}  |  시총: ${mcapStr}`;

  const bdrNone = { style: BorderStyle.NONE,   size: 0, color: 'FFFFFF' };
  const bdrHdr  = { style: BorderStyle.SINGLE, size: 8, color: '1F4E79' };
  const bdrThin = { style: BorderStyle.SINGLE, size: 2, color: 'CCCCCC' };
  const bgLeft  = idx % 2 === 0 ? 'EFF5FF' : 'F0FFF4';
  const bgRight = idx % 2 === 0 ? 'FFFBF0' : 'FFF8EE';

  const headerRow = new TableRow({
    children: [new TableCell({
      columnSpan: 2,
      borders: { top: bdrHdr, bottom: bdrNone, left: bdrHdr, right: bdrHdr },
      shading: { fill: '1F4E79', type: ShadingType.CLEAR },
      margins: { top: 100, bottom: 100, left: 240, right: 240 },
      children: [new Paragraph({
        children: [new TextRun({ text: headerText, bold: true, color: 'FFFFFF', size: 20, font: 'Arial' })]
      })]
    })]
  });

  // 뉴스 항목 정규화 (문자열 또는 {title, url} 객체 둘 다 처리)
  const rawNews = (c.news && c.news.length > 0) ? c.news : [{ title: '(수집된 뉴스 없음)', url: null }];
  const newsItems = rawNews.map(n => typeof n === 'string' ? { title: n, url: null } : n);

  const newsChildren = [
    new Paragraph({ spacing: { before: 0, after: 80 },
      children: [new TextRun({ text: '📰 주요 뉴스', bold: true, size: 18, font: 'Arial', color: COLORS.primary })] }),
    ...newsItems.map(n =>
      new Paragraph({ spacing: { before: 40, after: 40 },
        children: [
          new TextRun({ text: '• ', size: 19, font: 'Arial', color: COLORS.text }),
          newsRun(n.title, n.url),
        ]
      })
    )
  ];

  const summaryChildren = [
    new Paragraph({ spacing: { before: 0, after: 80 },
      children: [new TextRun({ text: '📌 이 뉴스의 의미', bold: true, size: 18, font: 'Arial', color: '7B4F00' })] }),
    new Paragraph({ spacing: { before: 0, after: 0 },
      children: [new TextRun({ text: c.news_summary || '(분석 요약 없음)', size: 17, font: 'Arial', color: '3D2B00' })] })
  ];

  const contentRow = new TableRow({
    children: [
      new TableCell({
        width: { size: 4680, type: WidthType.DXA },
        borders: { top: bdrNone, bottom: bdrHdr, left: bdrHdr, right: bdrThin },
        shading: { fill: bgLeft, type: ShadingType.CLEAR },
        margins: { top: 120, bottom: 120, left: 200, right: 200 },
        children: newsChildren
      }),
      new TableCell({
        width: { size: 4680, type: WidthType.DXA },
        borders: { top: bdrNone, bottom: bdrHdr, left: bdrThin, right: bdrHdr },
        shading: { fill: bgRight, type: ShadingType.CLEAR },
        margins: { top: 120, bottom: 120, left: 200, right: 200 },
        children: summaryChildren
      })
    ]
  });

  return [
    new Table({
      width: { size: FULL_WIDTH, type: WidthType.DXA },
      columnWidths: [4680, 4680],
      rows: [headerRow, contentRow]
    }),
    sp(100)
  ];
}

// ── 투자 신호 대시보드 (v2.3.0) ──────────────────────────────────────────────
function signalDashboard() {
  const ICON = { green: '🟢', yellow: '🟡', red: '🔴' };
  const LABEL = { green: '매수 유리', yellow: '중립·관망', red: '매도 유의' };
  const ACTION = {
    green:  '신규 매수 진입 검토 — 분할 매수로 리스크 관리',
    yellow: '현금 비중 유지 / 보유 종목 손절선 재점검',
    red:    '신규 매수 보류 / 보유 비중 축소 고려',
  };
  const BG_OVERALL = { green: 'E8F5E9', yellow: 'FFFDE7', red: 'FFEBEE' };
  const BG_ROW     = { green: 'F1F8E9', yellow: 'FFFDE7', red: 'FFF3F3' };
  const COL_ACC    = { green: '2E7D32', yellow: '7B6000', red: 'B71C1C' };

  const os  = _SEC_SIGNAL.overall;
  const oIcon  = ICON[os]  || '🟡';
  const oLabel = LABEL[os] || '중립·관망';
  const oAccent = COL_ACC[os] || '7B6000';
  const oBg    = BG_OVERALL[os] || 'FFFDE7';

  // ① 종합 신호 배너
  const banner = new Table({
    width: { size: FULL_WIDTH, type: WidthType.DXA }, columnWidths: [FULL_WIDTH],
    rows: [new TableRow({ children: [new TableCell({
      borders: {
        top:    { style: BorderStyle.SINGLE, size: 8,  color: oAccent },
        bottom: { style: BorderStyle.SINGLE, size: 8,  color: oAccent },
        left:   { style: BorderStyle.SINGLE, size: 24, color: oAccent },
        right:  { style: BorderStyle.SINGLE, size: 8,  color: oAccent },
      },
      shading: { fill: oBg, type: ShadingType.CLEAR },
      margins: { top: 200, bottom: 200, left: 360, right: 360 },
      children: [
        new Paragraph({ alignment: AlignmentType.CENTER, spacing: { before:0, after:80 }, children: [
          new TextRun({ text: `${oIcon}  오늘의 종합 투자 신호: ${oLabel}`, bold: true, size: 32, font: 'Arial', color: oAccent }),
        ]}),
        new Paragraph({ alignment: AlignmentType.CENTER, spacing: { before:0, after:0 }, children: [
          new TextRun({ text: `→ ${ACTION[os]||ACTION.yellow}`, size: 22, font: 'Arial', color: oAccent, bold: true }),
        ]}),
      ],
    })]})],
  });

  // ② 5개 지표 상세 테이블
  const indicators = [
    {
      name:   'VIX (공포지수)',
      sig:    _SEC_SIGNAL.vixSig,
      val:    (() => { const v = sentiment.find(s=>(s.name||'').includes('VIX')); return v ? `${v.value} (${v.change})` : '-'; })(),
      green:  'VIX < 18  →  공포 없음, 위험자산 선호',
      yellow: 'VIX 18~25  →  주의 구간, 변동성 확대 가능',
      red:    'VIX > 25  →  공포 상승, 안전자산 비중 확대',
    },
    {
      name:   '외국인 코스피 수급',
      sig:    _SEC_SIGNAL.flowSig,
      val:    (flow_data.kospi||{}).foreign || '-',
      green:  '외국인 순매수  →  지수 지지, 추세 상승 가능',
      yellow: '수급 미수집 / 혼조  →  방향성 불명확',
      red:    '외국인 순매도  →  하방 압력, 추세 확인 필요',
    },
    {
      name:   'USD/KRW 환율',
      sig:    _SEC_SIGNAL.fxSig,
      val:    (() => { const r = fx_rates.find(f=>f.pair==='USD/KRW'); return r ? `${r.rate}원 (${r.change_pct})` : '-'; })(),
      green:  '1,350원 미만  →  원화 강세, 수입 부담 낮음',
      yellow: '1,350~1,430원  →  주의 구간',
      red:    '1,430원 초과  →  원화 약세 고점, 수입·에너지주 부담',
    },
    {
      name:   '美 10년 국채금리',
      sig:    _SEC_SIGNAL.bondSig,
      val:    (() => { const b = sentiment.find(s=>(s.name||'').includes('국채')); return b ? b.value : '-'; })(),
      green:  '4.0% 미만  →  금리 완화, 성장주 우호적',
      yellow: '4.0~4.5%  →  금리 부담 중간 수준',
      red:    '4.5% 초과  →  고금리 지속, 성장주 밸류에이션 압박',
    },
    {
      name:   '코스피 방향',
      sig:    _SEC_SIGNAL.kospiSig,
      val:    (() => { const k = kr_indices.find(r=>(r.name||'').includes('코스피')); return k ? `${k.value} (${k.change_pct})` : '-'; })(),
      green:  '상승 마감  →  단기 추세 상승, 모멘텀 유지',
      yellow: '보합  →  방향성 탐색 중',
      red:    '하락 마감  →  단기 추세 하락, 반등 확인 후 진입',
    },
  ];

  const cols = [2400, 1400, 5560];
  const detailTable = new Table({
    width: { size: FULL_WIDTH, type: WidthType.DXA }, columnWidths: cols,
    rows: [
      new TableRow({ tableHeader: true, children: [
        hCell('지표',        cols[0]),
        hCell('현재 신호',   cols[1]),
        hCell('투자 시사점', cols[2]),
      ]}),
      ...indicators.map((ind, i) => {
        const bg  = i % 2 === 0 ? COLORS.bg_stripe : COLORS.bg_white;
        const sigBg  = BG_ROW[ind.sig]  || bg;
        const sigAcc = COL_ACC[ind.sig] || COLORS.neutral;
        const hint = ind[ind.sig] || ind.yellow;
        return new TableRow({ children: [
          dCell(ind.name, cols[0], { bold: true, bg, align: AlignmentType.LEFT }),
          new TableCell({
            borders: bdrs, width: { size: cols[1], type: WidthType.DXA },
            shading: { fill: sigBg, type: ShadingType.CLEAR },
            margins: { top: 100, bottom: 100, left: 120, right: 120 },
            verticalAlign: VerticalAlign.CENTER,
            children: [
              new Paragraph({ alignment: AlignmentType.CENTER, spacing: { before:0, after:30 }, children: [
                new TextRun({ text: ICON[ind.sig]||'🟡', size: 22, font: 'Arial' }),
              ]}),
              new Paragraph({ alignment: AlignmentType.CENTER, spacing: { before:0, after:0 }, children: [
                new TextRun({ text: ind.val, size: 16, font: 'Arial', color: sigAcc, bold: true }),
              ]}),
            ],
          }),
          dCell(hint, cols[2], { bg, align: AlignmentType.LEFT }),
        ]});
      }),
    ],
  });

  return [
    new Paragraph({ heading: HeadingLevel.HEADING_1, children: [new TextRun('📊 오늘의 투자 신호 대시보드')] }),
    sp(120),
    banner,
    sp(200),
    detailTable,
    sp(200),
    infoBox('이 대시보드 사용법',
      '5개 지표가 모두 🟢이면 적극 매수, 🔴가 3개 이상이면 신규 진입 자제. 혼조(🟢+🔴 섞임)일 때는 분할 매수로 리스크를 낮추세요. 각 섹션의 신호 헤더도 함께 확인하면 더 구체적인 판단이 가능합니다.'),
    new Paragraph({ children: [new PageBreak()] }),
  ];
}

// ── AI 인사이트 박스 (Phase 15) ──────────────────────────────────────────────
function insightBox(insights) {
  if (!insights || insights.length === 0) return null;
  const lines = insights.slice(0, 3);
  const ICONS = ['①', '②', '③'];
  return new Table({
    width: { size: FULL_WIDTH, type: WidthType.DXA }, columnWidths: [FULL_WIDTH],
    rows: [new TableRow({ children: [new TableCell({
      borders: {
        top:    { style: BorderStyle.SINGLE, size: 8,  color: COLORS.primary },
        bottom: { style: BorderStyle.SINGLE, size: 8,  color: COLORS.primary },
        left:   { style: BorderStyle.SINGLE, size: 20, color: COLORS.primary },
        right:  { style: BorderStyle.SINGLE, size: 8,  color: COLORS.primary },
      },
      width: { size: FULL_WIDTH, type: WidthType.DXA },
      shading: { fill: 'EBF3FF', type: ShadingType.CLEAR },
      margins: { top: 160, bottom: 160, left: 300, right: 300 },
      children: [
        new Paragraph({ spacing: { before: 0, after: 100 }, children: [
          new TextRun({ text: '🤖 오늘의 핵심 인사이트', bold: true, size: 22, font: 'Arial', color: COLORS.primary }),
        ]}),
        ...lines.map((txt, i) => new Paragraph({
          spacing: { before: 60, after: 60 },
          children: [
            new TextRun({ text: `${ICONS[i]}  `, bold: true, size: 20, font: 'Arial', color: COLORS.primary }),
            new TextRun({ text: txt, size: 20, font: 'Arial', color: COLORS.text }),
          ],
        })),
      ],
    })]})],
  });
}

// ── 이벤트 캘린더 헬퍼 (Phase 13) ────────────────────────────────────────────
const IMPACT_COLOR = { '높음': 'C00000', '보통': 'ED7D31', '낮음': '595959' };

function calendarTable(events) {
  if (!events || events.length === 0) return null;
  const cols = [1200, 760, 2600, 2200, 2600];
  return new Table({
    width: { size: FULL_WIDTH, type: WidthType.DXA }, columnWidths: cols,
    rows: [
      new TableRow({ tableHeader: true, children: [
        hCell('날짜',    cols[0]), hCell('지역', cols[1]),
        hCell('이벤트', cols[2]), hCell('시장 영향도', cols[3]),
        hCell('주목 이유', cols[4]),
      ]}),
      ...events.map((ev, i) => {
        const bg  = i % 2 === 0 ? COLORS.bg_stripe : COLORS.bg_white;
        const imc = IMPACT_COLOR[ev.impact] || COLORS.neutral;
        return new TableRow({ children: [
          dCell(ev.date   || '-', cols[0], { bold: true, bg }),
          dCell(ev.region || '-', cols[1], { bg }),
          dCell(ev.event  || '-', cols[2], { bg, align: AlignmentType.LEFT }),
          new TableCell({
            borders: bdrs, width: { size: cols[3], type: WidthType.DXA },
            shading: { fill: bg, type: ShadingType.CLEAR },
            margins: { top: 100, bottom: 100, left: 120, right: 120 },
            verticalAlign: VerticalAlign.CENTER,
            children: [new Paragraph({ alignment: AlignmentType.CENTER,
              children: [new TextRun({ text: ev.impact || '-', size: 18, bold: true, color: imc, font: 'Arial' })] })],
          }),
          dCell(ev.note || '-', cols[4], { bg, align: AlignmentType.LEFT }),
        ]});
      }),
    ],
  });
}

// ── 워치리스트 헬퍼 (Phase 14) ────────────────────────────────────────────────
function watchlistTable(stocks, region) {
  if (!stocks || stocks.length === 0) return null;
  const cols = [400, 1600, 1000, 1000, 5360]; // #, 종목명, 현재가, 등락률, 주목이유
  return new Table({
    width: { size: FULL_WIDTH, type: WidthType.DXA }, columnWidths: cols,
    rows: [
      new TableRow({ tableHeader: true, children: [
        hCell('#',        cols[0]), hCell('종목명',  cols[1]),
        hCell('현재가',   cols[2]), hCell('등락률',  cols[3]),
        hCell('주목 이유 & 관련 뉴스', cols[4]),
      ]}),
      ...stocks.map((s, i) => {
        const bg = i % 2 === 0 ? COLORS.bg_stripe : COLORS.bg_white;
        const noteW = cols[4];
        const noteText = [s.reason, s.news_title].filter(Boolean).join('  |  뉴스: ');
        return new TableRow({ children: [
          dCell(String(i + 1),   cols[0], { bold: true, bg }),
          dCell(s.name || '-',   cols[1], { bold: true, bg, align: AlignmentType.LEFT }),
          dCell(s.price || '-',  cols[2], { bg }),
          chgCell(s.change_pct || '-', cols[3], bg),
          new TableCell({
            borders: bdrs, width: { size: noteW, type: WidthType.DXA },
            shading: { fill: bg, type: ShadingType.CLEAR },
            margins: { top: 100, bottom: 100, left: 160, right: 160 },
            verticalAlign: VerticalAlign.TOP,
            children: [new Paragraph({ children: [
              new TextRun({ text: noteText || '-', size: 18, font: 'Arial', color: COLORS.text }),
            ]})],
          }),
        ]});
      }),
    ],
  });
}

// ── 수급 동향 헬퍼 (Phase 11) ────────────────────────────────────────────────
function flowTable(flowData) {
  if (!flowData || (!flowData.kospi && !flowData.kosdaq)) return null;

  // 주체별 3색 요약 표 (코스피·코스닥)
  const mkts = [
    { label: '코스피', data: flowData.kospi  || {} },
    { label: '코스닥', data: flowData.kosdaq || {} },
  ];
  const cols = [1560, 1800, 1800, 1800, 2400];
  const flowSummary = new Table({
    width: { size: FULL_WIDTH, type: WidthType.DXA }, columnWidths: cols,
    rows: [
      new TableRow({ tableHeader: true, children: [
        hCell('시장',   cols[0]), hCell('🌏 외국인 순매수', cols[1]),
        hCell('🏢 기관 순매수', cols[2]), hCell('👤 개인 순매수', cols[3]),
        hCell('해석', cols[4]),
      ]}),
      ...mkts.map((m, i) => {
        const bg  = i % 2 === 0 ? COLORS.bg_stripe : COLORS.bg_white;
        const fgn = m.data.foreign     || '-';
        const ins = m.data.institution || '-';
        const ret = m.data.retail      || '-';
        const interp = (() => {
          const fPos = String(fgn).startsWith('+');
          const fNeg = String(fgn).startsWith('-');
          if (fPos) return '외국인 매수 우위 → 지수 지지 가능성';
          if (fNeg) return '외국인 매도 우위 → 하방 압력 주의';
          return '수급 중립';
        })();
        return new TableRow({ children: [
          dCell(m.label, cols[0], { bold: true, bg }),
          chgCell(fgn, cols[1], bg),
          chgCell(ins, cols[2], bg),
          chgCell(ret, cols[3], bg),
          dCell(interp, cols[4], { bg, align: AlignmentType.LEFT }),
        ]});
      }),
    ],
  });

  const result = [flowSummary];

  // 외국인 순매수 상위/하위 종목
  const topBuys  = flowData.top_buys  || [];
  const topSells = flowData.top_sells || [];
  if (topBuys.length > 0 || topSells.length > 0) {
    const rankCols = [520, 2200, 1400, 2620, 2620];
    result.push(sp(160));
    result.push(new Table({
      width: { size: FULL_WIDTH, type: WidthType.DXA }, columnWidths: rankCols,
      rows: [
        new TableRow({ tableHeader: true, children: [
          hCell('순위', rankCols[0]), hCell('종목명', rankCols[1]),
          hCell('코드', rankCols[2]),
          hCell('🌏 외국인 순매수 상위 (유입↑)', rankCols[3]),
          hCell('🌏 외국인 순매도 상위 (유출↓)', rankCols[4]),
        ]}),
        ...[0,1,2,3,4].map(idx => {
          const bg  = idx % 2 === 0 ? COLORS.bg_stripe : COLORS.bg_white;
          const buy  = topBuys[idx]  || {};
          const sell = topSells[idx] || {};
          return new TableRow({ children: [
            dCell(String(idx + 1), rankCols[0], { bold: true, bg }),
            dCell(buy.name  || '-', rankCols[1], { bg, align: AlignmentType.LEFT }),
            dCell(buy.ticker || '-', rankCols[2], { bg }),
            chgCell(buy.foreign_net  || '-', rankCols[3], bg),
            chgCell(sell.foreign_net || '-', rankCols[4], bg),
          ]});
        }),
      ],
    }));
  }
  return result;
}

// ── 시장 심리 패널 헬퍼 (Phase 12) ──────────────────────────────────────────
const SIGNAL_COLOR = { '안정': '2E7D32', '주의': 'ED7D31', '위험': 'C00000', '안전': '1F4E79' };
const SIGNAL_BG    = { '안정': 'F1F8E9', '주의': 'FFF8E1', '위험': 'FFF3F3', '안전': 'E8F0FE' };

function sentimentTable(sentimentData) {
  if (!sentimentData || sentimentData.length === 0) return null;
  const cols = [2200, 1400, 1400, 1400, 3360];
  return new Table({
    width: { size: FULL_WIDTH, type: WidthType.DXA }, columnWidths: cols,
    rows: [
      new TableRow({ tableHeader: true, children: [
        hCell('지표', cols[0]), hCell('현재값', cols[1]),
        hCell('전일비', cols[2]), hCell('신호', cols[3]),
        hCell('투자자 시사점', cols[4]),
      ]}),
      ...sentimentData.map((s, i) => {
        const bg       = i % 2 === 0 ? COLORS.bg_stripe : COLORS.bg_white;
        const sigColor = SIGNAL_COLOR[s.signal] || COLORS.neutral;
        const sigBg    = SIGNAL_BG[s.signal]    || bg;
        const hint = (() => {
          const n = s.name || '';
          if (n.includes('VIX'))   return s.signal === '안정' ? '투자 심리 안정 — 위험자산 선호 가능' : '공포 지수 상승 — 변동성 주의';
          if (n.includes('금리'))  return s.signal === '주의' ? '금리 상승 → 성장주 밸류에이션 압박' : '금리 안정 — 주식 친화적';
          if (n.includes('WTI'))   return s.signal === '주의' ? '유가 상승 → 수입 비용 증가, 원화 약세 압력' : '유가 안정';
          if (n.includes('금('))   return '안전자산 수요 → 불확실성 반영';
          if (n.includes('비트'))  return '위험자산 선호도 바로미터';
          return '-';
        })();
        return new TableRow({ children: [
          dCell(s.name || '-', cols[0], { bold: true, bg, align: AlignmentType.LEFT }),
          dCell(s.value || '-', cols[1], { bold: true, bg }),
          chgCell(s.change || '-', cols[2], bg),
          new TableCell({
            borders: bdrs, width: { size: cols[3], type: WidthType.DXA },
            shading: { fill: sigBg, type: ShadingType.CLEAR },
            margins: { top: 100, bottom: 100, left: 120, right: 120 },
            verticalAlign: VerticalAlign.CENTER,
            children: [new Paragraph({ alignment: AlignmentType.CENTER,
              children: [new TextRun({ text: s.signal || '-', size: 18, bold: true, color: sigColor, font: 'Arial' })] })],
          }),
          dCell(hint, cols[4], { bg, align: AlignmentType.LEFT }),
        ]});
      }),
    ],
  });
}

// ── 거시 뉴스 헬퍼 ───────────────────────────────────────────────────────────
const IMPORTANCE_COLOR = { high: 'C00000', medium: 'ED7D31', low: '595959' };
const IMPORTANCE_LABEL = { high: '🔴 높음', medium: '🟡 보통', low: '⚪ 낮음' };
const CATEGORY_COLOR   = {
  금리: '1F4E79', 지정학: '7030A0', 에너지: 'C00000',
  환율: '2E75B6', 무역: '375623', 기타: '595959',
};

function macroHeadlineTable(headlines) {
  if (!headlines || headlines.length === 0) return null;
  const cols = [1200, 1400, 3160, 3600];
  return new Table({
    width: { size: FULL_WIDTH, type: WidthType.DXA }, columnWidths: cols,
    rows: [
      new TableRow({ tableHeader: true, children: [
        hCell('중요도', cols[0]), hCell('분야', cols[1]),
        hCell('헤드라인', cols[2]), hCell('핵심 내용', cols[3]),
      ]}),
      ...headlines.map((h, i) => {
        const bg        = i % 2 === 0 ? COLORS.bg_stripe : COLORS.bg_white;
        const impColor  = IMPORTANCE_COLOR[h.importance] || COLORS.neutral;
        const impLabel  = IMPORTANCE_LABEL[h.importance] || h.importance || '-';
        const catColor  = CATEGORY_COLOR[h.category]   || COLORS.neutral;
        return new TableRow({ children: [
          new TableCell({
            borders: bdrs, width: { size: cols[0], type: WidthType.DXA },
            shading: { fill: bg, type: ShadingType.CLEAR },
            margins: { top: 100, bottom: 100, left: 120, right: 120 },
            verticalAlign: VerticalAlign.CENTER,
            children: [new Paragraph({ alignment: AlignmentType.CENTER,
              children: [new TextRun({ text: impLabel, size: 17, font: 'Arial', color: impColor, bold: true })] })],
          }),
          new TableCell({
            borders: bdrs, width: { size: cols[1], type: WidthType.DXA },
            shading: { fill: bg, type: ShadingType.CLEAR },
            margins: { top: 100, bottom: 100, left: 120, right: 120 },
            verticalAlign: VerticalAlign.CENTER,
            children: [new Paragraph({ alignment: AlignmentType.CENTER,
              children: [new TextRun({ text: h.category || '-', size: 18, font: 'Arial', color: catColor, bold: true })] })],
          }),
          new TableCell({
            borders: bdrs, width: { size: cols[2], type: WidthType.DXA },
            shading: { fill: bg, type: ShadingType.CLEAR },
            margins: { top: 100, bottom: 100, left: 160, right: 160 },
            verticalAlign: VerticalAlign.CENTER,
            children: [new Paragraph({
              children: [newsRun(h.title || '-', h.url)] })],
          }),
          new TableCell({
            borders: bdrs, width: { size: cols[3], type: WidthType.DXA },
            shading: { fill: bg, type: ShadingType.CLEAR },
            margins: { top: 100, bottom: 100, left: 160, right: 160 },
            verticalAlign: VerticalAlign.TOP,
            children: [new Paragraph({
              children: [new TextRun({ text: h.summary || '-', size: 18, font: 'Arial', color: COLORS.text })] })],
          }),
        ]});
      }),
    ],
  });
}

function companyNewsList(companies, isKorean) {
  if (!companies || companies.length === 0) {
    return [body(
      isKorean
        ? '(한국 시총 상위 기업 데이터가 없습니다. 크롤링 재실행이 필요합니다.)'
        : '(미국 시총 상위 기업 데이터가 없습니다. 크롤링 재실행이 필요합니다.)',
      { color: '999999', size: 18 }
    )];
  }
  return companies.flatMap((c, i) => companyCard(c, i));
}

// ── 기본 이슈 문구 (데이터에 issues가 없을 때 fallback) ─────────────────────
const DEFAULT_KR_ISSUES = [
  '외국인 순매도 지속: 코스피에서 외국인이 순매도하며 지수 하락을 주도. 중동 정세 불안과 원화 약세가 원인.',
  '코스닥 상대적 강세: 코스피 하락 속에서도 코스닥은 상승 마감. 중소형·바이오 중심 개인 매수세 유입.',
  '원화 약세 지속: 에너지 수입 의존도가 높은 한국 특성상 중동 불안이 원화 가치에 직접적 영향.',
];
const DEFAULT_US_ISSUES = [
  'S&P 500 사상 최고치 경신: 미·이란 휴전 및 호르무즈 재개통 기대감으로 뉴욕 증시 급등.',
  '반도체·AI 섹터 강세: AI 수요 기대감 지속으로 반도체 지수가 전 업종 중 최고 상승률 기록.',
  '빅테크 중심 나스닥 상승: 일부 전문가는 추가 상승 모멘텀 약화 및 조정 가능성 경고.',
];
const DEFAULT_CONCLUSIONS = [
  '미국 사상 최고치 랠리 vs 한국 제한적 반영: 외국인 매도와 원화 약세로 한국 시장 상승 동참에 제약.',
  '중동 종전 협상 진전 여부가 에너지 가격·환율·증시 방향성을 결정할 핵심 변수.',
  '원화 약세 주의: 에너지 의존 구조 특성상 수입 물가 및 소비자 물가 상승 압력 지속 가능.',
  '반도체·AI 섹터 강세 지속 — 삼성전자·SK하이닉스 등 연동 흐름 모니터링 필요.',
  '저성장(GDP 1.4%)+물가 상승 공존 → 금리 인하 vs 물가 딜레마로 통화정책 불확실성 지속.',
];

const finalKrIssues   = (kr_issues.length   > 0) ? kr_issues   : DEFAULT_KR_ISSUES;
const finalUsIssues   = (us_issues.length   > 0) ? us_issues   : DEFAULT_US_ISSUES;
const finalConclusions= (conclusions.length > 0) ? conclusions : DEFAULT_CONCLUSIONS;

// ── 차트 생성 헬퍼 ────────────────────────────────────────────────────────────
async function buildCharts(mergedData) {
  if (!prepareChartData || !renderLineChart || !getChartSchedule) return {};

  const schedule   = getChartSchedule();
  const periods    = Object.entries(schedule).filter(([, on]) => on).map(([p]) => p);
  const outDir     = path.join(path.dirname(outputPath), 'charts_tmp');
  const periodLabel = { daily: '7일', weekly: '4주', monthly: '12개월' };
  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });

  const results = {};
  for (const period of periods) {
    const datasets = prepareChartData(mergedData, period);
    for (const ds of datasets) {
      const filePath  = path.join(outDir, `${ds.symbol}_${period}.png`);
      const chartPath = await renderLineChart({
        title:      `${ds.label} (${periodLabel[period]})`,
        labels:     ds.labels,
        datasets:   [{ label: ds.label, data: ds.values, color: ds.color }],
        outputPath: filePath,
      });
      if (chartPath) results[`${ds.symbol}_${period}`] = chartPath;
    }
  }
  return results;
}

function chartImage(imagePath) {
  if (!imagePath || !fs.existsSync(imagePath)) return null;
  try {
    const imageData = fs.readFileSync(imagePath);
    return new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { before: 160, after: 160 },
      children: [new ImageRun({
        data:           imageData,
        transformation: { width: 630, height: 252 },
        type:           'png',
      })],
    });
  } catch (e) {
    console.warn('[차트] 이미지 삽입 실패:', e.message);
    return null;
  }
}

// ── 문서 구성 (async) ─────────────────────────────────────────────────────────
(async () => {
  // ① 차트 생성 (timeseries 데이터가 있을 때만 생성됨)
  const charts = await buildCharts(raw);
  const schedule     = getChartSchedule ? getChartSchedule() : { daily: true, weekly: false, monthly: false };
  const activePeriod = schedule.monthly ? 'monthly' : schedule.weekly ? 'weekly' : 'daily';

  function chartBlock(symbols) {
    return symbols.map(sym => chartImage(charts[`${sym}_${activePeriod}`])).filter(Boolean);
  }

  // ② 히트맵 생성
  const chartsDir = path.join(path.dirname(outputPath), 'charts_tmp');
  if (!fs.existsSync(chartsDir)) fs.mkdirSync(chartsDir, { recursive: true });

  let krHeatmapPath = null;
  let usHeatmapPath = null;
  if (renderHeatmap) {
    if (kr_sectors.length > 0) {
      krHeatmapPath = await renderHeatmap({
        title:      '한국 섹터별 등락률',
        sectors:    kr_sectors,
        outputPath: path.join(chartsDir, 'kr_sectors.png'),
        cols: 4, width: 900, height: 300,
      });
    }
    if (us_sectors.length > 0) {
      usHeatmapPath = await renderHeatmap({
        title:      '미국 섹터 ETF 등락률',
        sectors:    us_sectors,
        outputPath: path.join(chartsDir, 'us_sectors.png'),
        cols: 4, width: 900, height: 300,
      });
    }
  }

  function heatmapImage(imgPath) { return chartImage(imgPath); } // 동일 렌더 로직 재사용

  // ③ 용어 사전 체크
  const glossaryDir = path.join(__dirname, '..', 'docs', 'glossary');
  const reportText  = JSON.stringify(raw); // 데이터 전체를 텍스트로 사용
  let newGlossaryTerms = [];
  if (checkAndUpdateGlossary) {
    try { newGlossaryTerms = checkAndUpdateGlossary(reportText, glossaryDir); }
    catch (ge) { console.warn('[용어사전] 체크 실패:', ge.message); }
  }

  const doc = new Document({
  styles: {
    default: { document: { run: { font: 'Arial', size: 20 } } },
    paragraphStyles: [
      { id:'Heading1', name:'Heading 1', basedOn:'Normal', next:'Normal', quickFormat:true,
        run:{ size:40, bold:true, font:FONT, color:COLORS.primary },
        paragraph:{ spacing:{ before:480, after:200, line:360, lineRule:'auto' }, outlineLevel:0 } },
      { id:'Heading2', name:'Heading 2', basedOn:'Normal', next:'Normal', quickFormat:true,
        run:{ size:30, bold:true, font:FONT, color:COLORS.primary },
        paragraph:{ spacing:{ before:320, after:140, line:340, lineRule:'auto' }, outlineLevel:1 } },
    ]
  },
  numbering: { config: [{ reference:'bullets', levels:[{
    level:0, format:LevelFormat.BULLET, text:'\u2022', alignment:AlignmentType.LEFT,
    style:{ paragraph:{ indent:{ left:720, hanging:360 } } }
  }]}]},
  sections:[{
    properties:{ page:{ size:{ width:12240, height:15840 },
      margin:{ top:1440, right:1440, bottom:1440, left:1440 } } },
    headers:{ default: new Header({ children:[new Paragraph({
      border:{ bottom:{ style:BorderStyle.SINGLE, size:6, color:'1F4E79', space:1 } },
      children:[
        new TextRun({ text:'한국·미국 증시 조사 보고서', bold:true, size:18, font:FONT, color:'1F4E79' }),
        new TextRun({ text:`\t${REPORT_DATE} 기준`, size:18, font:FONT, color:'595959' }),
      ],
      tabStops:[{ type:'right', position:9360 }]
    })]})},
    footers:{ default: new Footer({ children:[new Paragraph({
      border:{ top:{ style:BorderStyle.SINGLE, size:6, color:'1F4E79', space:1 } },
      alignment:AlignmentType.CENTER,
      children:[
        new TextRun({ text:`출처: ${SOURCES}   |   `, size:16, font:FONT, color:'595959' }),
        new TextRun({ text:'Page ', size:16, font:FONT, color:'595959' }),
        new TextRun({ children:[PageNumber.CURRENT], size:16, font:FONT, color:'595959' }),
      ]
    })]})},
    children:[
      // ── 표지 ──────────────────────────────────────────────────────────────
      new Paragraph({ alignment:AlignmentType.CENTER, spacing:{ before:560, after:100 },
        children:[new TextRun({ text:'한국·미국 증시 조사 보고서', bold:true, size:64, font:FONT, color:COLORS.primary })] }),
      new Paragraph({ alignment:AlignmentType.CENTER, spacing:{ before:0, after:60 },
        children:[new TextRun({ text:'Korea & US Stock Market Research Report', size:26, font:FONT, color:COLORS.neutral })] }),
      new Paragraph({ alignment:AlignmentType.CENTER, spacing:{ before:0, after:20 },
        children:[new TextRun({ text:`생성: ${REPORT_DATE} ${REPORT_TIME.slice(0,2)}:${REPORT_TIME.slice(2)} KST`, size:24, font:FONT, color:COLORS.neutral, bold:true })] }),
      new Paragraph({ alignment:AlignmentType.CENTER, spacing:{ before:0, after:60 },
        children:[
          new TextRun({ text:`🇰🇷 한국 장: ${KR_SESSION_DATE}  `, size:20, font:FONT, color:COLORS.neutral }),
          new TextRun({ text:`🇺🇸 미국 장: ${US_SESSION_DATE}`, size:20, font:FONT, color:COLORS.neutral }),
        ] }),
      sp(120),
      // KPI 미니 카드 3개 (코스피 · S&P500 · USD/KRW)
      (() => {
        const kospi  = kr_indices.find(r => r.name && r.name.includes('코스피')) || {};
        const sp500  = us_indices.find(r => r.name && (r.name.includes('S&P') || r.name.includes('S&amp;P'))) || {};
        const usdkrw = fx_rates.find(r => r.pair === 'USD/KRW') || {};
        function kpiCell(label, val, chg, w) {
          const isRise = String(chg).startsWith('+') || String(chg).startsWith('▲');
          const isFall = String(chg).startsWith('-') || String(chg).startsWith('▼');
          const chgColor = isRise ? COLORS.rise : isFall ? COLORS.fall : COLORS.neutral;
          return new TableCell({
            width:{ size:w, type:WidthType.DXA },
            borders:{ top:{style:BorderStyle.SINGLE,size:6,color:COLORS.primary}, bottom:{style:BorderStyle.SINGLE,size:6,color:COLORS.primary}, left:{style:BorderStyle.SINGLE,size:2,color:'CCCCCC'}, right:{style:BorderStyle.SINGLE,size:2,color:'CCCCCC'} },
            shading:{ fill:COLORS.cover_kpi, type:ShadingType.CLEAR },
            margins:{ top:160, bottom:160, left:200, right:200 },
            children:[
              new Paragraph({ alignment:AlignmentType.CENTER, spacing:{before:0,after:40}, children:[new TextRun({text:label, size:18, font:FONT, color:COLORS.neutral})] }),
              new Paragraph({ alignment:AlignmentType.CENTER, spacing:{before:0,after:40}, children:[new TextRun({text:val||'-', size:28, font:FONT, color:COLORS.primary, bold:true})] }),
              new Paragraph({ alignment:AlignmentType.CENTER, spacing:{before:0,after:0},  children:[new TextRun({text:chg||'', size:20, font:FONT, color:chgColor, bold:true})] }),
            ]
          });
        }
        const W = Math.floor(FULL_WIDTH/3);
        return new Table({ width:{size:FULL_WIDTH,type:WidthType.DXA}, columnWidths:[W,W,FULL_WIDTH-W*2],
          rows:[new TableRow({ children:[
            kpiCell('🇰🇷 코스피', kospi.value,  kospi.change_pct,  W),
            kpiCell('🇺🇸 S&P 500', sp500.value,  sp500.change_pct,  W),
            kpiCell('💱 USD/KRW', usdkrw.rate, usdkrw.change_pct, FULL_WIDTH-W*2),
          ]})]
        });
      })(),
      sp(200),
      new Paragraph({ alignment:AlignmentType.CENTER, spacing:{ before:0, after:60 },
        children:[new TextRun({ text:NAVER_OK ? '✅ 네이버 금융 MCP 교차 검증 완료' : '📡 한국경제신문 크롤링 데이터 기준',
          size:18, font:FONT, color: NAVER_OK?'2E7D32':'2E75B6', italics:true })] }),
      new Paragraph({ alignment:AlignmentType.CENTER, spacing:{ before:0, after:300 },
        children:[new TextRun({ text:`출처: ${SOURCES}`, size:18, font:FONT, color:'7F7F7F' })] }),
      divider(),

      // ── 목차 ──────────────────────────────────────────────────────────────
      new Paragraph({ heading:HeadingLevel.HEADING_1, children:[new TextRun('목  차')] }),
      new TableOfContents('목차', { hyperlink:true, headingStyleRange:'1-2' }),
      new Paragraph({ children:[new PageBreak()] }),

      // ── AI 데일리 인사이트 (표지 다음 페이지) ─────────────────────────────
      ...(() => {
        const box = insightBox(daily_insight);
        if (!box) return [];
        return [
          box,
          sp(200),
          new Paragraph({ children:[new PageBreak()] }),
        ];
      })(),

      // ── 투자 신호 대시보드 (v2.3.0) ───────────────────────────────────────
      ...signalDashboard(),

      // ── 0. 글로벌 거시 정세 ────────────────────────────────────────────────
      new Paragraph({ heading:HeadingLevel.HEADING_1, children:[new TextRun('0. 글로벌 거시 정세')] }),
      (() => {
        const highCount = macro_headlines.filter(h => h.importance === 'high').length;
        const cats = [...new Set(macro_headlines.map(h => h.category).filter(Boolean))];
        const summary = macro_headlines.length > 0
          ? `주요 이슈 ${macro_headlines.length}건 수집  |  핵심 분야: ${cats.join(' · ') || '-'}  |  고위험 ${highCount}건`
          : `글로벌 거시 정세 데이터 없음 — 크롤링 재실행 필요`;
        return sectionSummary(summary);
      })(),
      sp(120),
      ...(macro_headlines.length > 0
        ? [
            infoBox('글로벌 거시 정세란?',
              '금리·지정학·에너지·무역 등 세계 경제 전반의 큰 흐름입니다. 이 요소들이 환율·증시 방향성을 먼저 결정합니다. 아래 표의 "높음" 항목을 가장 먼저 확인하세요.'),
            sp(120),
            macroHeadlineTable(macro_headlines),
          ]
        : [body('(글로벌 거시 정세 데이터가 없습니다. 크롤링 에이전트가 hankyung.com/international 및 hankyung.com/economy를 수집해야 합니다.)',
            { color: '999999', size: 18 })]),
      new Paragraph({ children:[new PageBreak()] }),

      // ── 0-A. 시장 심리 패널 ────────────────────────────────────────────────
      new Paragraph({ heading:HeadingLevel.HEADING_1, children:[new TextRun('0-A. 시장 심리 패널')] }),
      (() => {
        const vixItem = sentiment.find(s=>(s.name||'').includes('VIX'));
        const vixTxt  = vixItem ? `VIX ${vixItem.value} (${vixItem.signal})` : 'VIX 미수집';
        const sig = _SEC_SIGNAL.vixSig;
        const actions = { green:'공포 없음 — 위험자산 선호 가능, 변동성 매수 전략 유효', yellow:'중립 — 이벤트 전후 변동성 주의', red:'공포 상승 — 안전자산(금·달러) 비중 확대 고려' };
        return signalHeader(sig, '시장 심리 패널', vixTxt, actions[sig]||actions.yellow);
      })(),
      sectionSummary(sentiment.length > 0
        ? `VIX·금리·유가·금·비트코인 ${sentiment.length}개 지표 수집  |  ${BASE_DATE} 기준`
        : '시장 심리 지표 없음 — 크롤링 재실행 필요'),
      sp(120),
      ...(sentiment.length > 0
        ? [
            infoBox('시장 심리 패널이란?',
              'VIX(공포지수)·금리·유가·금·비트코인은 주식 시장 외부의 핵심 온도계입니다. 이 지표들이 주식 방향성을 선행하는 경우가 많습니다. "신호" 열을 먼저 확인하세요.'),
            sp(120),
            sentimentTable(sentiment),
          ]
        : [body('(시장 심리 데이터가 없습니다. 크롤링 에이전트가 VIX·국채금리·WTI·금·비트코인을 수집해야 합니다.)',
            { color: '999999', size: 18 })]),
      new Paragraph({ children:[new PageBreak()] }),

      // ── 1. 한국 증시 ───────────────────────────────────────────────────────
      new Paragraph({ heading:HeadingLevel.HEADING_1, children:[new TextRun('1. 한국 증시')] }),
      (() => {
        const kospi  = kr_indices.find(r=>r.name&&r.name.includes('코스피'));
        const flowFgn = (flow_data.kospi||{}).foreign || '';
        const flowTxt = flowFgn ? `외국인 ${flowFgn}` : '외국인 수급 미수집';
        const valTxt  = kospi ? `코스피 ${kospi.value} (${kospi.change_pct})` : '코스피 데이터 없음';
        const sig     = _SEC_SIGNAL.kospiSig;
        const actions = { green:'상승 추세 확인 — 신규 진입 검토 가능', yellow:'혼조세 — 분할 매수·현금 유지 병행', red:'하락 압력 — 손절선 점검 / 신규 매수 보류' };
        return signalHeader(sig, '한국 증시', `${valTxt}  |  ${flowTxt}`, actions[sig]||actions.yellow);
      })(),
      sectionSummary((() => {
        const kospi  = kr_indices.find(r=>r.name&&r.name.includes('코스피'));
        const kosdaq = kr_indices.find(r=>r.name&&r.name.includes('코스닥'));
        const k = kospi  ? `코스피 ${kospi.value}(${kospi.change_pct})` : '코스피 -';
        const d = kosdaq ? `코스닥 ${kosdaq.value}(${kosdaq.change_pct})` : '코스닥 -';
        return `${k}  |  ${d}  |  조사일: ${BASE_DATE}`;
      })()),
      sp(120),
      new Paragraph({ heading:HeadingLevel.HEADING_2, children:[new TextRun('1-1. 주요 지수 현황')] }),
      indexTable(kr_indices, [3120,2080,2080,2080]),
      sp(200),
      ...chartBlock(['KOSPI', 'KOSDAQ']),
      ...(Object.keys(kospi_detail).length > 0 ? [
        new Paragraph({ heading:HeadingLevel.HEADING_2, children:[new TextRun('1-2. 코스피 상세 지표')] }),
        kospiDetailTable(), sp(200),
      ] : []),
      ...(kospi_returns.length > 0 ? [
        new Paragraph({ heading:HeadingLevel.HEADING_2, children:[new TextRun('1-3. 코스피 기간별 수익률')] }),
        returnTable(), sp(200),
      ] : []),
      new Paragraph({ heading:HeadingLevel.HEADING_2, children:[new TextRun('1-4. 주요 이슈')] }),
      ...finalKrIssues.map(t => bullet(t)),
      ...(() => {
        const ft = flowTable(flow_data);
        if (!ft) return [];
        return [
          sp(200),
          new Paragraph({ heading:HeadingLevel.HEADING_2, children:[new TextRun('1-5. 수급 동향 (외국인·기관·개인)')] }),
          infoBox('수급이란?', '주식 시장에서 누가 사고 팔고 있는지를 나타냅니다. 외국인이 대량 매수하면 지수가 오르는 경우가 많습니다. 외국인 순매수 상위 종목은 단기 모멘텀 시그널로 활용됩니다.'),
          sp(120),
          ...(Array.isArray(ft) ? ft : [ft]),
        ];
      })(),
      ...(krHeatmapPath ? [
        sp(200),
        new Paragraph({ heading:HeadingLevel.HEADING_2, children:[new TextRun('1-6. 섹터별 등락률 히트맵')] }),
        body('업종별 자금 흐름을 한눈에 확인하세요. 진초록=강한 상승 / 연초록=소폭 상승 / 연빨강=소폭 하락 / 진빨강=강한 하락', { color:'595959', size:18 }),
        sp(80),
        heatmapImage(krHeatmapPath),
      ] : []),
      new Paragraph({ children:[new PageBreak()] }),

      // ── 2. 미국 증시 ───────────────────────────────────────────────────────
      new Paragraph({ heading:HeadingLevel.HEADING_1, children:[new TextRun('2. 미국 증시')] }),
      (() => {
        const sp5 = us_indices.find(r=>r.name&&(r.name.includes('S&P')||r.name.includes('S&amp;P')));
        const nas = us_indices.find(r=>r.name&&r.name.includes('나스닥'));
        const valTxt = [sp5,nas].filter(Boolean).map(r=>`${r.name} ${r.value}(${r.change_pct})`).join('  |  ') || '미국 지수 데이터 없음';
        const sig = _SEC_SIGNAL.usSig;
        const actions = { green:'미국 강세 — 나스닥·반도체 연동 국내주 모멘텀 확인', yellow:'혼조 — 빅테크 개별 뉴스 중심 선별 대응', red:'미국 약세 — 한국 수출주 동반 하락 주의' };
        return signalHeader(sig, '미국 증시', valTxt, actions[sig]||actions.yellow);
      })(),
      sectionSummary((() => {
        const dow  = us_indices.find(r=>r.name&&r.name.includes('다우'));
        const sp5  = us_indices.find(r=>r.name&&(r.name.includes('S&P')||r.name.includes('S&amp;P')));
        const nas  = us_indices.find(r=>r.name&&r.name.includes('나스닥'));
        const parts = [dow,sp5,nas].filter(Boolean).map(r=>`${r.name} ${r.value}(${r.change_pct})`);
        return parts.length ? parts.join('  |  ') : `조사일: ${BASE_DATE}`;
      })()),
      sp(120),
      new Paragraph({ heading:HeadingLevel.HEADING_2, children:[new TextRun('2-1. 주요 지수 현황')] }),
      indexTable(us_indices, [3120,2080,2080,2080]),
      sp(200),
      ...chartBlock(['SP500', 'NASDAQ']),
      new Paragraph({ heading:HeadingLevel.HEADING_2, children:[new TextRun('2-2. 주요 이슈')] }),
      ...finalUsIssues.map(t => bullet(t)),
      ...(usHeatmapPath ? [
        sp(200),
        new Paragraph({ heading:HeadingLevel.HEADING_2, children:[new TextRun('2-3. 섹터 ETF 등락률 히트맵')] }),
        body('SPDR 섹터 ETF 기준 미국 업종별 자금 흐름입니다. XLK=기술 / XLF=금융 / XLE=에너지 / XLV=헬스케어 / XLY=임의소비재', { color:'595959', size:18 }),
        sp(80),
        heatmapImage(usHeatmapPath),
      ] : []),
      new Paragraph({ children:[new PageBreak()] }),

      // ── 3. 글로벌 지수 ─────────────────────────────────────────────────────
      new Paragraph({ heading:HeadingLevel.HEADING_1, children:[new TextRun('3. 글로벌 주요 지수')] }),
      sectionSummary(`아시아·유럽 주요 증시 현황  |  ${global_idx.length}개 지수  |  조사일: ${BASE_DATE}`),
      sp(120),
      indexTable(global_idx, [3120,2080,2080,2080]),
      new Paragraph({ children:[new PageBreak()] }),

      // ── 4. 환율 ───────────────────────────────────────────────────────────
      new Paragraph({ heading:HeadingLevel.HEADING_1, children:[new TextRun('4. 환율 현황')] }),
      (() => {
        const usd = fx_rates.find(r=>r.pair==='USD/KRW');
        const usdNum = usd ? parseFloat(String(usd.rate).replace(/,/g,'')) : NaN;
        const lvl = isNaN(usdNum) ? '' : usdNum > 1430 ? ' — 고점 경계권' : usdNum < 1350 ? ' — 안정권' : ' — 주의 구간';
        const valTxt = usd ? `USD/KRW ${usd.rate}원 (${usd.change_pct})${lvl}` : '환율 데이터 없음';
        const sig = _SEC_SIGNAL.fxSig;
        const actions = { green:'원화 강세 — 수입 비용 완화, 외국인 유입 우호적', yellow:'환율 주의 구간 — 수입 기업 비용 부담 점검', red:'원화 약세 고점 — 수입·에너지株 비중 조절, 달러 자산 헷지 고려' };
        return signalHeader(sig, '환율 현황', valTxt, actions[sig]||actions.yellow);
      })(),
      sectionSummary((() => {
        const usd = fx_rates.find(r=>r.pair==='USD/KRW');
        return usd
          ? `달러/원 ${usd.rate}원 (${usd.change_pct})  |  ${fx_rates.length}개 통화쌍  |  조사일: ${REPORT_DATE}`
          : `주요 환율 ${fx_rates.length}개 통화쌍  |  조사일: ${REPORT_DATE}`;
      })()),
      sp(160),
      infoBox('환율이란 무엇인가요?',
        '환율이란 서로 다른 나라의 돈을 교환할 때의 비율입니다. 예를 들어 원/달러 환율이 1,467원이라면 미국 돈 1달러를 사려면 한국 돈 1,467원이 필요하다는 뜻입니다. 환율이 오르면 원화 가치가 떨어진(약해진) 것이고, 내리면 원화 가치가 올라간(강해진) 것입니다. 원화 가치가 떨어지면 수입 물가가 올라 소비자 부담이 커집니다.'),
      sp(160),
      new Paragraph({ heading:HeadingLevel.HEADING_2, children:[new TextRun('4-1. 주요 환율 상세 (설명 포함)')] }),
      body('아래 표의 "이 환율이 무엇인가요?" 열과 "현재 수치의 의미" 열을 함께 읽으시면 쉽게 이해하실 수 있습니다.', { color:'595959', size:18 }),
      sp(100),
      fxDetailTable(),
      sp(200),
      ...chartBlock(['USD_KRW']),
      new Paragraph({ heading:HeadingLevel.HEADING_2, children:[new TextRun('4-2. 환율 종합 분석')] }),
      statusBox('⚠️  원화 약세 지속 — 주의 필요',
        '원화 약세는 에너지 수입 비용 급증과 외국인 주식 매도가 겹친 결과입니다. 수입 물가 상승 → 소비자 물가 상승으로 이어져 일상 속 장바구니 물가에 영향을 미칩니다. 한국은행은 외환시장 쏠림이 뚜렷해지면 대응하겠다는 입장이나, 단기 반전은 어려울 전망입니다.', false),
      new Paragraph({ children:[new PageBreak()] }),

      // ── 5. 거시경제 지표 ───────────────────────────────────────────────────
      new Paragraph({ heading:HeadingLevel.HEADING_1, children:[new TextRun('5. 한국 거시경제 지표')] }),
      body(`조사일: ${REPORT_DATE} 기준 최신 발표치  |  출처: ${SOURCES}`, { color:'595959' }),
      sp(200),
      infoBox('거시경제 지표란 무엇인가요?',
        '거시경제(Macro Economy)란 나라 전체 경제의 큰 그림입니다. 거시경제 지표는 국가 경제의 건강 상태를 숫자로 표현한 것으로, 건강검진표처럼 경제가 지금 건강한지, 걱정스러운 부분은 무엇인지 알 수 있습니다. 아래 표의 설명 열을 함께 읽으시면 쉽게 이해하실 수 있습니다.'),
      sp(160),
      new Paragraph({ heading:HeadingLevel.HEADING_2, children:[new TextRun('5-1. 주요 지표 상세 (설명 포함)')] }),
      macroTable(),
      sp(200),
      new Paragraph({ heading:HeadingLevel.HEADING_2, children:[new TextRun('5-2. 거시경제 종합 분석')] }),
      statusBox('✅  고용 안정 + 경상수지 흑자는 긍정적 신호',
        '실업률이 안정적이며 경상수지도 흑자를 기록하는 것은 한국 경제의 기초 체력이 유지되고 있음을 의미합니다.', true),
      sp(120),
      statusBox('⚠️  저성장 + 물가 상승은 위험 신호',
        '경제성장률이 잠재성장률보다 낮은 상황에서 물가는 계속 오르고 있어 저성장+물가상승(스태그플레이션) 우려가 있습니다. 금리를 올리면 물가는 잡히지만 성장이 더 둔화되고, 내리면 물가와 환율이 더 오를 수 있어 정책 딜레마 상황입니다.', false),
      new Paragraph({ children:[new PageBreak()] }),

      // ── 6. 한국 시총 10위 기업 뉴스 ────────────────────────────────────────
      new Paragraph({ heading:HeadingLevel.HEADING_1, children:[new TextRun('6. 한국 시총 10위 기업 주요 뉴스')] }),
      body('코스피 시가총액 상위 10개 기업의 최신 뉴스와 투자자 관점 해석입니다.', { color:'595959' }),
      sp(80),
      infoBox('시가총액(시총)이란?',
        '시가총액 = 주가 × 발행 주식 수. 즉, 그 기업의 "몸값(전체 가치)"입니다. 시총이 높은 기업일수록 경제 전반에 미치는 영향이 크며, 해당 기업의 뉴스는 증시 전체를 움직이기도 합니다.'),
      sp(160),
      ...companyNewsList(kr_top10, true),
      new Paragraph({ children:[new PageBreak()] }),

      // ── 7. 미국 시총 10위 기업 뉴스 ────────────────────────────────────────
      new Paragraph({ heading:HeadingLevel.HEADING_1, children:[new TextRun('7. 미국 시총 10위 기업 주요 뉴스')] }),
      body('미국 시가총액 상위 10개 기업(빅테크·반도체·금융)의 최신 뉴스와 해석입니다.', { color:'595959' }),
      sp(80),
      infoBox('왜 미국 시총 10위 기업이 중요한가요?',
        '애플·마이크로소프트·엔비디아 등 미국 빅테크는 S&P 500 지수 전체의 30% 이상을 차지합니다. 이들의 뉴스 하나가 전 세계 증시를 움직이며, 삼성전자·SK하이닉스 등 한국 기업의 주가에도 직접 영향을 줍니다.'),
      sp(160),
      ...companyNewsList(us_top10, false),
      new Paragraph({ children:[new PageBreak()] }),

      // ── 8. 주의깊게 볼만한 기업 (워치리스트) ──────────────────────────────
      ...(() => {
        const kr = watchlist.kr || [];
        const us = watchlist.us || [];
        if (kr.length === 0 && us.length === 0) return [];
        const blocks = [
          new Paragraph({ heading:HeadingLevel.HEADING_1, children:[new TextRun('8. 주의깊게 볼만한 기업')] }),
          sectionSummary(`오늘 주목할 종목 — 한국 ${kr.length}개 · 미국 ${us.length}개  |  ${BASE_DATE}`),
          sp(120),
          infoBox('선정 기준', '거래대금 급증 / 외국인 대량 순매수 / 5% 이상 급등락 / 어닝 서프라이즈 / 거시 뉴스 직접 영향 종목을 자동 선별합니다.'),
          sp(120),
        ];
        if (kr.length > 0) {
          blocks.push(new Paragraph({ heading:HeadingLevel.HEADING_2, children:[new TextRun('8-1. 한국 주목 종목')] }));
          blocks.push(watchlistTable(kr, 'kr'));
          blocks.push(sp(160));
        }
        if (us.length > 0) {
          blocks.push(new Paragraph({ heading:HeadingLevel.HEADING_2, children:[new TextRun('8-2. 미국 주목 종목')] }));
          blocks.push(watchlistTable(us, 'us'));
        }
        blocks.push(new Paragraph({ children:[new PageBreak()] }));
        return blocks;
      })(),

      // ── 8-A. 이번주 주요 이벤트 캘린더 ──────────────────────────────────
      ...(() => {
        const ct = calendarTable(event_calendar);
        if (!ct) return [];
        return [
          new Paragraph({ heading:HeadingLevel.HEADING_1, children:[new TextRun('8-A. 이번주 주요 이벤트')] }),
          sectionSummary(`FOMC·CPI·실적발표 등 단기 변동성 이벤트 ${event_calendar.length}건`),
          sp(120),
          infoBox('이벤트 캘린더 활용법', '"높음" 등급 이벤트 발표 전후에는 포지션 조정이 필요할 수 있습니다. 시장 영향도가 높은 이벤트일수록 발표 당일 변동성이 커집니다.'),
          sp(120),
          ct,
          new Paragraph({ children:[new PageBreak()] }),
        ];
      })(),

      // ── 9. 종합 결론 ───────────────────────────────────────────────────────
      new Paragraph({ heading:HeadingLevel.HEADING_1, children:[new TextRun('9. 종합 결론 및 시사점')] }),
      new Paragraph({ heading:HeadingLevel.HEADING_2, children:[new TextRun('9-1. 증시·환율·거시경제 핵심 시사점')] }),
      ...finalConclusions.map(t => bullet(t)),
      ...(co_summary ? [
        sp(200),
        new Paragraph({ heading:HeadingLevel.HEADING_2, children:[new TextRun('9-2. 시총 상위 기업 뉴스 종합 분석')] }),
        infoBox('양국 시총 상위 기업 뉴스가 말하는 것', co_summary),
      ] : []),
      sp(200),
      new Paragraph({ heading:HeadingLevel.HEADING_2, children:[new TextRun('9-3. 투자자를 위한 체크리스트')] }),
      bullet('🇰🇷 국내 시총 1위 기업(삼성전자 등) 뉴스가 부정적이면 → 코스피 전반 하락 가능성 주의'),
      bullet('🇺🇸 엔비디아·애플 등 빅테크 뉴스가 긍정적이면 → 다음 날 한국 반도체 섹터 동반 상승 기대'),
      bullet('원화 약세 지속 시 → 수출 기업(IT·자동차) 수혜, 수입 기업·해외여행 비용 증가'),
      bullet('미국 금리 정책 변화 → 달러 강세/약세로 이어져 원화·신흥국 통화 전반에 연쇄 영향'),
      bullet('GDP 저성장+물가 상승 공존 → 방어적 자산(배당주·채권) 비중 검토 필요'),
      // ── 부록: 이번 호 신규 용어 (있을 때만) ──────────────────────────────
      ...(() => {
        if (!newGlossaryTerms || newGlossaryTerms.length === 0) return [];
        return [
          sp(300),
          new Paragraph({ heading:HeadingLevel.HEADING_2,
            children:[new TextRun('부록: 이번 호 신규 용어')] }),
          body('아래 용어는 이번 보고서에서 처음 등장한 용어입니다. 전체 용어 사전은 docs/glossary/glossary.md를 참조하세요.',
            { color: '595959', size: 18 }),
          sp(80),
          new Table({
            width: { size: FULL_WIDTH, type: WidthType.DXA }, columnWidths: [2200, 7160],
            rows: [
              new TableRow({ tableHeader: true, children: [hCell('용어', 2200), hCell('설명', 7160)] }),
              ...newGlossaryTerms.map((t, i) => {
                const bg = i % 2 === 0 ? COLORS.bg_stripe : COLORS.bg_white;
                return new TableRow({ children: [
                  dCell(t.term, 2200, { bold: true, bg, align: AlignmentType.LEFT }),
                  dCell(t.def,  7160, { bg, align: AlignmentType.LEFT }),
                ]});
              }),
            ],
          }),
          sp(200),
        ];
      })(),
      divider(),
      new Paragraph({ alignment:AlignmentType.CENTER, spacing:{ before:200, after:0 },
        children:[new TextRun({ text:'※ 본 보고서는 투자 참고 목적의 정보 제공이며, 투자 결과에 대한 책임은 이용자 본인에게 있습니다.',
          size:16, font:FONT, color:'7F7F7F' })] }),
    ]
  }]
});

  // ③ DOCX 저장
  const buf = await Packer.toBuffer(doc);
  const dir = path.dirname(outputPath);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(outputPath, buf);
  console.log(`✅ 보고서 저장 완료: ${outputPath}`);

  // ── PDF 변환 (LibreOffice headless) ──────────────────────────────
  let generatedPdfPath = null;
  try {
    const { convertToPdf } = require(path.join(__dirname, 'pdf', 'convert_to_pdf.js'));
    const pdfResult = convertToPdf(outputPath, dir);
    if (pdfResult) {
      generatedPdfPath = pdfResult;
      console.log(`📄 PDF 생성 완료: ${pdfResult}`);
    } else {
      console.log('ℹ️  PDF 변환 건너뜀 (LibreOffice 미설치). DOCX만 저장됨.');
    }
  } catch (pdfErr) {
    console.warn('⚠️  PDF 변환 모듈 오류 (DOCX는 정상 저장됨):', pdfErr.message);
  }
  // ─────────────────────────────────────────────────────────────────

  // ── 이메일 발송 + 파일 정리 ───────────────────────────────────────
  // 발송 조건 (3가지 모두 충족 시):
  //   ① config/email_config.json 존재 (SendGrid API 키 설정됨)
  //   ② PDF 생성 완료 (LibreOffice 변환 성공)
  //   ③ Windows 환경 — Cowork(Linux) 샌드박스는 외부 인터넷 완전 차단이므로 skip
  const emailConfigPath = path.join(__dirname, '..', 'config', 'email_config.json');
  const isWindows       = process.platform === 'win32';

  if (!fs.existsSync(emailConfigPath)) {
    console.log('ℹ️  이메일 설정 없음 — 건너뜀 (config/email_config.json 참고).');
  } else if (!generatedPdfPath) {
    console.log('ℹ️  PDF 없음 — 이메일 건너뜀 (LibreOffice 설치 필요).');
  } else if (!isWindows) {
    console.log('ℹ️  Cowork/Linux 환경 — 외부 인터넷 차단으로 이메일 skip. 카카오톡으로 요약 발송됩니다.');
  } else {
    // Windows 로컬 환경 → SendGrid API로 발송
    try {
      const { sendReport } = require(path.join(__dirname, 'email', 'send_report.js'));
      const result = await sendReport(generatedPdfPath, outputPath);
      console.log(`📧 이메일 발송 완료 → ${result.to} | 제목: ${result.subject}`);
      // 발송 성공 후 로컬 파일 삭제 (이메일로 전달됐으므로)
      [generatedPdfPath, outputPath].forEach(f => {
        try {
          if (fs.existsSync(f)) { fs.unlinkSync(f); console.log(`🗑️  삭제: ${path.basename(f)}`); }
        } catch (e) { console.warn('⚠️  파일 삭제 실패 (발송은 완료됨):', e.message); }
      });
    } catch (mailErr) {
      console.warn('⚠️  SendGrid 발송 실패 — 파일 유지:', mailErr.message);
      if (mailErr.response) console.warn('   오류 상세:', JSON.stringify(mailErr.response.body));
    }
  }
  // ─────────────────────────────────────────────────────────────────

})().catch(err => {
  console.error('❌ 보고서 생성 실패:', err.message);
  process.exit(1);
});
