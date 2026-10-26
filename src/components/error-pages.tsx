import {
  Link,
  useRouter,
  type ErrorComponentProps,
} from '@tanstack/react-router'
import { Button } from '@/components/ui/button'

export function NotFoundPage() {
  return (
    <main className="grid min-h-svh place-items-center px-6 py-16">
      <div className="max-w-md space-y-6 text-center">
        <p className="text-sm font-medium text-muted-foreground">404</p>
        <h1 className="text-3xl font-semibold tracking-tight">
          Página no encontrada
        </h1>
        <p className="text-muted-foreground">
          Esta página no existe. Revisa la dirección o vuelve al inicio.
        </p>
        <Button asChild>
          <Link to="/">Ir al inicio</Link>
        </Button>
      </div>
    </main>
  )
}

export function RouteErrorPage({ reset }: ErrorComponentProps) {
  const router = useRouter()

  return (
    <main className="grid min-h-svh place-items-center px-6 py-16">
      <div className="max-w-md space-y-6 text-center">
        <h1 className="text-3xl font-semibold tracking-tight">
          No se pudo cargar esta página
        </h1>
        <p role="alert" className="text-muted-foreground">
          Inténtalo de nuevo o vuelve al inicio.
        </p>
        <div className="flex flex-wrap justify-center gap-3">
          <Button
            onClick={() => {
              void router.invalidate()
              reset()
            }}
          >
            Reintentar
          </Button>
          <Button variant="outline" asChild>
            <a href="/">Ir al inicio</a>
          </Button>
        </div>
      </div>
    </main>
  )
}
