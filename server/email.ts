/**
 * Gmail SMTP email helper using nodemailer.
 * Credentials are stored in the integrations table (provider = "gmail").
 * - accountEmail  → Gmail address (e.g. team@altamortgagegroup.com)
 * - accessToken   → Gmail App Password (16-char, no spaces)
 */
import nodemailer from "nodemailer";
import type { Transporter } from "nodemailer";

export interface SendEmailOptions {
  from: string;       // "Name <email@gmail.com>"
  to: string;
  subject: string;
  html: string;
  text?: string;
  attachmentUrl?: string; // public URL to attach as PDF
}

/** Build a transporter for the given Gmail credentials. */
export function createGmailTransporter(gmailAddress: string, appPassword: string): Transporter {
  return nodemailer.createTransport({
    host: "smtp.gmail.com",
    port: 465,
    secure: true,
    auth: {
      user: gmailAddress,
      pass: appPassword,
    },
  });
}

/**
 * Validate Gmail credentials by calling transporter.verify().
 * Throws if credentials are invalid.
 */
export async function verifyGmailCredentials(gmailAddress: string, appPassword: string): Promise<void> {
  const transporter = createGmailTransporter(gmailAddress, appPassword);
  await transporter.verify();
}

/**
 * Send an email via Gmail SMTP.
 * Returns true on success, throws on failure.
 */
export async function sendEmail(
  gmailAddress: string,
  appPassword: string,
  opts: SendEmailOptions
): Promise<void> {
  const transporter = createGmailTransporter(gmailAddress, appPassword);

  const mailOptions: Parameters<typeof transporter.sendMail>[0] = {
    from: opts.from,
    to: opts.to,
    subject: opts.subject,
    html: opts.html,
    text: opts.text ?? opts.html.replace(/<[^>]+>/g, ""),
  };

  // Attach PDF if a URL is provided
  if (opts.attachmentUrl) {
    mailOptions.attachments = [
      {
        filename: "attachment.pdf",
        path: opts.attachmentUrl,
      },
    ];
  }

  await transporter.sendMail(mailOptions);
}
