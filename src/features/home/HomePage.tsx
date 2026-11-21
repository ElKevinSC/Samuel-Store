// Página principal: arma las secciones. La lógica vive en cada sección.
import { StoreDialogs } from '@/components/StoreDialogs'
import { CookieBanner, FloatingCartButton, FloatingWhatsApp, ToastMessage } from '@/components/layout/FloatingElements'
import { HelpSection } from '@/components/layout/HelpSection'
import { HeroSection } from '@/components/layout/HeroSection'
import { SiteFooter } from '@/components/layout/SiteFooter'
import { SiteHeader } from '@/components/layout/SiteHeader'
import { AdminPanel } from '@/features/admin/AdminPanel'
import { CatalogSection } from '@/features/catalog/CatalogSection'
import { ResellerPanel } from '@/features/reseller/ResellerPanel'
import { CustomerExpiringSection } from '@/features/streaming/ExpiringSubscriptions'
import { useStore } from '@/store/StoreProvider'

export function HomePage() {
  const { user, isAdmin, isReseller } = useStore()
  return (
    <div className="storefront">
      <SiteHeader />
      <main>
        <HeroSection />
        {user && !isReseller && !isAdmin && <CustomerExpiringSection />}
        <CatalogSection />
        <HelpSection />
        {user && isReseller && !isAdmin && <ResellerPanel />}
        {isAdmin && <AdminPanel />}
      </main>
      <SiteFooter />
      <FloatingWhatsApp />
      <ToastMessage />
      <FloatingCartButton />
      <CookieBanner />
      <StoreDialogs />
    </div>
  )
}
