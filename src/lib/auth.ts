import { NextAuthOptions, getServerSession } from 'next-auth';
import GoogleProvider from 'next-auth/providers/google';
import GitHubProvider from 'next-auth/providers/github';
import { PrismaAdapter } from '@next-auth/prisma-adapter';
import prisma from './prisma';

declare module 'next-auth' {
  interface Session {
    user: {
      id: string;
      email: string;
      name?: string | null;
      image?: string | null;
    };
  }
}

declare module 'next-auth/jwt' {
  interface JWT {
    id: string;
    email: string;
  }
}

export const authOptions: NextAuthOptions = {
  adapter: PrismaAdapter(prisma),
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
      allowDangerousEmailAccountLinking: true,
      authorization: {
        params: {
          access_type: 'offline',
          prompt: 'consent',
          scope: [
            'openid',
            'email',
            'profile',
            'https://www.googleapis.com/auth/calendar.events',
            'https://www.googleapis.com/auth/tasks',
            'https://www.googleapis.com/auth/drive.readonly',
            'https://www.googleapis.com/auth/spreadsheets',
          ].join(' '),
        },
      },
    }),
    GitHubProvider({
      clientId: process.env.GITHUB_CLIENT_ID!,
      clientSecret: process.env.GITHUB_CLIENT_SECRET!,
      allowDangerousEmailAccountLinking: true,
      authorization: { params: { scope: 'repo user:email' } },
    }),
  ],
  session: {
    strategy: 'jwt',
    maxAge: 30 * 24 * 60 * 60, // 30日
  },
  pages: {
    signIn: '/login',
    error: '/login',
  },
  events: {
    async createUser({ user }) {
      const slug = `ws-${user.id.slice(0, 8)}`;
      await prisma.workspace.create({
        data: {
          name: 'マイワークスペース',
          slug,
          members: {
            create: {
              userId: user.id,
              role: 'OWNER',
            },
          },
        },
      });
    },
  },
  callbacks: {
    async signIn({ user, account }) {
      if (!user.email) return false;
      // 再ログイン時にOAuthトークンを更新（スコープ変更対応）
      // 再ログイン/再連携時にOAuthトークンを更新
      if (account && user.id && (account.provider === 'google' || account.provider === 'github')) {
        const existing = await prisma.account.findFirst({
          where: { userId: user.id, provider: account.provider },
        });
        if (existing && account.access_token) {
          await prisma.account.update({
            where: { id: existing.id },
            data: {
              access_token: account.access_token,
              refresh_token: account.refresh_token ?? existing.refresh_token,
              expires_at: account.expires_at ?? existing.expires_at,
              scope: account.scope ?? existing.scope,
              id_token: account.id_token ?? existing.id_token,
            },
          });
        }
      }
      return true;
    },
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.email = user.email!;
      }
      return token;
    },
    async session({ session, token }) {
      session.user.id = token.id;
      session.user.email = token.email;
      return session;
    },
  },
  secret: process.env.NEXTAUTH_SECRET,
};

export async function getAuthSession() {
  return getServerSession(authOptions);
}

export async function requireAuthUser() {
  const session = await getAuthSession();
  if (!session?.user) {
    throw new Error('認証が必要です');
  }
  return session.user;
}
