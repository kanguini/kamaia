// Twitter/X uses the same design as Open Graph. Re-export so Next.js emits
// `twitter:image` in the head with an independent URL (helps some scrapers).
export { default, alt, size, contentType } from './opengraph-image'
