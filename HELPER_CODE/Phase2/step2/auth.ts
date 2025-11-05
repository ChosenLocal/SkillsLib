import NextAuth, { NextAuthOptions } from 'next-auth';
import GoogleProvider from 'next-auth/providers/google';
import { env } from '@business-automation/config';
import { prisma } from '@business-automation/database';

/**
 * NextAuth configuration
 * 
 * Google OAuth with domain restriction to @chosen-local.com
 * Creates JWT token for API authentication
 */
export const authOptions: NextAuthOptions = {
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID || '',
      clientSecret: process.env.GOOGLE_CLIENT_SECRET || '',
      authorization: {
        params: {
          prompt: 'consent',
          access_type: 'offline',
          response_type: 'code',
          // Restrict to chosen-local.com domain
          hd: 'chosen-local.com',
        },
      },
    }),
  ],

  callbacks: {
    /**
     * Sign in callback
     * Restrict sign-in to @chosen-local.com domain only
     */
    async signIn({ user, account, profile }) {
      // Check if email ends with @chosen-local.com
      if (user.email && !user.email.endsWith('@chosen-local.com')) {
        console.warn(`Sign-in rejected for ${user.email}: not in allowed domain`);
        return false;
      }

      // Find or create user in database
      try {
        // Find tenant (in production, this would be based on domain/subdomain)
        // For now, use default tenant
        const tenant = await prisma.tenant.findFirst({
          where: { slug: 'demo-contractor' },
        });

        if (!tenant) {
          console.error('No tenant found');
          return false;
        }

        // Upsert user
        await prisma.user.upsert({
          where: {
            email_tenantId: {
              email: user.email!,
              tenantId: tenant.id,
            },
          },
          create: {
            email: user.email!,
            name: user.name || '',
            tenantId: tenant.id,
            role: 'MEMBER',
            emailVerified: new Date(),
          },
          update: {
            name: user.name || '',
            lastLoginAt: new Date(),
          },
        });

        return true;
      } catch (error) {
        console.error('Error in signIn callback:', error);
        return false;
      }
    },

    /**
     * JWT callback
     * Add user ID, tenant ID, and role to JWT token
     */
    async jwt({ token, user, account }) {
      if (user && user.email) {
        // Fetch user from database
        const dbUser = await prisma.user.findFirst({
          where: { email: user.email },
          include: { tenant: true },
        });

        if (dbUser) {
          token.userId = dbUser.id;
          token.tenantId = dbUser.tenantId;
          token.role = dbUser.role;
        }
      }

      return token;
    },

    /**
     * Session callback
     * Add user data to session object
     */
    async session({ session, token }) {
      if (token) {
        session.user.id = token.userId as string;
        session.user.tenantId = token.tenantId as string;
        session.user.role = token.role as string;
      }

      return session;
    },
  },

  pages: {
    signIn: '/login',
    error: '/login',
  },

  session: {
    strategy: 'jwt',
    maxAge: 30 * 24 * 60 * 60, // 30 days
  },

  secret: env.NEXTAUTH_SECRET,
};

export default NextAuth(authOptions);
