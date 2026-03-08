import NextAuth, { type NextAuthOptions } from 'next-auth'
import { getServerSession } from 'next-auth'
import { redirect } from 'next/navigation'
import CredentialsProvider from 'next-auth/providers/credentials'
import { prisma } from '@/lib/db'
import { verifyPassword } from '@/lib/crypto'
import type { Role } from '@prisma/client'

// Extend the next-auth JWT type
declare module 'next-auth/jwt' {
  interface JWT {
    id: string;
    email?: string;
    roleId?: string;
    roleLevel?: number;
    teamId?: string;
  }
}

// Extend the next-auth Session type
declare module 'next-auth' {
  interface Session {
    user: {
      id: string;
      email?: string;
      name?: string | null;
      roleId?: string;
      roleLevel?: number;
      teamId?: string;
    };
  }
}

export const authOptions: NextAuthOptions = {
  session: {
    strategy: 'jwt',
  },
  pages: {
    signIn: '/login',
    error: '/login',
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
          return null
        }

        const user = await prisma.user.findUnique({
          where: { email: credentials.email as string, deletedAt: null },
          include: {
            teamMembers: {
              include: {
                team: true,
                role: true,
              },
              orderBy: {
                createdAt: "asc",
              },
              take: 1,
            },
          },
        });

        if (!user) {
          return null;
        }

        const isValid = await verifyPassword(
          credentials.password as string,
          user.passwordHash,
        );

        if (!isValid) {
          return null;
        }

        // Get the user's roleId and role level from first team membership
        const primaryTeamMember = user.teamMembers[0];
        const roleId = primaryTeamMember?.roleId;
        const roleLevel = primaryTeamMember?.role?.level ?? 1;
        const teamId = primaryTeamMember?.team.id

        return {
          id: user.id,
          email: user.email,
          name: user.name,
          roleId,
          roleLevel,
          teamId,
        };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user, trigger, session }) {
      if (user) {
        token.id = user.id
        token.email = user.email
        token.roleId = (user as any).roleId
        token.roleLevel = (user as any).roleLevel;
        token.teamId = (user as any).teamId
      }

      // Handle active session updates (e.g., from team switcher)
      if (trigger === 'update' && session) {
        if (session.teamId) token.teamId = session.teamId
        if (session.roleId) token.roleId = session.roleId
        if (session.roleLevel) token.roleLevel = session.roleLevel;
      }

      return token
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.id as string
        session.user.roleId = token.roleId as string
        session.user.roleLevel = token.roleLevel as number;
        session.user.teamId = token.teamId as string
      }
      return session
    },
  },
}

/**
 * Server component helper: require an authenticated user or redirect to login.
 */
export async function requireUser() {
  const session = await getServerSession(authOptions)
  if (!session?.user) {
    redirect('/login')
  }

  return session
}

export default NextAuth(authOptions)
