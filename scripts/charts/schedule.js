/**
 * schedule.js
 * 오늘 날짜 기준으로 어떤 주기의 차트를 생성할지 결정합니다.
 *
 * 규칙:
 *   일일 차트 (7거래일): 매일 생성
 *   주간 차트 (4주):     월요일(dayOfWeek === 1)에만 생성
 *   월간 차트 (1년):     매월 1일(date === 1)에만 생성
 */

'use strict';

/**
 * @param {Date} [now] - 기준 날짜 (기본값: 오늘)
 * @returns {{ daily: boolean, weekly: boolean, monthly: boolean }}
 */
function getChartSchedule(now = new Date()) {
  const dayOfWeek = now.getDay();  // 0=일, 1=월, ..., 6=토
  const date      = now.getDate(); // 1~31

  return {
    daily:   true,
    weekly:  dayOfWeek === 1,   // 월요일
    monthly: date === 1,        // 매월 1일
  };
}

module.exports = { getChartSchedule };
