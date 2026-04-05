export { default } from 'next-auth/middleware'

export const config = {
  matcher: [
    '/((?!login|register|forgot-password|api/auth|_next/static|_next/image|favicon.ico|.*\\.png|.*\\.jpg|.*\\.svg).*)',
  ],
}
