import { Resend } from 'resend';
import { render } from '@react-email/components';
import { VerificationEmail } from './templates/verification-email';
import { PasswordResetEmail } from './templates/password-reset';
import { WelcomeEmail } from './templates/welcome-email';

const resend = new Resend(process.env.RESEND_API_KEY);

const FROM_EMAIL = process.env.EMAIL_FROM || 'onboarding@resend.dev';
const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';

export interface SendVerificationEmailParams {
  email: string;
  name: string;
  token: string;
}

export interface SendPasswordResetEmailParams {
  email: string;
  name: string;
  token: string;
}

export interface SendWelcomeEmailParams {
  email: string;
  name: string;
}

export async function sendVerificationEmail({
  email,
  name,
  token,
}: SendVerificationEmailParams) {
  const verificationUrl = `${APP_URL}/verify-email?token=${token}`;

  const html = await render(
    VerificationEmail({ name, verificationUrl })
  );

  try {
    const data = await resend.emails.send({
      from: FROM_EMAIL,
      to: email,
      subject: 'Verify your email address',
      html,
    });

    return { success: true, data };
  } catch (error) {
    console.error('Failed to send verification email:', error);
    return { success: false, error };
  }
}

export async function sendPasswordResetEmail({
  email,
  name,
  token,
}: SendPasswordResetEmailParams) {
  const resetUrl = `${APP_URL}/reset-password?token=${token}`;

  const html = await render(
    PasswordResetEmail({ name, resetUrl })
  );

  try {
    const data = await resend.emails.send({
      from: FROM_EMAIL,
      to: email,
      subject: 'Reset your password',
      html,
    });

    return { success: true, data };
  } catch (error) {
    console.error('Failed to send password reset email:', error);
    return { success: false, error };
  }
}

export async function sendWelcomeEmail({
  email,
  name,
}: SendWelcomeEmailParams) {
  const dashboardUrl = `${APP_URL}/dashboard`;

  const html = await render(
    WelcomeEmail({ name, dashboardUrl })
  );

  try {
    const data = await resend.emails.send({
      from: FROM_EMAIL,
      to: email,
      subject: 'Welcome to Business Automation System',
      html,
    });

    return { success: true, data };
  } catch (error) {
    console.error('Failed to send welcome email:', error);
    return { success: false, error };
  }
}
