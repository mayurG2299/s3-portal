import NextAuth, { type NextAuthOptions } from 'next-auth'
import { getServerSession } from 'next-auth'
import { redirect } from 'next/navigation'
import CredentialsProvider from 'next-auth/providers/credentials'
import { prisma } from '@/lib/db'
import { verifyPassword } from '@/lib/crypto'
import { logUserAction } from '@/lib/audit'
import type { Role } from '@prisma/client'

type AuthenticatedUser = {
  id: string
  email: string
  name?: string | null
  roleId?: string
  roleLevel?: number
  teamId?: string
}

export type CredentialValidationResult =
  | { status: 'user-not-found' }
  | { status: 'invalid-password' }
  | { status: 'success'; user: AuthenticatedUser }

export async function validateCredentials(
  email: string,
  password: string,
): Promise<CredentialValidationResult> {
  const user = await prisma.user.findUnique({
    where: { email, deletedAt: null },
    include: {
      teamMembers: {
        include: {
          team: true,
          role: true,
        },
        orderBy: {
          createdAt: 'asc',
        },
        take: 1,
      },
    },
  })

  if (!user) {
    return { status: 'user-not-found' }
  }

  const isValid = await verifyPassword(password, user.passwordHash)

  if (!isValid) {
    return { status: 'invalid-password' }
  }

  const primaryTeamMember = user.teamMembers[0]

  return {
    status: 'success',
    user: {
      id: user.id,
      email: user.email,
      name: user.name,
      roleId: primaryTeamMember?.roleId,
      roleLevel: primaryTeamMember?.role?.level ?? 1,
      teamId: primaryTeamMember?.team.id,
    },
  }
}

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

        const result = await validateCredentials(
          credentials.email as string,
          credentials.password as string,
        )

        if (result.status !== 'success') {
          return null
        }

        return result.user
      },
    }),
  ],
  events: {
    async signIn({ user }) {
      await logUserAction({
        action: 'USER_LOGIN',
        success: true,
        userId: user.id,
        metadata: { email: user.email },
      })
    },
    async signOut({ token }) {
      if (token?.id) {
        await logUserAction({
          action: 'USER_LOGOUT',
          success: true,
          userId: token.id as string,
        })
      }
    },
  },
  callbacks: {
    async jwt({ token, user, trigger, session }) {
      if (user) {
        token.id = user.id
        token.email = user.email
        token.roleId = (user as any).roleId
        token.roleLevel = (user as any).roleLevel;
        token.teamId = (user as any).teamId
      }

      // Re-hydrate stale tokens missing roleLevel or teamId.
      // This runs on every request where these fields are absent,
      // healing old JWTs transparently without requiring re-login.
      if (!token.roleLevel || !token.teamId) {
        try {
          const teamMember = await prisma.teamMember.findFirst({
            where: { userId: token.id as string },
            include: { role: true, team: true },
            orderBy: { createdAt: 'asc' },
          })
          if (teamMember) {
            token.roleId = teamMember.roleId
            token.roleLevel = teamMember.role?.level ?? 1
            token.teamId = teamMember.teamId
          }
        } catch (e) {
          // If DB is unavailable, keep token as-is — middleware will pass it through
          console.error('[jwt] Failed to re-hydrate token:', e)
        }
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
 * The optional `page` argument is accepted for call-site documentation purposes.
 */
export async function requireUser(_page?: string) {
  const session = await getServerSession(authOptions)
  if (!session?.user) {
    redirect('/login')
  }

  return session
}

export default NextAuth(authOptions)
