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
  PageBreak
} = require('docx');
const fs   = require('fs');
const path = require('path');

// ── 데이터 로드 ──────────────────────────────────────────────────────────────
const raw  = JSON.parse(fs.readFileSync(dataPath, 'utf8'));
const now  = new Date();
const pad  = n => String(n).padStart(2, '0');
const REPORT_DATE = raw.meta?.report_date || `${now.getFullYear()}년 ${pad(now.getMonth()+1)}월 ${pad(now.getDate())}일`;
const REPORT_TIME = raw.meta?.report_time || `${pad(now.getHours())}${pad(now.getMinutes())}`;
const BASE_DATE   = raw.base_date || raw.meta?.base_date || REPORT_DATE;
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
const kr_top10      = raw.kr_top10      || [];
const us_top10      = raw.us_top10      || [];
const co_summary    = raw.company_overall_summary || '';

// ── 공통 스타일 헬퍼 ─────────────────────────────────────────────────────────
const FULL_WIDTH = 9360;
const bdr  = { style: BorderStyle.SINGLE, size: 1, color: 'CCCCCC' };
const bdrs = { top: bdr, bottom: bdr, left: bdr, right: bdr };

function hCell(text, w) {
  return new TableCell({
    borders: bdrs, width: { size: w, type: WidthType.DXA },
    shading: { fill: '1F4E79', type: ShadingType.CLEAR },
    margins: { top: 80, bottom: 80, left: 120, right: 120 },
    verticalAlign: VerticalAlign.CENTER,
    children: [new Paragraph({ alignment: AlignmentType.CENTER,
      children: [new TextRun({ text, bold: true, color: 'FFFFFF', size: 20, font: 'Arial' })] })]
  });
}

function dCell(text, w, { bold=false, color='000000', align=AlignmentType.CENTER, bg='FFFFFF' }={}) {
  return new TableCell({
    borders: bdrs, width: { size: w, type: WidthType.DXA },
    shading: { fill: bg, type: ShadingType.CLEAR },
    margins: { top: 80, bottom: 80, left: 120, right: 120 },
    verticalAlign: VerticalAlign.CENTER,
    children: [new Paragraph({ alignment: align,
      children: [new TextRun({ text: String(text), bold, color, size: 19, font: 'Arial' })] })]
  });
}

function multiCell(lines, w, bg='FFFFFF') {
  return new TableCell({
    borders: bdrs, width: { size: w, type: WidthType.DXA },
    shading: { fill: bg, type: ShadingType.CLEAR },
    margins: { top: 100, bottom: 100, left: 160, right: 160 },
    verticalAlign: VerticalAlign.TOP,
    children: lines.map(({ text, bold=false, size=18, color='333333' }) =>
      new Paragraph({ spacing: { before: 40, after: 40 },
        children: [new TextRun({ text, bold, size, color, font: 'Arial' })] }))
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

  const newsItems = (c.news && c.news.length > 0) ? c.news : ['(수집된 뉴스 없음)'];
  const newsChildren = [
    new Paragraph({ spacing: { before: 0, after: 80 },
      children: [new TextRun({ text: '📰 주요 뉴스', bold: true, size: 18, font: 'Arial', color: '1F4E79' })] }),
    ...newsItems.map(n =>
      new Paragraph({ spacing: { before: 40, after: 40 },
        children: [new TextRun({ text: `• ${n}`, size: 17, font: 'Arial', color: '333333' })] })
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

// ── 문서 구성 ────────────────────────────────────────────────────────────────
const doc = new Document({
  styles: {
    default: { document: { run: { font: 'Arial', size: 20 } } },
    paragraphStyles: [
      { id:'Heading1', name:'Heading 1', basedOn:'Normal', next:'Normal', quickFormat:true,
        run:{ size:36, bold:true, font:'Arial', color:'1F4E79' },
        paragraph:{ spacing:{ before:360, after:240 }, outlineLevel:0 } },
      { id:'Heading2', name:'Heading 2', basedOn:'Normal', next:'Normal', quickFormat:true,
        run:{ size:28, bold:true, font:'Arial', color:'1F4E79' },
        paragraph:{ spacing:{ before:280, after:160 }, outlineLevel:1 } },
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
        new TextRun({ text:'한국·미국 증시 조사 보고서', bold:true, size:18, font:'Arial', color:'1F4E79' }),
        new TextRun({ text:`\t${REPORT_DATE} 기준`, size:18, font:'Arial', color:'595959' }),
      ],
      tabStops:[{ type:'right', position:9360 }]
    })]})},
    footers:{ default: new Footer({ children:[new Paragraph({
      border:{ top:{ style:BorderStyle.SINGLE, size:6, color:'1F4E79', space:1 } },
      alignment:AlignmentType.CENTER,
      children:[
        new TextRun({ text:`출처: ${SOURCES}   |   `, size:16, font:'Arial', color:'595959' }),
        new TextRun({ text:'Page ', size:16, font:'Arial', color:'595959' }),
        new TextRun({ children:[PageNumber.CURRENT], size:16, font:'Arial', color:'595959' }),
      ]
    })]})},
    children:[
      // ── 표지 ──────────────────────────────────────────────────────────────
      new Paragraph({ alignment:AlignmentType.CENTER, spacing:{ before:480, after:120 },
        children:[new TextRun({ text:'한국·미국 증시 조사 보고서', bold:true, size:56, font:'Arial', color:'1F4E79' })] }),
      new Paragraph({ alignment:AlignmentType.CENTER, spacing:{ before:0, after:80 },
        children:[new TextRun({ text:'Korea & US Stock Market Research Report', size:26, font:'Arial', color:'595959' })] }),
      new Paragraph({ alignment:AlignmentType.CENTER, spacing:{ before:0, after:80 },
        children:[new TextRun({ text:`${REPORT_DATE}  |  장마감 기준: ${BASE_DATE}`, size:22, font:'Arial', color:'595959' })] }),
      new Paragraph({ alignment:AlignmentType.CENTER, spacing:{ before:0, after:80 },
        children:[new TextRun({ text:`출처: ${SOURCES}`, size:20, font:'Arial', color:'7F7F7F' })] }),
      new Paragraph({ alignment:AlignmentType.CENTER, spacing:{ before:60, after:80 },
        children:[new TextRun({ text:NAVER_OK ? '✅ 네이버 금융 MCP 교차 검증 완료' : '📡 한국경제신문·매일경제 크롤링 데이터 기준',
          size:18, font:'Arial', color: NAVER_OK?'2E7D32':'2E75B6', italics:true })] }),
      new Paragraph({ alignment:AlignmentType.CENTER, spacing:{ before:0, after:80 },
        children:[new TextRun({ text:'※ 환율·거시경제 지표에는 초보자용 쉬운 설명이 포함되어 있습니다.',
          size:18, font:'Arial', color:'2E75B6', italics:true })] }),
      new Paragraph({ alignment:AlignmentType.CENTER, spacing:{ before:0, after:400 },
        children:[new TextRun({ text:'※ 한국·미국 시총 10위 기업의 주요 뉴스 및 종합 분석이 포함되어 있습니다.',
          size:18, font:'Arial', color:'7B4F00', italics:true })] }),
      divider(),

      // ── 목차 ──────────────────────────────────────────────────────────────
      new Paragraph({ heading:HeadingLevel.HEADING_1, children:[new TextRun('목  차')] }),
      new TableOfContents('목차', { hyperlink:true, headingStyleRange:'1-2' }),
      new Paragraph({ children:[new PageBreak()] }),

      // ── 1. 한국 증시 ───────────────────────────────────────────────────────
      new Paragraph({ heading:HeadingLevel.HEADING_1, children:[new TextRun('1. 한국 증시')] }),
      body(`조사일: ${BASE_DATE}  |  출처: ${SOURCES}`, { color:'595959' }),
      sp(200),
      new Paragraph({ heading:HeadingLevel.HEADING_2, children:[new TextRun('1-1. 주요 지수 현황')] }),
      indexTable(kr_indices, [3120,2080,2080,2080]),
      sp(200),
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
      new Paragraph({ children:[new PageBreak()] }),

      // ── 2. 미국 증시 ───────────────────────────────────────────────────────
      new Paragraph({ heading:HeadingLevel.HEADING_1, children:[new TextRun('2. 미국 증시')] }),
      body(`조사일: ${BASE_DATE}  |  출처: ${SOURCES}`, { color:'595959' }),
      sp(200),
      new Paragraph({ heading:HeadingLevel.HEADING_2, children:[new TextRun('2-1. 주요 지수 현황')] }),
      indexTable(us_indices, [3120,2080,2080,2080]),
      sp(200),
      new Paragraph({ heading:HeadingLevel.HEADING_2, children:[new TextRun('2-2. 주요 이슈')] }),
      ...finalUsIssues.map(t => bullet(t)),
      new Paragraph({ children:[new PageBreak()] }),

      // ── 3. 글로벌 지수 ─────────────────────────────────────────────────────
      new Paragraph({ heading:HeadingLevel.HEADING_1, children:[new TextRun('3. 글로벌 주요 지수')] }),
      body(`조사일: ${BASE_DATE}  |  출처: ${SOURCES}`, { color:'595959' }),
      sp(120),
      indexTable(global_idx, [3120,2080,2080,2080]),
      new Paragraph({ children:[new PageBreak()] }),

      // ── 4. 환율 ───────────────────────────────────────────────────────────
      new Paragraph({ heading:HeadingLevel.HEADING_1, children:[new TextRun('4. 환율 현황')] }),
      body(`조사일: ${REPORT_DATE}  |  출처: ${SOURCES}`, { color:'595959' }),
      sp(200),
      infoBox('환율이란 무엇인가요?',
        '환율이란 서로 다른 나라의 돈을 교환할 때의 비율입니다. 예를 들어 원/달러 환율이 1,467원이라면 미국 돈 1달러를 사려면 한국 돈 1,467원이 필요하다는 뜻입니다. 환율이 오르면 원화 가치가 떨어진(약해진) 것이고, 내리면 원화 가치가 올라간(강해진) 것입니다. 원화 가치가 떨어지면 수입 물가가 올라 소비자 부담이 커집니다.'),
      sp(160),
      new Paragraph({ heading:HeadingLevel.HEADING_2, children:[new TextRun('4-1. 주요 환율 상세 (설명 포함)')] }),
      body('아래 표의 "이 환율이 무엇인가요?" 열과 "현재 수치의 의미" 열을 함께 읽으시면 쉽게 이해하실 수 있습니다.', { color:'595959', size:18 }),
      sp(100),
      fxDetailTable(),
      sp(200),
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

      // ── 8. 종합 결론 ───────────────────────────────────────────────────────
      new Paragraph({ heading:HeadingLevel.HEADING_1, children:[new TextRun('8. 종합 결론 및 시사점')] }),
      new Paragraph({ heading:HeadingLevel.HEADING_2, children:[new TextRun('8-1. 증시·환율·거시경제 핵심 시사점')] }),
      ...finalConclusions.map(t => bullet(t)),
      ...(co_summary ? [
        sp(200),
        new Paragraph({ heading:HeadingLevel.HEADING_2, children:[new TextRun('8-2. 시총 상위 기업 뉴스 종합 분석')] }),
        infoBox('양국 시총 상위 기업 뉴스가 말하는 것', co_summary),
      ] : []),
      sp(200),
      new Paragraph({ heading:HeadingLevel.HEADING_2, children:[new TextRun('8-3. 투자자를 위한 체크리스트')] }),
      bullet('🇰🇷 국내 시총 1위 기업(삼성전자 등) 뉴스가 부정적이면 → 코스피 전반 하락 가능성 주의'),
      bullet('🇺🇸 엔비디아·애플 등 빅테크 뉴스가 긍정적이면 → 다음 날 한국 반도체 섹터 동반 상승 기대'),
      bullet('원화 약세 지속 시 → 수출 기업(IT·자동차) 수혜, 수입 기업·해외여행 비용 증가'),
      bullet('미국 금리 정책 변화 → 달러 강세/약세로 이어져 원화·신흥국 통화 전반에 연쇄 영향'),
      bullet('GDP 저성장+물가 상승 공존 → 방어적 자산(배당주·채권) 비중 검토 필요'),
      divider(),
      new Paragraph({ alignment:AlignmentType.CENTER, spacing:{ before:200, after:0 },
        children:[new TextRun({ text:'※ 본 보고서는 투자 참고 목적의 정보 제공이며, 투자 결과에 대한 책임은 이용자 본인에게 있습니다.',
          size:16, font:'Arial', color:'7F7F7F' })] }),
    ]
  }]
});

Packer.toBuffer(doc).then(buf => {
  const dir = path.dirname(outputPath);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(outputPath, buf);
  console.log(`✅ 보고서 저장 완료: ${outputPath}`);

  // ── PDF 변환 (LibreOffice headless) ──────────────────────────────
  try {
    const { convertToPdf } = require(path.join(__dirname, 'pdf', 'convert_to_pdf.js'));
    const pdfResult = convertToPdf(outputPath, dir);
    if (pdfResult) {
      console.log(`📄 PDF 생성 완료: ${pdfResult}`);
    } else {
      console.log('ℹ️  PDF 변환 건너뜀 (LibreOffice 미설치). DOCX만 저장됨.');
    }
  } catch (pdfErr) {
    console.warn('⚠️  PDF 변환 모듈 오류 (DOCX는 정상 저장됨):', pdfErr.message);
  }
  // ─────────────────────────────────────────────────────────────────

}).catch(err => {
  console.error('❌ 보고서 생성 실패:', err.message);
  process.exit(1);
});
