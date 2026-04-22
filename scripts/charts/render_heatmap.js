/**
 * render_heatmap.js
 * 섹터별 등락률 히트맵 PNG를 생성합니다.
 *
 * 색상 규칙:
 *   +2% 이상  → 진초록 (#1B5E20)
 *   0 ~ +2%   → 연초록 (#A5D6A7)
 *   0 ~ -2%   → 연빨강 (#EF9A9A)
 *   -2% 이하  → 진빨강 (#B71C1C)
 *   데이터 없음 → 회색  (#BDBDBD)
 */

'use strict';

const path = require('path');
const fs   = require('fs');

let ChartJSNodeCanvas;
try {
  ({ ChartJSNodeCanvas } = require('chartjs-node-canvas'));
} catch (e) {
  console.warn('[히트맵] chartjs-node-canvas 미설치 — 히트맵 생성 건너뜀');
  ChartJSNodeCanvas = null;
}

/**
 * 등락률 문자열 → 숫자 변환
 * "+1.23%" → 1.23 / "-0.55%" → -0.55
 */
function parsePct(str) {
  if (str === null || str === undefined) return null;
  const n = parseFloat(String(str).replace(/[^0-9.\-+]/g, ''));
  return isNaN(n) ? null : n;
}

/**
 * 등락률 → 배경색
 */
function heatColor(pct) {
  if (pct === null) return '#BDBDBD';
  if (pct >=  2)   return '#1B5E20';
  if (pct >=  0)   return '#81C784';
  if (pct >= -2)   return '#E57373';
  return '#B71C1C';
}

/**
 * 텍스트 색 (배경에 따라 흰/검)
 */
function textColor(pct) {
  if (pct === null) return '#333333';
  return (pct >= 2 || pct <= -2) ? '#FFFFFF' : '#1A1A1A';
}

/**
 * 섹터 히트맵 PNG 생성
 *
 * @param {object} opts
 * @param {string}   opts.title        차트 제목
 * @param {{ name: string, change_pct: string }[]} opts.sectors  섹터 배열
 * @param {string}   opts.outputPath   저장 경로
 * @param {number}   [opts.cols=4]     한 행의 셀 수
 * @param {number}   [opts.width=900]
 * @param {number}   [opts.height=320]
 * @returns {Promise<string|null>}
 */
async function renderHeatmap({ title, sectors, outputPath, cols = 4, width = 900, height = 320 }) {
  if (!ChartJSNodeCanvas || !sectors || sectors.length === 0) return null;

  try {
    const canvas = new ChartJSNodeCanvas({ width, height, backgroundColour: '#FFFFFF' });

    // chartjs 자체로 히트맵을 그리기 어려우므로,
    // beforeDraw 플러그인으로 캔버스에 직접 그립니다.
    const rows     = Math.ceil(sectors.length / cols);
    const cellW    = width  / cols;
    const cellH    = (height - 48) / rows;   // 48px = 제목 영역
    const titleH   = 40;
    const padding  = 6;

    const config = {
      type: 'bar',   // dummy — 실제 렌더링은 플러그인에서 수행
      data: { datasets: [] },
      options: {
        responsive: false,
        animation: false,
        plugins: { legend: { display: false }, tooltip: { enabled: false } },
        scales: { x: { display: false }, y: { display: false } },
      },
      plugins: [{
        id: 'heatmapRenderer',
        beforeDraw(chart) {
          const ctx = chart.ctx;
          ctx.clearRect(0, 0, width, height);
          ctx.fillStyle = '#FFFFFF';
          ctx.fillRect(0, 0, width, height);

          // 제목
          ctx.fillStyle  = '#1F4E79';
          ctx.font       = 'bold 16px Arial';
          ctx.textAlign  = 'center';
          ctx.fillText(title, width / 2, 26);

          // 섹터 셀
          sectors.forEach((sec, idx) => {
            const col  = idx % cols;
            const row  = Math.floor(idx / cols);
            const x    = col * cellW + padding;
            const y    = titleH + row * cellH + padding;
            const w    = cellW - padding * 2;
            const h    = cellH - padding * 2;
            const pct  = parsePct(sec.change_pct);
            const bg   = heatColor(pct);
            const fg   = textColor(pct);

            // 배경
            ctx.fillStyle = bg;
            ctx.beginPath();
            ctx.roundRect(x, y, w, h, 6);
            ctx.fill();

            // 섹터명
            ctx.fillStyle  = fg;
            ctx.font       = `bold 13px Arial`;
            ctx.textAlign  = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(
              sec.name.length > 6 ? sec.name.slice(0, 6) + '…' : sec.name,
              x + w / 2,
              y + h / 2 - 9,
            );

            // 등락률
            const label = pct !== null
              ? `${pct >= 0 ? '+' : ''}${pct.toFixed(2)}%`
              : '-';
            ctx.font = `12px Arial`;
            ctx.fillText(label, x + w / 2, y + h / 2 + 9);
          });
        },
      }],
    };

    const buffer = await canvas.renderToBuffer(config);
    const dir = path.dirname(outputPath);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(outputPath, buffer);
    console.log(`[히트맵] 생성 완료: ${outputPath}`);
    return outputPath;

  } catch (err) {
    console.warn(`[히트맵] 생성 실패 (${title}):`, err.message);
    return null;
  }
}

module.exports = { renderHeatmap, parsePct };
