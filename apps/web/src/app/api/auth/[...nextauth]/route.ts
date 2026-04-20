import NextAuth, { NextAuthOptions, User } from 'next-auth'
import CredentialsProvider from 'next-auth/providers/credentials'
import { api } from '@/lib/api'

interface AuthResponse {
  data: {
    tokens: {
      accessToken: string
      refreshToken: string
    }
    user: {
      id: string
      email: string
      firstName: string
      lastName: string
      role: string
      gabineteId: string
    }
  }
}

interface RefreshResponse {
  data: {
    tokens: {
      accessToken: string
      refreshToken: string
    }
  }
}

interface MeResponse {
  data: {
    id: string
    email: string
    firstName: string
    lastName: string
    role: string
    gabineteId: string
  }
}

const authOptions: NextAuthOptions = {
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

        try {
          const response = await api<AuthResponse>('/auth/login', {
            method: 'POST',
            body: JSON.stringify({
              email: credentials.email,
              password: credentials.password,
            }),
          })

          const { tokens, user } = response.data

          return {
            id: user.id,
            email: user.email,
            name: `${user.firstName} ${user.lastName}`,
            firstName: user.firstName,
            lastName: user.lastName,
            role: user.role,
            gabineteId: user.gabineteId,
            accessToken: tokens.accessToken,
            refreshToken: tokens.refreshToken,
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
        token.accessToken = (user as any).accessToken
        token.refreshToken = (user as any).refreshToken
        token.user = {
          id: user.id,
          email: user.email!,
          firstName: (user as any).firstName,
          lastName: (user as any).lastName,
          role: (user as any).role,
          gabineteId: (user as any).gabineteId,
        }
      }

      if (token.accessToken) {
        try {
          const payload = JSON.parse(
            Buffer.from((token.accessToken as string).split('.')[1], 'base64').toString(),
          )
          const exp = payload.exp * 1000

          if (Date.now() >= exp - 60000) {
            try {
              const response = await api<RefreshResponse>('/auth/refresh', {
                method: 'POST',
                body: JSON.stringify({
                  refreshToken: token.refreshToken,
                }),
              })
              token.accessToken = response.data.tokens.accessToken
              token.refreshToken = response.data.tokens.refreshToken
            } catch (error) {
              console.error('Token refresh error:', error)
              return token
            }
          }
        } catch (error) {
          console.error('JWT decode error:', error)
        }
      }

      // Self-heal: tokens minted before the session callback wrote `token.user`
      // still carry a valid accessToken, but the UI would render firstName/lastName
      // as undefined. Hydrate once from /users/me so the chrome stops showing "—".
      if (!token.user && token.accessToken) {
        try {
          const me = await api<MeResponse>('/users/me', {
            token: token.accessToken as string,
          })
          token.user = {
            id: me.data.id,
            email: me.data.email,
            firstName: me.data.firstName,
            lastName: me.data.lastName,
            role: me.data.role,
            gabineteId: me.data.gabineteId,
          }
        } catch (error) {
          console.error('JWT hydrate /users/me error:', error)
        }
      }

      return token
    },
    async session({ session, token }) {
      if (token.user) {
        session.user = token.user as any
      }
      session.accessToken = token.accessToken as string
      session.gabineteId = (token.user as any)?.gabineteId
      session.role = (token.user as any)?.role

      return session
    },
  },
  pages: {
    signIn: '/login',
    error: '/login',
  },
  session: {
    strategy: 'jwt',
  },
  secret: process.env.NEXTAUTH_SECRET,
}

const handler = NextAuth(authOptions)

export { handler as GET, handler as POST }
