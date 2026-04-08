import { AnimatePresence, motion } from 'framer-motion'
import Lenis from 'lenis'
import { useEffect, useMemo, useRef, useState } from 'react'

type SitePayload = {
  styleText: string
  bodyHtml: string
}

function stripModalFromHtml(bodyHtml: string) {
  // On retire le modal “HTML” pour le remplacer par un modal React + Framer Motion.
  return bodyHtml.replace(
    /<!--\s*MODAL CONTACT\s*-->[\s\S]*?<script>/i,
    '<script>',
  )
}

export function App() {
  const [payload, setPayload] = useState<SitePayload | null>(null)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const containerRef = useRef<HTMLDivElement | null>(null)

  const modalTitle = 'Parlons de votre projet.'
  const modalSub =
    "Un appel de 30 minutes suffit pour savoir si on peut vous aider — et comment. C'est gratuit, sans engagement, et 100% utile."

  const styleTagId = useMemo(() => 'keter-site-style', [])

  useEffect(() => {
    let disposed = false

    async function load() {
      const res = await fetch('/site.html', { cache: 'no-store' })
      const html = await res.text()
      const doc = new DOMParser().parseFromString(html, 'text/html')

      const styleEl = doc.querySelector('style')
      const styleText = styleEl?.textContent ?? ''

      // On garde le body complet (incluant cursor/nav/sections),
      // mais on retire le modal “HTML” (remplacé par React).
      const bodyHtml = stripModalFromHtml(doc.body.innerHTML)

      if (!disposed) setPayload({ styleText, bodyHtml })
    }

    void load()
    return () => {
      disposed = true
    }
  }, [])

  useEffect(() => {
    if (!payload?.styleText) return

    const existing = document.getElementById(styleTagId)
    if (existing) {
      existing.textContent = payload.styleText
      return
    }

    const style = document.createElement('style')
    style.id = styleTagId
    style.textContent = payload.styleText
    document.head.appendChild(style)

    return () => {
      // On ne supprime pas le style au unmount pour éviter un flash si HMR.
    }
  }, [payload?.styleText, styleTagId])

  useEffect(() => {
    // Smooth scroll inertiel (premium) + accessible.
    const lenis = new Lenis({
      lerp: 0.09,
      smoothWheel: true,
      wheelMultiplier: 0.9,
    })

    let raf = 0
    const loop = (t: number) => {
      lenis.raf(t)
      raf = requestAnimationFrame(loop)
    }
    raf = requestAnimationFrame(loop)

    return () => {
      cancelAnimationFrame(raf)
      lenis.destroy()
    }
  }, [])

  useEffect(() => {
    const root = containerRef.current
    if (!root) return

    const onClick = (e: MouseEvent) => {
      const t = e.target as HTMLElement | null
      if (!t) return

      // 1) Ouvre le modal depuis n’importe quel “openModal(event)” conservé dans le HTML source
      const modalTrigger = t.closest('[onclick*="openModal"]') as HTMLElement | null
      if (modalTrigger) {
        e.preventDefault()
        setIsModalOpen(true)
        return
      }

      // 2) FAQ toggle (au clic)
      const faqQ = t.closest('.faq-q') as HTMLElement | null
      if (faqQ) {
        const item = faqQ.parentElement
        if (!item) return
        const wasOpen = item.classList.contains('open')
        root.querySelectorAll('.faq-item').forEach((el) => el.classList.remove('open'))
        if (!wasOpen) item.classList.add('open')
        return
      }

      // 3) Ancres: smooth + close modal React si besoin
      const a = t.closest('a[href^="#"]') as HTMLAnchorElement | null
      if (a) {
        const href = a.getAttribute('href') ?? ''
        if (href.length > 1) {
          const target = document.querySelector(href)
          if (target) {
            e.preventDefault()
            target.scrollIntoView({ behavior: 'smooth', block: 'start' })
            setIsModalOpen(false)
          }
        }
      }
    }

    root.addEventListener('click', onClick, { capture: true })
    return () => root.removeEventListener('click', onClick, { capture: true } as any)
  }, [payload])

  useEffect(() => {
    const root = containerRef.current
    if (!root) return

    // Reveal animations (IntersectionObserver) conservées, mais plus “premium” côté timing via CSS existante.
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) (entry.target as HTMLElement).classList.add('visible')
        }
      },
      { threshold: 0.12 },
    )

    root
      .querySelectorAll('.reveal,.reveal-d1,.reveal-d2,.reveal-d3,.reveal-d4,.reveal-left,.reveal-right,.reveal-scale')
      .forEach((el) => observer.observe(el))

    return () => observer.disconnect()
  }, [payload])

  useEffect(() => {
    const root = containerRef.current
    if (!root) return

    // Custom cursor (site d’origine) — on conserve.
    const cursor = root.querySelector<HTMLElement>('#cursor')
    const ring = root.querySelector<HTMLElement>('#cursor-ring')
    if (!cursor || !ring) return

    let mx = 0
    let my = 0
    let rx = 0
    let ry = 0

    const onMove = (e: MouseEvent) => {
      mx = e.clientX
      my = e.clientY
      cursor.style.left = `${mx}px`
      cursor.style.top = `${my}px`
    }

    let raf = 0
    const animRing = () => {
      rx += (mx - rx) * 0.12
      ry += (my - ry) * 0.12
      ring.style.left = `${rx}px`
      ring.style.top = `${ry}px`
      raf = requestAnimationFrame(animRing)
    }

    window.addEventListener('mousemove', onMove, { passive: true })
    raf = requestAnimationFrame(animRing)

    return () => {
      window.removeEventListener('mousemove', onMove)
      cancelAnimationFrame(raf)
    }
  }, [payload])

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setIsModalOpen(false)
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [])

  useEffect(() => {
    document.body.style.overflow = isModalOpen ? 'hidden' : ''
    return () => {
      document.body.style.overflow = ''
    }
  }, [isModalOpen])

  return (
    <>
      <main ref={containerRef} dangerouslySetInnerHTML={{ __html: payload?.bodyHtml ?? '' }} />

      <AnimatePresence>
        {isModalOpen ? (
          <motion.div
            key="overlay"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.35 }}
            style={{
              position: 'fixed',
              inset: 0,
              zIndex: 1000,
              background: 'rgba(0,0,0,0.85)',
              backdropFilter: 'blur(12px)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: 20,
            }}
          >
            <motion.div
              key="modal"
              initial={{ y: 26, scale: 0.985, opacity: 0 }}
              animate={{ y: 0, scale: 1, opacity: 1 }}
              exit={{ y: 18, scale: 0.99, opacity: 0 }}
              transition={{ type: 'spring', stiffness: 160, damping: 22, mass: 0.9 }}
              style={{
                width: 'min(600px, 100%)',
                maxHeight: '90vh',
                overflowY: 'auto',
                background: 'var(--white)',
                borderRadius: 4,
                padding: 56,
                position: 'relative',
              }}
            >
              <button
                type="button"
                aria-label="Fermer"
                onClick={() => setIsModalOpen(false)}
                style={{
                  position: 'absolute',
                  top: 20,
                  right: 24,
                  width: 36,
                  height: 36,
                  border: 'none',
                  background: 'none',
                  fontSize: 22,
                  color: 'var(--gray3)',
                  borderRadius: '50%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer',
                }}
              >
                ×
              </button>

              <div style={{ fontFamily: 'var(--serif)', fontSize: 32, fontWeight: 700, color: 'var(--black)' }}>
                {modalTitle}
              </div>
              <div style={{ fontSize: 14, color: 'var(--gray3)', marginTop: 8, marginBottom: 36, lineHeight: 1.6 }}>
                {modalSub}
              </div>

              <form
                onSubmit={(e) => {
                  e.preventDefault()
                  // Démo : on ferme simplement (à remplacer par envoi).
                  setIsModalOpen(false)
                }}
              >
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    <label style={{ fontSize: 11, fontWeight: 600, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--gray3)' }}>
                      Prénom
                    </label>
                    <input
                      required
                      placeholder="Jean"
                      style={{
                        padding: '12px 16px',
                        border: '1px solid var(--gray6)',
                        borderRadius: 2,
                        fontFamily: 'var(--sans)',
                        fontSize: 14,
                        color: 'var(--black)',
                        outline: 'none',
                      }}
                    />
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    <label style={{ fontSize: 11, fontWeight: 600, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--gray3)' }}>
                      Nom
                    </label>
                    <input
                      placeholder="Dupont"
                      style={{
                        padding: '12px 16px',
                        border: '1px solid var(--gray6)',
                        borderRadius: 2,
                        fontFamily: 'var(--sans)',
                        fontSize: 14,
                        color: 'var(--black)',
                        outline: 'none',
                      }}
                    />
                  </div>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 16 }}>
                  <label style={{ fontSize: 11, fontWeight: 600, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--gray3)' }}>
                    Email professionnel
                  </label>
                  <input
                    type="email"
                    required
                    placeholder="jean@entreprise.com"
                    style={{
                      padding: '12px 16px',
                      border: '1px solid var(--gray6)',
                      borderRadius: 2,
                      fontFamily: 'var(--sans)',
                      fontSize: 14,
                      color: 'var(--black)',
                      outline: 'none',
                    }}
                  />
                </div>

                <button
                  type="submit"
                  style={{
                    width: '100%',
                    padding: 16,
                    background: 'var(--black)',
                    color: 'var(--white)',
                    border: 'none',
                    borderRadius: 2,
                    fontFamily: 'var(--sans)',
                    fontSize: 12,
                    fontWeight: 600,
                    letterSpacing: '0.12em',
                    textTransform: 'uppercase',
                    cursor: 'pointer',
                  }}
                >
                  → Envoyer ma demande
                </button>
              </form>
            </motion.div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </>
  )
}

