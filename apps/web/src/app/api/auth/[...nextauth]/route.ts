import NextAuth, { NextAuthOptions, User } from 'next-auth'
import CredentialsProvider from 'next-auth/providers/credentials'
import { api } from '@/lib/api'

/**
 * NextAuth handler — adaptado ao novo formato de resposta da API CLM.
 *
 * Resposta de /auth/login (CLM):
 *   { accessToken, user, tenants[] }
 *
 * (O legacy retornava `{ data: { tokens: { accessToken, refreshToken }, user } }`.
 * O NextAuth handler ficou stale após o pivot — fixado aqui.)
 *
 * O API novo não tem `/auth/refresh` nem refresh tokens explícitos.
 * O JWT dura 24h por defeito (config no backend); quando expira o
 * utilizador re-loga.
 */
interface AuthResponse {
  accessToken: string
  user: {
    id: string
    email: string
    firstName: string
    lastName: string
  }
  tenants?: Array<{
    id: string
    slug: string
    nome: string
    plan: string
    role: string
    isDefault?: boolean
  }>
}

interface MeResponse {
  id: string
  email: string
  firstName: string
  lastName: string
}

const authOptions: NextAuthOptions = {
  providers: [
    CredentialsProvider({
      name: 'credentials',
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Password', type: 'password' },
        lembrar: { label: 'Lembrar', type: 'text' },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) {
          return null
        }

        try {
          const response = await api<AuthResponse>('/auth/login', {
            method: 'POST',
            noTenant: true,
            body: JSON.stringify({
              email: credentials.email,
              password: credentials.password,
              lembrar: credentials.lembrar === 'true',
            }),
          })

          if (!response?.accessToken || !response?.user) {
            console.error('Auth: unexpected response shape', response)
            return null
          }

          const { accessToken, user } = response

          return {
            id: user.id,
            email: user.email,
            name: `${user.firstName} ${user.lastName}`.trim(),
            firstName: user.firstName,
            lastName: user.lastName,
            accessToken,
          } as User
        } catch (error) {
          console.error('Auth error:', error)
          return null
        }
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user, account }) {
      if (account && user && account.provider === 'credentials') {
        token.accessToken = (user as User).accessToken
        token.user = {
          id: user.id as string,
          email: user.email as string,
          firstName: (user as User).firstName,
          lastName: (user as User).lastName,
        }
      }

      // Re-hidrata user info se ainda não tem (sessão antiga)
      if (!token.user && token.accessToken) {
        try {
          const me = await api<MeResponse>('/users/me', {
            token: token.accessToken as string,
            noTenant: true,
          })
          token.user = {
            id: me.id,
            email: me.email,
            firstName: me.firstName,
            lastName: me.lastName,
          }
        } catch (error) {
          console.error('JWT hydrate /users/me error:', error)
        }
      }

      return token
    },
    async session({ session, token }) {
      if (token.user) {
        session.user = token.user
      }
      session.accessToken = token.accessToken as string
      return session
    },
  },
  pages: {
    signIn: '/login',
    error: '/login',
  },
  session: {
    strategy: 'jwt',
    // 30 dias: >= TTL máximo do token da API (30d com "confiar neste
    // dispositivo"). A expiração efectiva é governada pelo token da API —
    // quando este expira, o api() faz logout automático. Sem isto (24h),
    // a sessão era cortada antes do token de 30d.
    maxAge: 30 * 24 * 60 * 60,
  },
  secret: process.env.NEXTAUTH_SECRET,
}

const handler = NextAuth(authOptions)

export { handler as GET, handler as POST }
