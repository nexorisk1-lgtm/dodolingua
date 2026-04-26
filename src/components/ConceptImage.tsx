import Image from 'next/image'

type Variant = 'lesson' | 'flashcard' | 'association' | 'quiz' | 'thumb'

interface ConceptImageProps {
  url: string | null | undefined
  alt?: string | null
  variant?: Variant
  className?: string
  priority?: boolean
}

const SIZES: Record<Variant, { w: number; h: number; cls: string }> = {
  lesson:      { w: 280, h: 280, cls: 'rounded-2xl' },
  flashcard:   { w: 200, h: 200, cls: 'rounded-xl' },
  association: { w: 120, h: 120, cls: 'rounded-lg' },
  quiz:        { w: 180, h: 180, cls: 'rounded-xl' },
  thumb:       { w: 64,  h: 64,  cls: 'rounded-md' },
}

/**
 * Affiche l'image d'un concept SI elle existe.
 * Si url est null/undefined/vide :
 *   - rend `null` (rien dans le DOM)
 *   - aucun placeholder, aucun espace réservé
 *   - le parent ne perd pas de hauteur
 *
 * Le parent doit être tolérant à l'absence (utiliser flex/grid avec `gap`).
 */
export function ConceptImage({
  url,
  alt,
  variant = 'lesson',
  className = '',
  priority = false,
}: ConceptImageProps) {
  if (!url) return null
  const { w, h, cls } = SIZES[variant]
  return (
    <Image
      src={url}
      alt={alt || ''}
      width={w}
      height={h}
      priority={priority}
      className={`object-cover bg-primary-50 ${cls} ${className}`}
    />
  )
}

/**
 * Wrapper "card" qui n'occupe d'espace QUE si l'image existe.
 * À utiliser quand on veut garantir un layout propre dans tous les cas.
 */
export function ConceptImageSlot({
  url,
  alt,
  variant = 'lesson',
  className = '',
}: ConceptImageProps) {
  if (!url) return null
  return (
    <div className={`flex justify-center ${className}`}>
      <ConceptImage url={url} alt={alt} variant={variant} />
    </div>
  )
}
