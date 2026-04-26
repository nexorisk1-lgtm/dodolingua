import { NextRequest, NextResponse } from 'next/server'
import { assertAdminApi } from '@/lib/admin'

const BUCKET = 'concept-images'
const MAX_SIZE = 2 * 1024 * 1024
const ALLOWED = ['image/png', 'image/jpeg', 'image/webp']

/**
 * POST /api/admin/concepts/:id/image
 *   Upload : multipart/form-data { file, alt?, attribution? }
 *   Retourne { url } et met à jour la table concepts.
 */
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  let ctx
  try { ctx = await assertAdminApi() } catch (r) { return r as Response }
  const { user, supabase } = ctx

  const fd = await req.formData()
  const file = fd.get('file') as File | null
  const alt = (fd.get('alt') as string | null) ?? null
  const attribution = (fd.get('attribution') as string | null) ?? null

  if (!file) return NextResponse.json({ error: 'Fichier manquant' }, { status: 400 })
  if (file.size > MAX_SIZE) return NextResponse.json({ error: 'Fichier > 2 MB' }, { status: 400 })
  if (!ALLOWED.includes(file.type)) return NextResponse.json({ error: 'Format non autorisé' }, { status: 400 })

  const ext = file.type === 'image/png' ? 'png' : file.type === 'image/webp' ? 'webp' : 'jpg'
  const path = `${params.id}/${Date.now()}.${ext}`

  const { error: upErr } = await supabase.storage.from(BUCKET)
    .upload(path, file, { upsert: false, contentType: file.type, cacheControl: '31536000' })
  if (upErr) return NextResponse.json({ error: upErr.message }, { status: 500 })

  const { data: pub } = supabase.storage.from(BUCKET).getPublicUrl(path)
  const url = pub.publicUrl

  const { error: dbErr } = await supabase.from('concepts').update({
    image_url: url,
    image_alt: alt,
    image_attribution: attribution,
    image_uploaded_by: user.id,
    image_uploaded_at: new Date().toISOString(),
  }).eq('id', params.id)

  if (dbErr) return NextResponse.json({ error: dbErr.message }, { status: 500 })
  return NextResponse.json({ url, alt, attribution })
}

/**
 * PUT /api/admin/concepts/:id/image
 *   JSON : { url, alt?, attribution? } — pour pointer vers une image externe.
 */
export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  let ctx
  try { ctx = await assertAdminApi() } catch (r) { return r as Response }
  const { user, supabase } = ctx

  const { url, alt, attribution } = await req.json()
  if (url && !/^https?:\/\//i.test(url)) {
    return NextResponse.json({ error: 'URL invalide' }, { status: 400 })
  }

  const { error } = await supabase.from('concepts').update({
    image_url: url || null,
    image_alt: alt || null,
    image_attribution: attribution || null,
    image_uploaded_by: user.id,
    image_uploaded_at: new Date().toISOString(),
  }).eq('id', params.id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}

/**
 * DELETE /api/admin/concepts/:id/image
 *   Supprime l'image (storage si Supabase) + reset les champs.
 */
export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  let ctx
  try { ctx = await assertAdminApi() } catch (r) { return r as Response }
  const { supabase } = ctx

  const { data: concept } = await supabase
    .from('concepts').select('image_url').eq('id', params.id).single()

  // Si l'image est dans notre bucket Storage, on la supprime du Storage
  if (concept?.image_url) {
    try {
      const u = new URL(concept.image_url)
      const idx = u.pathname.indexOf(`/${BUCKET}/`)
      if (idx >= 0) {
        const path = decodeURIComponent(u.pathname.slice(idx + BUCKET.length + 2))
        await supabase.storage.from(BUCKET).remove([path])
      }
    } catch { /* URL externe : on ne supprime pas */ }
  }

  const { error } = await supabase.from('concepts').update({
    image_url: null, image_alt: null, image_attribution: null,
    image_uploaded_by: null, image_uploaded_at: null,
  }).eq('id', params.id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
