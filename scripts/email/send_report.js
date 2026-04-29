'use strict';

/**
 * send_report.js — 증시 보고서 PDF 이메일 발송 (SendGrid)
 *
 * 사용법:
 *   node send_report.js <pdf_path> [docx_path]
 *
 * 설정:
 *   config/email_config.json 에 SendGrid API 키 저장 (gitignore됨)
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

// ── @sendgrid/mail 동적 로드 ──────────────────────────────────────────────
function requireSendGrid() {
  try {
    return require('@sendgrid/mail');
  } catch {
    throw new Error(
      '@sendgrid/mail 패키지가 설치되어 있지 않습니다.\n' +
      'scripts/ 디렉토리에서 실행하세요: npm install @sendgrid/mail'
    );
  }
}

// ── 메일 발송 ─────────────────────────────────────────────────────────────
async function sendReport(pdfPath, docxPath) {
  const config = loadConfig();
  const sgMail = requireSendGrid();

  if (!fs.existsSync(pdfPath)) {
    throw new Error(`PDF 파일을 찾을 수 없습니다: ${pdfPath}`);
  }

  // API 키 설정
  const apiKey = config.sendgrid && config.sendgrid.api_key;
  if (!apiKey) {
    throw new Error('email_config.json 에 sendgrid.api_key 가 없습니다.');
  }
  sgMail.setApiKey(apiKey);

  // KST 기준 발송 시각
  const _kst = new Date(Date.now() + 9 * 3600 * 1000);
  const _pad = n => String(n).padStart(2, '0');
  const dateLabel =
    `${_kst.getUTCFullYear()}-${_pad(_kst.getUTCMonth() + 1)}-${_pad(_kst.getUTCDate())} ` +
    `${_pad(_kst.getUTCHours())}:${_pad(_kst.getUTCMinutes())} KST`;
  const subject = `${config.subject_prefix} ${dateLabel}`;

  // 첨부 파일 (SendGrid는 Base64 인코딩 필요)
  const attachments = [
    {
      content:     fs.readFileSync(pdfPath).toString('base64'),
      filename:    path.basename(pdfPath),
      type:        'application/pdf',
      disposition: 'attachment',
    },
  ];

  if (docxPath && fs.existsSync(docxPath)) {
    attachments.push({
      content:     fs.readFileSync(docxPath).toString('base64'),
      filename:    path.basename(docxPath),
      type:        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      disposition: 'attachment',
    });
  }

  const msg = {
    from:        config.from,
    to:          config.to,
    subject,
    text:        `안녕하세요.\n\n${dateLabel} 증시 조사 보고서를 첨부합니다.\n\nClaude 자동 발송`,
    attachments,
  };

  await sgMail.send(msg);

  return {
    to:      config.to,
    subject,
    pdfSize: (fs.statSync(pdfPath).size / 1024).toFixed(1) + ' KB',
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
      console.log('✅ 이메일 발송 완료 (SendGrid)');
      console.log(`   받는 사람: ${result.to}`);
      console.log(`   제목:      ${result.subject}`);
      console.log(`   PDF 크기:  ${result.pdfSize}`);
    })
    .catch(err => {
      console.error('❌ 이메일 발송 실패:', err.message);
      if (err.response) {
        console.error('   SendGrid 오류:', JSON.stringify(err.response.body, null, 2));
      }
      process.exit(1);
    });
}

module.exports = { sendReport };
