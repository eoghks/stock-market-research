/**
 * render_chart.js
 * chartjs-node-canvas로 시계열 라인차트 PNG를 생성합니다.
 *
 * 사용법:
 *   const { renderLineChart } = require('./render_chart');
 *   const pngPath = await renderLineChart({
 *     title: '코스피 (7일)',
 *     labels: ['04/14', '04/15', ...],
 *     datasets: [{ label: '코스피', data: [2580, 2595, ...], color: '#1F4E79' }],
 *     outputPath: '/path/to/kospi_daily.png',
 *     width: 900, height: 360,
 *   });
 */

'use strict';

const path = require('path');
const fs   = require('fs');

let ChartJSNodeCanvas;
try {
  ({ ChartJSNodeCanvas } = require('chartjs-node-canvas'));
} catch (e) {
  console.warn('[차트] chartjs-node-canvas 미설치 — 차트 생성 건너뜀');
  ChartJSNodeCanvas = null;
}

/**
 * @param {object} opts
 * @param {string}   opts.title       차트 제목
 * @param {string[]} opts.labels      X축 레이블 배열
 * @param {{ label:string, data:number[], color:string }[]} opts.datasets
 * @param {string}   opts.outputPath  저장할 PNG 경로
 * @param {number}   [opts.width=900]
 * @param {number}   [opts.height=360]
 * @returns {Promise<string|null>} 저장된 PNG 경로, 실패 시 null
 */
async function renderLineChart({ title, labels, datasets, outputPath, width = 900, height = 360 }) {
  if (!ChartJSNodeCanvas) return null;

  try {
    const canvas = new ChartJSNodeCanvas({ width, height, backgroundColour: '#FFFFFF' });

    const chartDatasets = datasets.map(ds => ({
      label:           ds.label,
      data:            ds.data,
      borderColor:     ds.color || '#1F4E79',
      backgroundColor: (ds.color || '#1F4E79') + '22', // 투명 fill
      borderWidth:     2.5,
      pointRadius:     4,
      pointHoverRadius:6,
      tension:         0.3,
      fill:            true,
    }));

    const config = {
      type: 'line',
      data: { labels, datasets: chartDatasets },
      options: {
        responsive: false,
        plugins: {
          title:  { display: true, text: title, font: { size: 16, weight: 'bold' }, color: '#1F4E79', padding: { bottom: 12 } },
          legend: { position: 'top', labels: { font: { size: 12 }, color: '#595959' } },
        },
        scales: {
          x: {
            grid: { color: '#E8EEF5' },
            ticks: { font: { size: 11 }, color: '#595959' },
          },
          y: {
            grid: { color: '#E8EEF5' },
            ticks: { font: { size: 11 }, color: '#595959' },
          },
        },
      },
    };

    const buffer = await canvas.renderToBuffer(config);
    const dir = path.dirname(outputPath);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(outputPath, buffer);
    console.log(`[차트] 생성 완료: ${outputPath}`);
    return outputPath;

  } catch (err) {
    console.warn(`[차트] 생성 실패 (${title}):`, err.message);
    return null;
  }
}

module.exports = { renderLineChart };
