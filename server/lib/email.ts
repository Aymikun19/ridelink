import { Resend } from "resend";
import { env } from "./env.js";
import { HttpError } from "./errors.js";

let client: Resend | null = null;
function resend() {
  if (!client) client = new Resend(env.resendApiKey);
  return client;
}

function escape(s: string) {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
}

function layout(title: string, inner: string) {
  return `<!doctype html><html><body style="margin:0;background:#0b0b0b;font-family:Inter,Segoe UI,Arial,sans-serif;color:#f5f5f5">
  <table width="100%" cellpadding="0" cellspacing="0" style="padding:32px 16px"><tr><td align="center">
    <table width="100%" cellpadding="0" cellspacing="0" style="max-width:480px;background:#141414;border:1px solid #262626;border-radius:20px;padding:32px">
      <tr><td style="font-size:14px;letter-spacing:.12em;text-transform:uppercase;color:#c9a84c;font-weight:700">${env.appName}</td></tr>
      <tr><td style="padding-top:20px;font-size:22px;font-weight:700;color:#ffffff">${escape(title)}</td></tr>
      <tr><td style="padding-top:12px;font-size:15px;line-height:1.6;color:#bdbdbd">${inner}</td></tr>
      <tr><td style="padding-top:28px;font-size:12px;color:#737373">You received this email because of activity on your ${env.appName} account.</td></tr>
    </table>
  </td></tr></table></body></html>`;
}

async function send(to: string, subject: string, html: string, text: string) {
  const { error } = await resend().emails.send({ from: env.resendFrom, to, subject, html, text });
  if (error) {
    console.error("[email] send failed", error);
    throw new HttpError(502, "We could not send the email. Please try again shortly.", "email_failed");
  }
}

export type CodePurpose = "login" | "signup" | "reset";

const codeCopy: Record<CodePurpose, { title: string; intro: string; subject: (c: string) => string }> = {
  login: { title: "Your sign-in code", intro: "Use this code to sign in.", subject: (c) => `${c} is your ${env.appName} sign-in code` },
  signup: { title: "Confirm your email", intro: "Welcome to RideLink. Use this code to confirm your email and finish creating your account.", subject: (c) => `${c} is your ${env.appName} verification code` },
  reset: { title: "Reset your password", intro: "Use this code to set a new password.", subject: (c) => `${c} is your ${env.appName} password reset code` },
};

export function sendCodeEmail(to: string, code: string, minutes: number, purpose: CodePurpose) {
  const copy = codeCopy[purpose];
  const html = layout(
    copy.title,
    `${copy.intro} It expires in ${minutes} minutes.
     <div style="margin:24px 0;font-size:34px;letter-spacing:10px;font-weight:700;color:#ffffff;background:#0b0b0b;border:1px solid #262626;border-radius:14px;padding:18px;text-align:center">${code}</div>
     If you did not request this, you can ignore this email${purpose === "reset" ? "; your password will not change" : ""}.`,
  );
  return send(to, copy.subject(code), html, `${copy.intro} Your code is ${code}. It expires in ${minutes} minutes.`);
}

export function sendRideUpdateEmail(to: string, opts: { title: string; message: string; rideId: string }) {
  const link = `${env.appUrl}/ride/${opts.rideId}`;
  const html = layout(
    opts.title,
    `${escape(opts.message)}
     <div style="margin-top:24px"><a href="${link}" style="display:inline-block;background:#ffffff;color:#0b0b0b;text-decoration:none;font-weight:600;padding:12px 22px;border-radius:999px">Open ride</a></div>`,
  );
  return send(to, opts.title, html, `${opts.message}\n\nOpen ride: ${link}`);
}
