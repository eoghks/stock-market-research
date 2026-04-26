'use strict';

/**
 * send_report.js — 증시 보고서 PDF 이메일 발송
 *
 * 사용법:
 *   node send_report.js <pdf_path> [docx_path]
 *
 * 설정:
 *   config/email_config.json 에 SMTP 정보 저장
 */

const path = require('path');
const fs   = require('fs');

// ── 설정 로드 ──────────────────────────────────────────────────────────────
const CONFIG_PATH = path.join(__dirname, '..', '..', 'config', 'email_config.json');

function loadConfig() {
  if (!fs.existsSync(CONFIG_PATH)) {
    throw new Error(
      `이메일 설정 파일이 없습니다: ${CONFIG_PATH}\n` +
      `config/email_config.json 을 생성하세요. (config/email_config.example.json 참고)`
    );
  }
  return JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8'));
}

// ── nodemailer 동적 로드 (설치 여부 확인) ────────────────────────────────
function requireNodemailer() {
  try {
    return require('nodemailer');
  } catch {
    throw new Error(
      'nodemailer 패키지가 설치되어 있지 않습니다.\n' +
      'scripts/ 디렉토리에서 실행하세요: npm install nodemailer'
    );
  }
}

// ── 메일 발송 ─────────────────────────────────────────────────────────────
async function sendReport(pdfPath, docxPath) {
  const config     = loadConfig();
  const nodemailer = requireNodemailer();

  if (!fs.existsSync(pdfPath)) {
    throw new Error(`PDF 파일을 찾을 수 없습니다: ${pdfPath}`);
  }

  // 파일명에서 날짜 추출 (예: 증시 조사-20260427-0930.pdf)
  const basename    = path.basename(pdfPath, '.pdf');
  const dateMatch   = basename.match(/(\d{8}-\d{4})/);
  const dateLabel   = dateMatch ? dateMatch[1].replace('-', ' ') : new Date().toLocaleDateString('ko-KR');
  const subject     = `${config.subject_prefix} ${dateLabel}`;

  // 첨부 파일 목록
  const attachments = [
    {
      filename: path.basename(pdfPath),
      path:     pdfPath,
      contentType: 'application/pdf',
    },
  ];

  // DOCX도 함께 첨부 (선택)
  if (docxPath && fs.existsSync(docxPath)) {
    attachments.push({
      filename: path.basename(docxPath),
      path:     docxPath,
      contentType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    });
  }

  const transporter = nodemailer.createTransport(config.smtp);

  // 연결 확인
  await transporter.verify();

  const info = await transporter.sendMail({
    from:        config.from,
    to:          config.to,
    subject,
    text:        `안녕하세요.\n\n${dateLabel} 증시 조사 보고서를 첨부합니다.\n\nClaude 자동 발송`,
    attachments,
  });

  return {
    messageId: info.messageId,
    to:        config.to,
    subject,
    pdfSize:   (fs.statSync(pdfPath).size / 1024).toFixed(1) + ' KB',
  };
}

// ── CLI 직접 실행 ──────────────────────────────────────────────────────────
if (require.main === module) {
  const [,, pdfPath, docxPath] = process.argv;

  if (!pdfPath) {
    console.error('사용법: node send_report.js <pdf_path> [docx_path]');
    process.exit(1);
  }

  sendReport(pdfPath, docxPath)
    .then(result => {
      console.log('✅ 이메일 발송 완료');
      console.log(`   받는 사람: ${result.to}`);
      console.log(`   제목:      ${result.subject}`);
      console.log(`   PDF 크기:  ${result.pdfSize}`);
    })
    .catch(err => {
      console.error('❌ 이메일 발송 실패:', err.message);
      process.exit(1);
    });
}

module.exports = { sendReport };
