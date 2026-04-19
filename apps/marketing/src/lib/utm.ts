/**
 * Build an app URL with UTM tracking so we know which CTA drove each trial.
 */
const APP_URL =
  process.env.NEXT_PUBLIC_APP_URL || 'https://app.kamaia.cc'

type Source =
  | 'hero_cta'
  | 'hero_demo'
  | 'nav'
  | 'pricing'
  | 'cta_final'
  | 'features_cta'

export function appUrl(
  path: '/register' | '/login' | string,
  source: Source,
  plan?: string,
): string {
  const url = new URL(path, APP_URL)
  url.searchParams.set('utm_source', 'site')
  url.searchParams.set('utm_medium', source)
  if (plan) url.searchParams.set('plan', plan)
  return url.toString()
}
