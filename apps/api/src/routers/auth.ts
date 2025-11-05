import { z } from 'zod';
import bcryptjs from 'bcryptjs';
const { hash } = bcryptjs;
import { randomBytes, createHash } from 'crypto';
import { publicProcedure, router } from '../trpc.js';
import { prisma } from '@business-automation/database';
// TODO: Setup email client in API service
// import { sendVerificationEmail, sendPasswordResetEmail, sendWelcomeEmail } from '@/lib/email/client';
import { TRPCError } from '@trpc/server';

// Helper function to generate secure tokens
function generateToken(): string {
  return randomBytes(32).toString('hex');
}

// Helper function to hash token for database storage
function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

export const authRouter = router({
  // Register new user
  register: publicProcedure
    .input(
      z.object({
        email: z.string().email(),
        password: z.string().min(8),
        name: z.string().min(1),
        tenantName: z.string().min(1),
      })
    )
    .mutation(async ({ input }) => {
      const { email, password, name, tenantName } = input;

      // Check if user already exists
      const existingUser = await prisma.user.findFirst({
        where: { email },
      });

      if (existingUser) {
        throw new TRPCError({
          code: 'CONFLICT',
          message: 'User with this email already exists',
        });
      }

      // Create tenant and user in transaction
      const result = await prisma.$transaction(async (tx) => {
        // Create tenant
        const tenant = await tx.tenant.create({
          data: {
            name: tenantName,
            slug: tenantName.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
            subscriptionTier: 'FREE',
          },
        });

        // Hash password
        const passwordHash = await hash(password, 12);

        // Create user
        const user = await tx.user.create({
          data: {
            email,
            name,
            passwordHash,
            tenantId: tenant.id,
            role: 'OWNER', // First user is owner
          },
        });

        // Generate verification token
        const token = generateToken();
        const hashedToken = hashToken(token);

        await tx.verificationToken.create({
          data: {
            identifier: email,
            token: hashedToken,
            type: 'EMAIL_VERIFICATION',
            expires: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24 hours
          },
        });

        return { user, token };
      });

      // TODO: Send verification email (requires email service)
      // sendVerificationEmail({ email, name, token: result.token })
      //   .catch((error) => console.error('Failed to send verification email:', error));

      return {
        success: true,
        message: 'Registration successful! Please check your email to verify your account.',
      };
    }),

  // Verify email
  verifyEmail: publicProcedure
    .input(z.object({ token: z.string() }))
    .mutation(async ({ input }) => {
      const { token } = input;
      const hashedToken = hashToken(token);

      const verificationToken = await prisma.verificationToken.findFirst({
        where: {
          token: hashedToken,
          type: 'EMAIL_VERIFICATION',
          expires: { gt: new Date() },
        },
      });

      if (!verificationToken) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'Invalid or expired verification token',
        });
      }

      // Update user email verified status
      await prisma.$transaction(async (tx) => {
        await tx.user.updateMany({
          where: { email: verificationToken.identifier },
          data: { emailVerified: new Date() },
        });

        // Delete the used token
        await tx.verificationToken.delete({
          where: { id: verificationToken.id },
        });
      });

      // Get user details for welcome email
      const user = await prisma.user.findFirst({
        where: { email: verificationToken.identifier },
      });

      if (user) {
        // TODO: Send welcome email
        // sendWelcomeEmail({ email: user.email, name: user.name })
        //   .catch((error) => console.error('Failed to send welcome email:', error));
      }

      return {
        success: true,
        message: 'Email verified successfully! You can now sign in.',
      };
    }),

  // Request password reset
  forgotPassword: publicProcedure
    .input(z.object({ email: z.string().email() }))
    .mutation(async ({ input }) => {
      const { email } = input;

      const user = await prisma.user.findFirst({
        where: { email },
      });

      // Don't reveal if user exists or not for security
      if (!user) {
        return {
          success: true,
          message: 'If an account exists with that email, a password reset link will be sent.',
        };
      }

      // Generate reset token
      const token = generateToken();
      const hashedToken = hashToken(token);

      await prisma.verificationToken.create({
        data: {
          identifier: email,
          token: hashedToken,
          type: 'PASSWORD_RESET',
          expires: new Date(Date.now() + 60 * 60 * 1000), // 1 hour
        },
      });

      // TODO: Send password reset email
      // sendPasswordResetEmail({ email, name: user.name, token })
      //   .catch((error) => console.error('Failed to send password reset email:', error));

      return {
        success: true,
        message: 'If an account exists with that email, a password reset link will be sent.',
      };
    }),

  // Reset password
  resetPassword: publicProcedure
    .input(
      z.object({
        token: z.string(),
        password: z.string().min(8),
      })
    )
    .mutation(async ({ input }) => {
      const { token, password } = input;
      const hashedToken = hashToken(token);

      const resetToken = await prisma.verificationToken.findFirst({
        where: {
          token: hashedToken,
          type: 'PASSWORD_RESET',
          expires: { gt: new Date() },
        },
      });

      if (!resetToken) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'Invalid or expired reset token',
        });
      }

      // Hash new password
      const passwordHash = await hash(password, 12);

      // Update password and delete token
      await prisma.$transaction(async (tx) => {
        await tx.user.updateMany({
          where: { email: resetToken.identifier },
          data: { passwordHash },
        });

        await tx.verificationToken.delete({
          where: { id: resetToken.id },
        });
      });

      return {
        success: true,
        message: 'Password reset successfully! You can now sign in with your new password.',
      };
    }),

  // Resend verification email
  resendVerification: publicProcedure
    .input(z.object({ email: z.string().email() }))
    .mutation(async ({ input }) => {
      const { email } = input;

      const user = await prisma.user.findFirst({
        where: { email },
      });

      if (!user) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'User not found',
        });
      }

      if (user.emailVerified) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'Email already verified',
        });
      }

      // Delete any existing verification tokens
      await prisma.verificationToken.deleteMany({
        where: {
          identifier: email,
          type: 'EMAIL_VERIFICATION',
        },
      });

      // Generate new token
      const token = generateToken();
      const hashedToken = hashToken(token);

      await prisma.verificationToken.create({
        data: {
          identifier: email,
          token: hashedToken,
          type: 'EMAIL_VERIFICATION',
          expires: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24 hours
        },
      });

      // TODO: Send verification email
      // sendVerificationEmail({ email, name: user.name, token })
      //   .catch((error) => console.error('Failed to send verification email:', error));

      return {
        success: true,
        message: 'Verification email sent! Please check your inbox.',
      };
    }),
});
