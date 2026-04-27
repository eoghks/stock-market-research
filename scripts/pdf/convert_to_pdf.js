#!/usr/bin/env node
/**
 * convert_to_pdf.js
 * DOCX → PDF 변환 (LibreOffice headless 사용)
 *
 * 사용법:
 *   node convert_to_pdf.js <input.docx> [output_dir]
 *
 * 예시:
 *   node convert_to_pdf.js "증시 조사-20260422-1430.docx"
 *   node convert_to_pdf.js "증시 조사-20260422-1430.docx" "./output"
 *
 * 의존성: LibreOffice (soffice) 설치 필요
 *   → docs/usage/pdf-setup.md 참고
 */

'use strict';

const { execSync, spawnSync } = require('child_process');
const path = require('path');
const fs = require('fs');

// ─────────────────────────────────────────────
// LibreOffice 실행 파일 경로 탐색
// ─────────────────────────────────────────────
function findSoffice() {
  // 절대 경로는 파일 존재 여부로 확인 (spawnSync --version이 느릴 수 있음)
  const fileCandidates = [
    'C:/Program Files/LibreOffice/program/soffice.exe',             // Windows 기본 설치
    'C:/Program Files (x86)/LibreOffice/program/soffice.exe',      // 32bit Windows
    '/usr/bin/soffice',                                             // Linux
    '/usr/lib/libreoffice/program/soffice',                        // Linux alt
    '/Applications/LibreOffice.app/Contents/MacOS/soffice',        // macOS
  ];

  for (const p of fileCandidates) {
    if (fs.existsSync(p)) return p;
  }

  // PATH에서 탐색 (환경 변수에 등록된 경우)
  try {
    const result = spawnSync('soffice', ['--version'], { timeout: 8000 });
    if (result.status === 0) return 'soffice';
  } catch (_) { /* skip */ }

  return null;
}

// ─────────────────────────────────────────────
// INSTALL 가이드 출력
// ─────────────────────────────────────────────
function printInstallGuide() {
  console.error(`
╔══════════════════════════════════════════════════════════╗
║         LibreOffice가 설치되어 있지 않습니다             ║
╠══════════════════════════════════════════════════════════╣
║                                                          ║
║  Windows:                                                ║
║    1. https://www.libreoffice.org/download 에서 설치     ║
║    2. 설치 후 PATH 등록:                                 ║
║       C:\\Program Files\\LibreOffice\\program             ║
║    3. 또는 docs/usage/pdf-setup.md 참고                  ║
║                                                          ║
║  빠른 설치 (winget):                                     ║
║    winget install TheDocumentFoundation.LibreOffice      ║
║                                                          ║
╚══════════════════════════════════════════════════════════╝
`);
}

// ─────────────────────────────────────────────
// 메인 변환 함수
// ─────────────────────────────────────────────
function convertToPdf(inputDocx, outputDir) {
  // 1. 입력 파일 확인
  const absInput = path.resolve(inputDocx);
  if (!fs.existsSync(absInput)) {
    console.error(`[PDF 변환] 오류: 파일을 찾을 수 없습니다 — ${absInput}`);
    process.exit(1);
  }

  // 2. 출력 디렉토리 설정
  const absOutputDir = outputDir
    ? path.resolve(outputDir)
    : path.dirname(absInput);

  if (!fs.existsSync(absOutputDir)) {
    fs.mkdirSync(absOutputDir, { recursive: true });
  }

  // 3. LibreOffice 탐색
  const soffice = findSoffice();
  if (!soffice) {
    printInstallGuide();
    console.warn('[PDF 변환] LibreOffice 없음 — DOCX만 유지합니다.');
    return null;
  }

  // 4. 변환 실행
  const cmd = `"${soffice}" --headless --convert-to pdf --outdir "${absOutputDir}" "${absInput}"`;
  console.log(`[PDF 변환] 실행 중...`);
  console.log(`  입력: ${absInput}`);
  console.log(`  출력: ${absOutputDir}`);

  try {
    execSync(cmd, { stdio: 'pipe', timeout: 60000 });
  } catch (err) {
    console.error('[PDF 변환] 변환 실패:', err.stderr?.toString() || err.message);
    return null;
  }

  // 5. 결과 파일 경로 계산
  const baseName = path.basename(absInput, '.docx');
  const pdfPath = path.join(absOutputDir, `${baseName}.pdf`);

  if (fs.existsSync(pdfPath)) {
    const size = (fs.statSync(pdfPath).size / 1024).toFixed(1);
    console.log(`[PDF 변환] 완료: ${pdfPath} (${size} KB)`);
    return pdfPath;
  } else {
    console.warn('[PDF 변환] 변환 완료됐으나 결과 파일을 찾을 수 없습니다.');
    return null;
  }
}

// ─────────────────────────────────────────────
// CLI 진입점
// ─────────────────────────────────────────────
if (require.main === module) {
  const [,, inputArg, outputDirArg] = process.argv;

  if (!inputArg) {
    console.error('사용법: node convert_to_pdf.js <input.docx> [output_dir]');
    process.exit(1);
  }

  const result = convertToPdf(inputArg, outputDirArg);
  process.exit(result ? 0 : 1);
}

module.exports = { convertToPdf, findSoffice };
