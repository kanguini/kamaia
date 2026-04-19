import type { MetadataRoute } from 'next'

const SITE = process.env.NEXT_PUBLIC_SITE_URL || 'https://kamaia.cc'

export default function sitemap(): MetadataRoute.Sitemap {
  const routes: Array<{
    path: string
    changeFrequency: MetadataRoute.Sitemap[number]['changeFrequency']
    priority: number
  }> = [
    { path: '/', changeFrequency: 'weekly', priority: 1.0 },
    { path: '/funcionalidades', changeFrequency: 'monthly', priority: 0.9 },
    { path: '/precos', changeFrequency: 'monthly', priority: 0.9 },
    { path: '/sobre', changeFrequency: 'monthly', priority: 0.7 },
    { path: '/contacto', changeFrequency: 'yearly', priority: 0.7 },
    { path: '/politica-privacidade', changeFrequency: 'yearly', priority: 0.3 },
    { path: '/termos', changeFrequency: 'yearly', priority: 0.3 },
  ]
  const lastModified = new Date()
  return routes.map((r) => ({
    url: `${SITE}${r.path}`,
    lastModified,
    changeFrequency: r.changeFrequency,
    priority: r.priority,
  }))
}
