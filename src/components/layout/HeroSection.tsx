import { ArrowRight } from 'lucide-react'
import { ControllerArt } from '@/components/store/controller-art'

export function HeroSection() {
  return (
    <section className="hero wrap" id="inicio">
      <div className="hero-copy">
        <h1>Tu juego.<br />Tu mundo.<br /><span>Tu siguiente nivel.</span></h1>
        <p className="slogan">En Samuel Store, tu meta es nuestra meta.</p>
        <div className="hero-actions">
          <a className="button" href="#catalogo">Explorar catálogo <ArrowRight size={18} /></a>
        </div>
      </div>
      <div className="hero-art"><ControllerArt /></div>
    </section>
  )
}
