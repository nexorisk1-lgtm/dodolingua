import { type NextRequest } from 'next/server'
import { updateSession } from '@/lib/supabase/middleware'

export async function middleware(request: NextRequest) {
  return await updateSession(request)
}

export const config = {
  matcher: [
    /*
     * Tout sauf : assets statiques, _next, fichiers d'image, manifest, favicon
     */
    '/((?!_next/static|_next/image|favicon.ico|icon.svg|manifest.json|.*\\.(?:png|jpg|jpeg|svg|gif|webp)$).*)',
  ],
}
