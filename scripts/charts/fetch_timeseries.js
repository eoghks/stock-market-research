/**
 * fetch_timeseries.js
 * 시계열 데이터를 merged_data.json 에서 추출하거나
 * Naver MCP / 한국경제 datacenter 에서 수집합니다.
 *
 * 우선순위:
 *   1차: merged_data.json 내 timeseries 필드 (수집 에이전트가 미리 채운 경우)
 *   2차: 없으면 skip (Claude 에이전트가 크롤링해 timeseries 필드를 채워야 함)
 *
 * 이 모듈은 데이터 변환·포맷 역할을 담당합니다.
 * 실제 크롤링은 SKILL.md Step 1.5 지침에 따라 Claude in Chrome 에이전트가 수행합니다.
 */

'use strict';

/**
 * merged_data.json 에서 심볼별 시계열 데이터를 추출합니다.
 *
 * @param {object} mergedData - merged_data.json 파싱 결과
 * @param {string} symbol     - 예: 'KOSPI', 'SP500', 'USD_KRW'
 * @param {'daily'|'weekly'|'monthly'} period
 * @returns {{ labels: string[], values: number[] } | null}
 */
function extractTimeseries(mergedData, symbol, period) {
  const ts = mergedData?.timeseries;
  if (!ts) return null;

  const key = `${symbol}_${period}`;
  const series = ts[key] || ts[symbol];
  if (!series || !Array.isArray(series) || series.length === 0) return null;

  // 최대 포인트 제한
  const maxPoints = { daily: 7, weekly: 4, monthly: 12 };
  const slice = series.slice(-maxPoints[period]);

  return {
    labels: slice.map(p => p.date || p.label || ''),
    values: slice.map(p => parseFloat(p.value || p.close || p.price || 0)),
  };
}

/**
 * 주어진 심볼 목록에 대해 시계열 데이터를 준비합니다.
 *
 * @param {object} mergedData
 * @param {'daily'|'weekly'|'monthly'} period
 * @returns {object[]} [{ symbol, label, color, labels, values }]
 */
function prepareChartData(mergedData, period) {
  const targets = [
    { symbol: 'KOSPI',   label: '코스피',    color: '#1F4E79' },
    { symbol: 'KOSDAQ',  label: '코스닥',    color: '#2E75B6' },
    { symbol: 'SP500',   label: 'S&P 500',   color: '#C00000' },
    { symbol: 'NASDAQ',  label: '나스닥',    color: '#7030A0' },
    { symbol: 'USD_KRW', label: 'USD/KRW',  color: '#ED7D31' },
  ];

  return targets
    .map(t => {
      const ts = extractTimeseries(mergedData, t.symbol, period);
      if (!ts) return null;
      return { ...t, labels: ts.labels, values: ts.values };
    })
    .filter(Boolean);
}

module.exports = { extractTimeseries, prepareChartData };
