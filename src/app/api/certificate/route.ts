/**
 * v3.23.3 — Endpoint PDF /api/certificate?level=A1
 * Génère un diplôme lauréat en français avec :
 *  - chapeau de diplômé dessiné en vectoriel
 *  - mention basée sur le score (Excellent / Très Bien / Bien / Passable)
 *  - bordure or, texte serif élégant
 *  - signature + numéro de série
 *
 * Lecture : GET /api/certificate?level=A1 → PDF inline si le user a le diplôme,
 * 403 sinon. GET /api/certificate (sans level) → JSON liste des diplômes obtenus.
 *
 * Insertion dans `certificates` : faite côté /api/quiz/finish quand pct >= 70.
 */
import { NextRequest, NextResponse } from 'next/server'
import { PDFDocument, StandardFonts, rgb, degrees } from 'pdf-lib'
import { createClient } from '@/lib/supabase/server'
import { cefrFull } from '@/lib/cefr_labels'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

type Mention = 'Passable' | 'Bien' | 'Très Bien' | 'Excellent'

function frDate(d: Date): string {
  return d.toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' })
}

export async function GET(req: NextRequest) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'auth required' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const level = (searchParams.get('level') || '').toUpperCase()

  // ───── Liste des diplômes (sans param level) ─────
  if (!level) {
    const { data: certs } = await supabase
      .from('certificates')
      .select('level, mention, score, issued_at, serial')
      .eq('user_id', user.id)
      .order('issued_at', { ascending: false })
    return NextResponse.json({ certificates: certs || [] })
  }

  // ───── Génération PDF pour un niveau précis ─────
  const { data: cert } = await supabase
    .from('certificates')
    .select('*')
    .eq('user_id', user.id)
    .eq('level', level)
    .maybeSingle()

  if (!cert) {
    return NextResponse.json(
      { error: `Tu n'as pas encore décroché le diplôme ${level}. Passe le test final !` },
      { status: 403 }
    )
  }

  // Nom affiché
  const { data: profile } = await supabase
    .from('profiles')
    .select('display_name')
    .eq('id', user.id)
    .maybeSingle()

  const userName =
    profile?.display_name ||
    (user.user_metadata as any)?.full_name ||
    (user.user_metadata as any)?.name ||
    user.email?.split('@')[0] ||
    'Apprenant·e'

  const pdfBytes = await renderDiploma({
    name: userName,
    level: cert.level,
    levelFull: cefrFull(cert.level),
    mention: cert.mention as Mention,
    score: cert.score,
    issued: new Date(cert.issued_at),
    serial: cert.serial,
  })

  return new NextResponse(Buffer.from(pdfBytes), {
    status: 200,
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `inline; filename="DodoLingua-Diplome-${level}.pdf"`,
      'Cache-Control': 'private, no-cache',
    },
  })
}

// ──────────────────────── Rendu PDF ────────────────────────
async function renderDiploma(p: {
  name: string
  level: string
  levelFull: string
  mention: Mention
  score: number
  issued: Date
  serial: string
}): Promise<Uint8Array> {
  const doc = await PDFDocument.create()
  const page = doc.addPage([842, 595]) // A4 paysage
  const { width: W, height: H } = page.getSize()

  // Couleurs
  const cream = rgb(0.99, 0.97, 0.91)
  const ink = rgb(0.10, 0.13, 0.24)
  const gold = rgb(0.85, 0.65, 0.13)
  const goldLight = rgb(0.95, 0.83, 0.42)
  const accent = rgb(0.55, 0.30, 0.78)
  const muted = rgb(0.45, 0.45, 0.50)

  // Fond crème
  page.drawRectangle({ x: 0, y: 0, width: W, height: H, color: cream })

  // Double bordure or
  page.drawRectangle({ x: 24, y: 24, width: W - 48, height: H - 48, borderColor: gold, borderWidth: 4 })
  page.drawRectangle({ x: 36, y: 36, width: W - 72, height: H - 72, borderColor: goldLight, borderWidth: 1 })

  // Coins ornés
  for (const [cx, cy] of [[36, 36], [W - 36, 36], [36, H - 36], [W - 36, H - 36]]) {
    page.drawRectangle({ x: cx - 6, y: cy - 6, width: 12, height: 12, color: gold, rotate: degrees(45) })
  }

  // Polices
  const fontTitle = await doc.embedFont(StandardFonts.TimesRomanBold)
  const fontSerif = await doc.embedFont(StandardFonts.TimesRoman)
  const fontItal  = await doc.embedFont(StandardFonts.TimesRomanItalic)
  const fontSans  = await doc.embedFont(StandardFonts.HelveticaBold)

  // ─── Chapeau de lauréat ───
  const capCx = W / 2
  const capCy = H - 90
  page.drawEllipse({ x: capCx, y: capCy - 8, xScale: 38, yScale: 8, color: ink })
  page.drawRectangle({ x: capCx - 28, y: capCy - 4, width: 56, height: 18, color: ink })
  page.drawRectangle({ x: capCx - 36, y: capCy + 12, width: 72, height: 8, color: ink })
  page.drawLine({ start: { x: capCx + 30, y: capCy + 18 }, end: { x: capCx + 50, y: capCy - 6 }, color: gold, thickness: 2 })
  page.drawCircle({ x: capCx + 50, y: capCy - 10, size: 6, color: gold })

  // ─── Marque ───
  const brand = 'DodoLingua'
  const brandSize = 28
  const brandW = fontSans.widthOfTextAtSize(brand, brandSize)
  page.drawText(brand, {
    x: (W - brandW) / 2,
    y: H - 150,
    size: brandSize,
    font: fontSans,
    color: accent,
  })
  page.drawLine({ start: { x: 120, y: H - 165 }, end: { x: W - 120, y: H - 165 }, color: gold, thickness: 1 })

  // ─── Titre principal ───
  const title = 'CERTIFICAT DE RÉUSSITE'
  const titleSize = 42
  const titleW = fontTitle.widthOfTextAtSize(title, titleSize)
  page.drawText(title, {
    x: (W - titleW) / 2,
    y: H - 220,
    size: titleSize,
    font: fontTitle,
    color: ink,
  })

  const subtitle = p.levelFull
  const subSize = 20
  const subW = fontItal.widthOfTextAtSize(subtitle, subSize)
  page.drawText(subtitle, {
    x: (W - subW) / 2,
    y: H - 250,
    size: subSize,
    font: fontItal,
    color: muted,
  })

  // ─── Décerné à ───
  const decerne = 'Le présent diplôme est décerné à'
  const decW = fontSerif.widthOfTextAtSize(decerne, 14)
  page.drawText(decerne, { x: (W - decW) / 2, y: H - 295, size: 14, font: fontSerif, color: muted })

  const nameSize = 36
  const nameW = fontTitle.widthOfTextAtSize(p.name, nameSize)
  page.drawText(p.name, {
    x: (W - nameW) / 2,
    y: H - 340,
    size: nameSize,
    font: fontTitle,
    color: accent,
  })
  page.drawLine({
    start: { x: (W - nameW) / 2 - 12, y: H - 348 },
    end:   { x: (W - nameW) / 2 + nameW + 12, y: H - 348 },
    color: gold, thickness: 1.5,
  })

  // Phrase de validation
  const phrase = `pour avoir validé avec succès le niveau ${p.level} du parcours DodoLingua,`
  const phraseW = fontSerif.widthOfTextAtSize(phrase, 14)
  page.drawText(phrase, { x: (W - phraseW) / 2, y: H - 380, size: 14, font: fontSerif, color: ink })

  const phrase2 = `obtenant un score de ${Math.round(p.score)}/100 à l’évaluation finale.`
  const phrase2W = fontSerif.widthOfTextAtSize(phrase2, 14)
  page.drawText(phrase2, { x: (W - phrase2W) / 2, y: H - 400, size: 14, font: fontSerif, color: ink })

  // ─── Mention ───
  const mentionLabel = 'Mention'
  const mentionLW = fontSerif.widthOfTextAtSize(mentionLabel, 12)
  page.drawText(mentionLabel, { x: (W - mentionLW) / 2, y: H - 440, size: 12, font: fontSerif, color: muted })
  const mentionSize = 32
  const mentionW = fontTitle.widthOfTextAtSize(p.mention, mentionSize)
  page.drawText(p.mention, {
    x: (W - mentionW) / 2,
    y: H - 478,
    size: mentionSize,
    font: fontTitle,
    color: gold,
  })

  // ─── Bas : date + signature + serial ───
  const dateStr = `Délivré le ${frDate(p.issued)}`
  page.drawText(dateStr, { x: 80, y: 70, size: 11, font: fontSerif, color: ink })

  const sig = "L'équipe DodoLingua"
  const sigSize = 12
  const sigW = fontItal.widthOfTextAtSize(sig, sigSize)
  page.drawLine({ start: { x: W - 80 - sigW - 30, y: 80 }, end: { x: W - 80, y: 80 }, color: ink, thickness: 0.8 })
  page.drawText(sig, { x: W - 80 - sigW, y: 60, size: sigSize, font: fontItal, color: ink })

  const ser = `N° ${p.serial}`
  const serSize = 9
  const serW = fontSans.widthOfTextAtSize(ser, serSize)
  page.drawText(ser, { x: (W - serW) / 2, y: 50, size: serSize, font: fontSans, color: muted })

  return await doc.save()
}
