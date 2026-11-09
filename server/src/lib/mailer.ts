import nodemailer from "nodemailer";
import { config } from "../config.js";

const transport = config.SMTP_HOST
  ? nodemailer.createTransport({
      host: config.SMTP_HOST,
      port: config.SMTP_PORT,
      secure: config.SMTP_SECURE,
      auth: config.SMTP_USER ? { user: config.SMTP_USER, pass: config.SMTP_PASS } : undefined,
    })
  : null;

export async function sendMail(options: {
  to: string;
  subject: string;
  text: string;
  html?: string;
}) {
  if (!transport) {
    console.log(
      `[mail] SMTP not configured; would send to ${options.to}\n  Subject: ${options.subject}\n  ${options.text.replaceAll("\n", "\n  ")}`,
    );
    return;
  }
  await transport.sendMail({ from: config.MAIL_FROM, ...options });
}
