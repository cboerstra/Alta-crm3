/**
 * Gmail SMTP email helper using nodemailer.
 * Credentials are stored in the integrations table (provider = "gmail").
 * - accountEmail  → Gmail address (e.g. team@altamortgagegroup.com)
 * - accessToken   → Gmail App Password (16-char, no spaces)
 */
import nodemailer from "nodemailer";
import type { Transporter } from "nodemailer";
import fs from "fs";
import path from "path";

export interface SendEmailOptions {
  from: string;       // "Name <email@gmail.com>"
  to: string;
  subject: string;
  html: string;
  text?: string;
  attachmentUrl?: string; // public URL or /uploads/... path to attach as PDF
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
 * Resolve a PDF attachment URL to a Buffer.
 * - If the URL is a relative /uploads/... path, read directly from disk.
 * - Otherwise, fetch over HTTP.
 */
async function resolvePdfBuffer(attachmentUrl: string): Promise<{ buffer: Buffer; filename: string } | null> {
  try {
    // Local /uploads/... path — read from disk (avoids HTTP round-trip on Hostinger)
    if (attachmentUrl.startsWith("/uploads/")) {
      const uploadsDir = process.env.UPLOADS_DIR
        ? path.resolve(process.env.UPLOADS_DIR)
        : path.resolve(process.cwd(), "uploads");
      const filename = path.basename(attachmentUrl);
      const filePath = path.join(uploadsDir, filename);
      console.log(`[Email] Reading PDF from disk: ${filePath}`);
      if (!fs.existsSync(filePath)) {
        console.error(`[Email] PDF file not found on disk: ${filePath}`);
        return null;
      }
      const buffer = fs.readFileSync(filePath);
      console.log(`[Email] PDF read from disk: ${filename} (${buffer.length} bytes)`);
      return { buffer, filename };
    }

    // Remote URL — fetch over HTTP
    console.log(`[Email] Fetching PDF from remote URL: ${attachmentUrl}`);
    const response = await fetch(attachmentUrl);
    if (!response.ok) {
      console.error(`[Email] Failed to fetch PDF attachment (HTTP ${response.status}): ${attachmentUrl}`);
      return null;
    }
    const arrayBuffer = await response.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    const urlPath = new URL(attachmentUrl).pathname;
    const filename = urlPath.split("/").pop() || "attachment.pdf";
    console.log(`[Email] PDF fetched from remote: ${filename} (${buffer.length} bytes)`);
    return { buffer, filename };
  } catch (err) {
    console.error("[Email] Error resolving PDF attachment:", err);
    return null;
  }
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

  // Attach PDF
  if (opts.attachmentUrl) {
    const result = await resolvePdfBuffer(opts.attachmentUrl);
    if (result) {
      mailOptions.attachments = [
        {
          filename: result.filename,
          content: result.buffer,
          contentType: "application/pdf",
        },
      ];
    }
  }

  await transporter.sendMail(mailOptions);
}
