import nodemailer, { Transporter } from 'nodemailer';
import { config } from '../config/env';

let transporterPromise: Promise<Transporter> | null = null;

async function getTransporter(): Promise<Transporter> {
  if (transporterPromise) {
    return transporterPromise;
  }

  transporterPromise = (async () => {
    if (config.ETHEREAL_USER && config.ETHEREAL_PASS) {
      console.log('[MailService] Using configured Ethereal SMTP credentials');
      return nodemailer.createTransport({
        host: 'smtp.ethereal.email',
        port: 587,
        secure: false,
        auth: {
          user: config.ETHEREAL_USER,
          pass: config.ETHEREAL_PASS,
        },
      });
    }

    console.log('[MailService] No Ethereal credentials supplied. Creating dynamic test account...');
    const testAccount = await nodemailer.createTestAccount();
    console.log(`[MailService] Ethereal test account created: User=${testAccount.user}`);
    
    return nodemailer.createTransport({
      host: 'smtp.ethereal.email',
      port: 587,
      secure: false,
      auth: {
        user: testAccount.user,
        pass: testAccount.pass,
      },
    });
  })();

  return transporterPromise;
}

export interface SendEmailResult {
  messageId: string;
  previewUrl: string | false;
}

export async function sendEmail(
  to: string,
  subject: string,
  body: string
): Promise<SendEmailResult> {
  const transporter = await getTransporter();

  const info = await transporter.sendMail({
    from: '"ReachInbox Scheduler" <noreply@reachinbox.ai>',
    to,
    subject,
    text: body,
    html: `<div style="font-family: Arial, sans-serif; padding: 20px; background: #0B0A12; color: #F3F4F6; border-radius: 8px;">
      <h2 style="color: #10B981; border-bottom: 1px solid #1C1929; padding-bottom: 10px;">${subject}</h2>
      <div style="white-space: pre-wrap; margin-top: 15px; color: #D1D5DB; line-height: 1.6;">${body}</div>
      <footer style="margin-top: 30px; font-size: 12px; color: #6B7280; border-top: 1px solid #1C1929; padding-top: 10px;">
        Sent via ReachInbox Production Email Scheduler • Ethereal Sandbox
      </footer>
    </div>`,
  });

  const previewUrl = nodemailer.getTestMessageUrl(info);
  console.log(`[MailService] Sent email to ${to}. Preview: ${previewUrl}`);

  return {
    messageId: info.messageId,
    previewUrl,
  };
}
