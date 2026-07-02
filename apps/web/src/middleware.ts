export { default } from 'next-auth/middleware'

export const config = {
  matcher: [
    // `c/` (portal público do colaborador externo — o token no path É a auth)
    // e `accept-invite` (aceitar convite — o convidado ainda não tem conta)
    // têm de ficar fora da auth, senão a contraparte cai no ecrã de login.
    '/((?!login|register|forgot-password|reset-password|accept-invite|c/|api/auth|_next/static|_next/image|favicon.ico|.*\\.png|.*\\.jpg|.*\\.svg).*)',
  ],
}
