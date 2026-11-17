import { Resend } from 'resend';

// Server-only transactional email service using official Resend SDK

let resendClient: Resend | null = null;

function getResendClient(): Resend | null {
  const apiKey = process.env.RESEND_API_KEY?.trim();
  if (!apiKey || !apiKey.startsWith('re_')) {
    return null;
  }
  if (!resendClient) {
    resendClient = new Resend(apiKey);
  }
  return resendClient;
}

export function isEmailConfigured(): boolean {
  return Boolean(process.env.RESEND_API_KEY?.trim());
}

export interface SendEmailOptions {
  to: string | string[];
  subject: string;
  html: string;
  text?: string;
  from?: string;
}

export interface SendEmailResult {
  success: boolean;
  id?: string;
  error?: string;
}

export async function sendEmail(options: SendEmailOptions): Promise<SendEmailResult> {
  const apiKey = process.env.RESEND_API_KEY?.trim();
  const baseUrl = process.env.RESEND_BASE_URL?.trim();

  if (!apiKey) {
    return {
      success: false,
      error: 'Email provider API key is not configured. Set RESEND_API_KEY.'
    };
  }

  const fromAddress = options.from || process.env.EMAIL_FROM || 'Avartah Solutions <support@avartah.com>';
  const recipients = Array.isArray(options.to) ? options.to : [options.to];
  const textContent = options.text || options.html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();

  try {
    if (baseUrl) {
      // FreeResend / Custom Resend-compatible API endpoint support
      const res = await fetch(`${baseUrl.replace(/\/+$/, '')}/emails`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          from: fromAddress,
          to: recipients,
          subject: options.subject,
          html: options.html,
          text: textContent
        })
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok || data.error) {
        return {
          success: false,
          error: data.error?.message || data.error || 'FreeResend / custom email relay rejected delivery'
        };
      }

      return {
        success: true,
        id: data.id || 'free-resend-ok'
      };
    }

    // Official Resend SDK client
    const client = getResendClient();
    if (!client) {
      return {
        success: false,
        error: 'Resend email provider is not configured.'
      };
    }

    const { data, error } = await client.emails.send({
      from: fromAddress,
      to: recipients,
      subject: options.subject,
      html: options.html,
      text: textContent
    });

    if (error) {
      return {
        success: false,
        error: error.message || 'Resend provider rejected delivery'
      };
    }

    return {
      success: true,
      id: data?.id || 'resend-ok'
    };
  } catch (err: any) {
    return {
      success: false,
      error: err.message || 'Unexpected failure while sending email'
    };
  }
}

/**
 * Send password reset email with secure URL containing raw token
 */
export async function sendPasswordResetEmail(
  recipientEmail: string,
  rawToken: string,
  customBaseUrl?: string
): Promise<SendEmailResult> {
  const appBaseUrl = (customBaseUrl || process.env.APP_BASE_URL || 'https://avartah.com').replace(/\/+$/, '');
  const resetUrl = `${appBaseUrl}/reset-password?token=${encodeURIComponent(rawToken)}`;

  const html = `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8">
        <title>Reset Your Avartah Solutions Password</title>
      </head>
      <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #0b0f19; color: #f8fafc; padding: 40px 20px; margin: 0;">
        <table align="center" border="0" cellpadding="0" cellspacing="0" width="100%" style="max-width: 600px; background-color: #111827; border-radius: 16px; border: 1px solid rgba(255, 255, 255, 0.1); overflow: hidden;">
          <tr>
            <td style="padding: 32px 32px 16px 32px;">
              <h1 style="color: #3b82f6; font-size: 20px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.1em; margin: 0 0 8px 0;">AVARTAH SOLUTIONS</h1>
              <h2 style="color: #ffffff; font-size: 24px; font-weight: 700; margin: 0 0 16px 0;">Password Reset Request</h2>
              <p style="color: #94a3b8; font-size: 15px; line-height: 1.6; margin: 0 0 24px 0;">
                We received a request to reset the password for your account. Click the button below to choose a new password. This link is valid for <strong>1 hour</strong> and can only be used once.
              </p>
              <div style="margin: 28px 0;">
                <a href="${resetUrl}" style="background-color: #2563eb; color: #ffffff; padding: 14px 28px; text-decoration: none; border-radius: 10px; font-weight: 700; font-size: 14px; text-transform: uppercase; letter-spacing: 0.05em; display: inline-block;">Reset Password</a>
              </div>
              <p style="color: #64748b; font-size: 13px; line-height: 1.5; margin: 24px 0 0 0;">
                If you did not request a password reset, you can safely ignore this email. Your current password will remain active.
              </p>
              <p style="color: #475569; font-size: 12px; margin: 16px 0 0 0; word-break: break-all;">
                Or copy this URL into your browser: <a href="${resetUrl}" style="color: #3b82f6;">${resetUrl}</a>
              </p>
            </td>
          </tr>
          <tr>
            <td style="padding: 20px 32px; background-color: #0f172a; border-top: 1px solid rgba(255, 255, 255, 0.05); text-align: center;">
              <p style="color: #64748b; font-size: 12px; margin: 0;">&copy; ${new Date().getFullYear()} Avartah Solutions. All rights reserved.</p>
            </td>
          </tr>
        </table>
      </body>
    </html>
  `;

  return sendEmail({
    to: recipientEmail,
    subject: 'Reset Your Password — Avartah Solutions',
    html
  });
}

/**
 * Send workspace invitation email with secure token link
 */
export async function sendWorkspaceInvitationEmail(
  recipientEmail: string,
  inviterEmail: string,
  workspaceName: string,
  role: string,
  rawToken: string,
  customBaseUrl?: string
): Promise<SendEmailResult> {
  const appBaseUrl = (customBaseUrl || process.env.APP_BASE_URL || 'https://avartah.com').replace(/\/+$/, '');
  const inviteUrl = `${appBaseUrl}/workspaces/accept-invitation?token=${encodeURIComponent(rawToken)}`;

  const html = `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8">
        <title>Workspace Invitation - Avartah Solutions</title>
      </head>
      <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #0b0f19; color: #f8fafc; padding: 40px 20px; margin: 0;">
        <table align="center" border="0" cellpadding="0" cellspacing="0" width="100%" style="max-width: 600px; background-color: #111827; border-radius: 16px; border: 1px solid rgba(255, 255, 255, 0.1); overflow: hidden;">
          <tr>
            <td style="padding: 32px 32px 16px 32px;">
              <h1 style="color: #3b82f6; font-size: 20px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.1em; margin: 0 0 8px 0;">AVARTAH SOLUTIONS</h1>
              <h2 style="color: #ffffff; font-size: 24px; font-weight: 700; margin: 0 0 16px 0;">Workspace Invitation</h2>
              <p style="color: #94a3b8; font-size: 15px; line-height: 1.6; margin: 0 0 24px 0;">
                <strong>${inviterEmail}</strong> has invited you to join the workspace <strong>"${workspaceName}"</strong> as a <strong>${role}</strong>.
              </p>
              <div style="margin: 28px 0;">
                <a href="${inviteUrl}" style="background-color: #2563eb; color: #ffffff; padding: 14px 28px; text-decoration: none; border-radius: 10px; font-weight: 700; font-size: 14px; text-transform: uppercase; letter-spacing: 0.05em; display: inline-block;">Accept Invitation</a>
              </div>
              <p style="color: #64748b; font-size: 13px; line-height: 1.5; margin: 24px 0 0 0;">
                This invitation is valid for 7 days. If you did not expect this invitation, you can safely ignore this email.
              </p>
              <p style="color: #475569; font-size: 12px; margin: 16px 0 0 0; word-break: break-all;">
                Or copy this link: <a href="${inviteUrl}" style="color: #3b82f6;">${inviteUrl}</a>
              </p>
            </td>
          </tr>
          <tr>
            <td style="padding: 20px 32px; background-color: #0f172a; border-top: 1px solid rgba(255, 255, 255, 0.05); text-align: center;">
              <p style="color: #64748b; font-size: 12px; margin: 0;">&copy; ${new Date().getFullYear()} Avartah Solutions. All rights reserved.</p>
            </td>
          </tr>
        </table>
      </body>
    </html>
  `;

  return sendEmail({
    to: recipientEmail,
    subject: `You've been invited to join ${workspaceName} on Avartah Solutions`,
    html
  });
}
