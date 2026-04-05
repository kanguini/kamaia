import 'next-auth'
import 'next-auth/jwt'

declare module 'next-auth' {
  interface Session {
    user: {
      id: string
      email: string
      firstName: string
      lastName: string
      role: string
      gabineteId: string
    }
    accessToken: string
    gabineteId: string
    role: string
  }

  interface User {
    id: string
    email: string
    name: string
    firstName: string
    lastName: string
    role: string
    gabineteId: string
    accessToken: string
    refreshToken: string
  }
}

declare module 'next-auth/jwt' {
  interface JWT {
    accessToken?: string
    refreshToken?: string
    user?: {
      id: string
      email: string
      firstName: string
      lastName: string
      role: string
      gabineteId: string
    }
  }
}
