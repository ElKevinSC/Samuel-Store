import { HeadContent, Scripts, createRootRoute } from '@tanstack/react-router'

import { Toaster } from '@/components/ui/sonner'
import { TooltipProvider } from '@/components/ui/tooltip'
import { NotFoundPage } from '@/components/error-pages'

import '../styles.css'

const siteName = 'Samuel Store | Tu mundo digital, en un solo lugar'
const siteUrl = 'https://samuelstore.online'
const siteLogo = `${siteUrl}/images/samuel-store-logo.jpg`
const siteDescription = 'Recargas de videojuegos, streaming y servicios digitales en Guatemala. En Samuel Store, tu meta es nuestra meta.'

export const Route = createRootRoute({
  head: () => ({
    meta: [
      {
        charSet: 'utf-8',
      },
      {
        name: 'viewport',
        content: 'width=device-width, initial-scale=1',
      },
      {
        name: 'theme-color',
        content: '#080b10',
      },
      {
        name: 'mobile-web-app-capable',
        content: 'yes',
      },
      {
        name: 'apple-mobile-web-app-capable',
        content: 'yes',
      },
      {
        name: 'apple-mobile-web-app-title',
        content: 'Samuel Store',
      },
      {
        title: siteName,
      },
      {
        name: 'description',
        content: siteDescription,
      },
      {
        property: 'og:title',
        content: siteName,
      },
      {
        property: 'og:description',
        content: siteDescription,
      },
      {
        property: 'og:type',
        content: 'website',
      },
      {
        property: 'og:url',
        content: `${siteUrl}/`,
      },
      {
        property: 'og:site_name',
        content: 'Samuel Store',
      },
      {
        property: 'og:locale',
        content: 'es_GT',
      },
      {
        property: 'og:image',
        content: siteLogo,
      },
      {
        name: 'twitter:card',
        content: 'summary',
      },
      {
        name: 'twitter:title',
        content: siteName,
      },
      {
        name: 'twitter:description',
        content: siteDescription,
      },
      {
        name: 'twitter:image',
        content: siteLogo,
      },
    ],
    links: [
      { rel: 'icon', href: '/favicon.ico', sizes: 'any' },
      { rel: 'icon', type: 'image/png', sizes: '192x192', href: '/icon-192.png' },
      { rel: 'apple-touch-icon', href: '/apple-touch-icon.png' },
      { rel: 'manifest', href: '/manifest.webmanifest' },
      { rel: 'canonical', href: `${siteUrl}/` },
    ],
    scripts: [
      {
        type: 'application/ld+json',
        children: JSON.stringify({
          '@context': 'https://schema.org',
          '@type': 'Organization',
          name: 'Samuel Store',
          url: `${siteUrl}/`,
          logo: siteLogo,
          areaServed: 'GT',
          contactPoint: {
            '@type': 'ContactPoint',
            telephone: '+502-5456-0623',
            contactType: 'customer service',
            availableLanguage: 'Spanish',
          },
          sameAs: [
            'https://www.facebook.com/SamuelStoreGt',
            'https://www.instagram.com/SamuelStoreGt',
            'https://www.tiktok.com/@SamuelStoreGt',
          ],
        }),
      },
    ],
  }),
  shellComponent: RootDocument,
  notFoundComponent: NotFoundPage,
})

function RootDocument({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es">
      <head>
        <HeadContent />
      </head>
      <body>
        <TooltipProvider>{children}</TooltipProvider>
        <Toaster />
        <Scripts />
      </body>
    </html>
  )
}
