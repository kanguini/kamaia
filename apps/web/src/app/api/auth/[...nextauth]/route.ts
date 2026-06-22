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
            noTenant: true,
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
        token.accessToken = (user as User).accessToken
        token.refreshToken = (user as User).refreshToken
        token.user = {
          id: user.id as string,
          email: user.email as string,
          firstName: (user as User).firstName,
          lastName: (user as User).lastName,
        }
      }

      if (token.accessToken) {
        try {
          const payload = JSON.parse(
            Buffer.from((token.accessToken as string).split('.')[1], 'base64').toString(),
          )
          const exp = payload.exp * 1000

          if (Date.now() >= exp - 60_000) {
            try {
              const response = await api<RefreshResponse>('/auth/refresh', {
                method: 'POST',
                noTenant: true,
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

      if (!token.user && token.accessToken) {
        try {
          const me = await api<MeResponse>('/users/me', {
            token: token.accessToken as string,
            noTenant: true,
          })
          token.user = {
            id: me.data.id,
            email: me.data.email,
            firstName: me.data.firstName,
            lastName: me.data.lastName,
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
      session.refreshToken = token.refreshToken as string | undefined

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
