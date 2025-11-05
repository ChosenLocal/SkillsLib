/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/ban-ts-comment */
import { compare } from 'bcryptjs';
import NextAuth, { type DefaultSession } from 'next-auth';
import { PrismaAdapter } from '@auth/prisma-adapter';
import CredentialsProvider from 'next-auth/providers/credentials';
import GoogleProvider from 'next-auth/providers/google';
import GitHubProvider from 'next-auth/providers/github';
import { prisma } from '@business-automation/database';

declare module 'next-auth' {
  interface Session {
    user: {
      id: string;
      tenantId: string;
      role: string;
    } & DefaultSession['user'];
    accessToken?: string; // JWT token for API authentication
  }

  interface User {
    id: string;
    tenantId: string;
    role: string;
  }
}

declare module 'next-auth/jwt' {
  interface JWT {
    userId?: string;
    tenantId?: string;
    role?: string;
    accessToken?: string;
  }
}

// Custom Prisma Adapter to handle tenant context
const customPrismaAdapter = {
  ...PrismaAdapter(prisma),
  createSession: async ({ sessionToken, userId, expires }: any) => {
    // Get user's tenantId
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { tenantId: true },
    });

    return prisma.session.create({
      data: {
        sessionToken,
        userId,
        tenantId: user?.tenantId || '',
        expires,
      },
    });
  },
  linkAccount: async (account: any) => {
    // Get user's tenantId
    const user = await prisma.user.findUnique({
      where: { id: account.userId },
      select: { tenantId: true },
    });

    return prisma.account.create({
      data: {
        ...account,
        tenantId: user?.tenantId || '',
      },
    });
  },
};

const authConfig = {
  // @ts-ignore
  adapter: customPrismaAdapter,
  session: {
    strategy: 'jwt' as const, // Changed from 'database' to 'jwt' for API architecture
    maxAge: 30 * 24 * 60 * 60, // 30 days
  },
  pages: {
    signIn: '/',
    error: '/',
  },
  providers: [
    CredentialsProvider({
      name: 'credentials',
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Password', type: 'password' },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) {
          return null;
        }

        const user = await prisma.user.findFirst({
          where: {
            email: credentials.email as string,
          },
          include: {
            tenant: true,
          },
        });

        if (!user || !user.passwordHash) {
          return null;
        }

        const isPasswordValid = await compare(
          credentials.password as string,
          user.passwordHash
        );

        if (!isPasswordValid) {
          return null;
        }

        // Update last login time
        await prisma.user.update({
          where: { id: user.id },
          data: { lastLoginAt: new Date() },
        });

        return {
          id: user.id,
          email: user.email,
          name: user.name,
          image: user.avatarUrl,
          tenantId: user.tenantId,
          role: user.role,
        };
      },
    }),
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID || '',
      clientSecret: process.env.GOOGLE_CLIENT_SECRET || '',
      allowDangerousEmailAccountLinking: true, // Allow linking if email matches
    }),
    GitHubProvider({
      clientId: process.env.GITHUB_CLIENT_ID || '',
      clientSecret: process.env.GITHUB_CLIENT_SECRET || '',
      allowDangerousEmailAccountLinking: true, // Allow linking if email matches
    }),
  ],
  callbacks: {
    /**
     * JWT callback - signs JWT tokens with user data
     * This token is sent to the API server for authentication
     */
    async jwt({ token, user, account }: { token: any; user: any; account: any }) {
      // Initial sign in - add user data to token
      if (user) {
        // Fetch full user data including tenantId and role
        const dbUser = await prisma.user.findUnique({
          where: { id: user.id },
          select: {
            id: true,
            email: true,
            tenantId: true,
            role: true,
            name: true,
          },
        });

        if (dbUser) {
          token.userId = dbUser.id;
          token.tenantId = dbUser.tenantId;
          token.role = dbUser.role;
          token.email = dbUser.email;
        }
      }

      return token;
    },
    /**
     * Session callback - populates session from JWT token
     * This session is available on the client side
     */
    async session({ session, token }: { session: any; token: any }) {
      // When auth is disabled, provide a mock session
      if (process.env.DISABLE_AUTH === 'true') {
        return {
          user: {
            id: 'test-user-id',
            email: 'test@example.com',
            name: 'Test User',
            tenantId: 'test-tenant-id',
            role: 'OWNER',
          },
          expires: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
        };
      }

      if (session.user && token) {
        session.user.id = token.userId as string;
        session.user.tenantId = token.tenantId as string;
        session.user.role = token.role as string;
        session.user.email = token.email as string;

        // Create JWT token for API authentication
        // This is a signed JWT that the API server can verify
        if (token.userId && token.tenantId && token.role) {
          const jwt = require('jsonwebtoken');
          const secret = process.env.NEXTAUTH_SECRET;

          if (secret) {
            session.accessToken = jwt.sign(
              {
                userId: token.userId,
                tenantId: token.tenantId,
                role: token.role,
                email: token.email,
              },
              secret,
              { expiresIn: '30d' }
            );
          }
        }
      }
      return session;
    },
    async signIn({ user, account }: { user: any; account: any }) {
      // For OAuth providers, check if user has a tenant
      if (account?.provider !== 'credentials') {
        const existingUser = await prisma.user.findUnique({
          where: { id: user.id },
        });

        // If OAuth user doesn't have a tenant, we need to create one or handle this
        // For now, we'll reject OAuth sign-ins without existing accounts
        if (!existingUser?.tenantId) {
          return false; // Will show error page
        }
      }
      return true;
    },
  },
  events: {
    async signIn({ user }: { user: any }) {
      // Update last login time
      if (user.id) {
        await prisma.user.update({
          where: { id: user.id },
          data: { lastLoginAt: new Date() },
        });
      }
    },
  },
};

const nextAuthResult = NextAuth(authConfig);

export const handlers: any = nextAuthResult.handlers;
export const auth: any = nextAuthResult.auth;
export const signIn: any = nextAuthResult.signIn;
export const signOut: any = nextAuthResult.signOut;
export const { GET, POST } = handlers;
