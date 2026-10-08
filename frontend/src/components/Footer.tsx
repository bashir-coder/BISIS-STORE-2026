import React, { useState, useEffect, useRef } from 'react'
import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { ArrowUpRight, Mail, Sparkles, ChevronUp, ChevronDown } from 'lucide-react'
import { FadeIn } from './ui/FadeIn'
import { StaggerContainer, StaggerItem } from './ui/StaggerChildren'

const Footer: React.FC = () => {
  const { t } = useTranslation()
  const [isOpen, setIsOpen] = useState(true)
  const footerRef = useRef<HTMLElement>(null)
  const [contentHeight, setContentHeight] = useState<number | null>(null)

  useEffect(() => {
    if (footerRef.current) {
      setContentHeight(footerRef.current.scrollHeight)
    }
  }, [isOpen])

  const footerLinks = [
    {
      title: t('nav.services'),
      links: [
        { label: t('services.svc-001.name'), to: '/packages#svc-001' },
        { label: t('services.svc-002.name'), to: '/packages#svc-002' },
        { label: t('services.svc-003.name'), to: '/packages#svc-003' },
      ],
    },
    {
      title: t('nav.packages'),
      links: [
        { label: t('packages.foundation.name'), to: '/packages#foundation' },
        { label: t('packages.growth.name'), to: '/packages#growth' },
        { label: t('packages.scale.name'), to: '/packages#scale' },
      ],
    },
    {
      title: t('nav.about'),
      links: [
        { label: t('about.eyebrow'), to: '/about' },
        { label: t('nav.contact'), to: '/contact' },
      ],
    },
  ]

  const toggleFooter = () => {
    setIsOpen(prev => !prev)
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      toggleFooter()
    }
  }

  return (
    <>
      <footer
        ref={footerRef}
        className="relative overflow-hidden border-t border-border-1 bg-surface-inset backdrop-blur-xl transition-all duration-500 ease-premium"
        style={
          isOpen
            ? { maxHeight: contentHeight ? `${contentHeight}px` : 'none' }
            : { maxHeight: '80px' }
        }
        aria-hidden={!isOpen}
      >
        <div className="pointer-events-none absolute inset-x-0 top-0 h-72 bg-[radial-gradient(circle_at_50%_0%,rgba(212,175,55,0.14),transparent_65%)]" />
        <div className="neon-line-gold h-px w-full" />

        <div className="section-padding relative pt-16 pb-10 overflow-hidden">
          {/* CTA Section - only visible when open */}
          {isOpen && (
            <FadeIn delay={0.1}>
              <section className="relative mb-20 overflow-hidden rounded-[2rem] border border-gold/20 bg-gradient-to-br from-gold/15 via-white/[0.04] to-transparent p-8 sm:p-10 lg:p-12">
                <div className="pointer-events-none absolute -right-20 -top-24 h-64 w-64 rounded-full bg-gold/10 blur-3xl" />
                <div className="pointer-events-none absolute -bottom-32 left-1/3 h-72 w-72 rounded-full bg-gold/5 blur-3xl" />
                <div className="relative flex flex-col gap-8 lg:flex-row lg:items-end lg:justify-between">
                  <div className="max-w-2xl">
                    <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-gold/20 bg-surface-inset px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.18em] text-gold">
                      <Sparkles className="h-3.5 w-3.5" />
                      <span>{t('hero.badge')}</span>
                    </div>
                     <h2 className="text-3xl font-bold leading-tight text-ink-0 sm:text-4xl">{t('footer.cta_title')}</h2>
                     <p className="mt-4 max-w-xl text-sm leading-7 text-ink-3 sm:text-base">{t('footer.cta_body')}</p>
                  </div>
                  <div className="flex shrink-0 flex-col gap-3 sm:flex-row">
                    <Link to="/packages" className="btn-primary inline-flex items-center justify-center gap-2 px-6 py-3.5 text-sm">
                      {t('footer.cta_primary')}
                      <ArrowUpRight className="h-4 w-4" />
                    </Link>
                    <Link to="/contact" className="btn-secondary inline-flex items-center justify-center gap-2 px-6 py-3.5 text-sm">
                      <Mail className="h-4 w-4" />
                      {t('footer.cta_secondary')}
                    </Link>
                  </div>
                </div>
              </section>
            </FadeIn>
          )}

          {/* Main Content - collapsible */}
          <div className={`transition-all duration-500 ease-premium ${isOpen ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4 pointer-events-none'}`}>
            <StaggerContainer stagger={0.06} delay={isOpen ? 0.15 : 0}>
              <div className="lg:col-span-2">
                <StaggerItem direction="left" delay={0}>
                  <Link to="/" className="group inline-flex items-center gap-3.5" aria-label="BİŞİŞ">
                    <div className="relative w-12 h-12 rounded-xl overflow-hidden border-2 border-gold/50 shadow-lg shadow-gold/40 group-hover:border-gold neon-hover-gold-4 group-hover:scale-105 transition-all duration-300">
                      <img
                        src="/BİŞİŞ-logo.jpg"
                        alt="BİŞİŞ"
                        className="w-full h-full object-cover"
                      />
                    </div>

                     <span className="text-2xl font-bold font-outfit text-ink-0 tracking-wider group-hover:text-gold transition-colors neon-drop-gold-2">
                       BİŞİŞ
                     </span>
                  </Link>
                </StaggerItem>
                {isOpen && (
                  <>
                     <StaggerItem direction="left" delay={0.06}>
                       <p className="max-w-sm text-sm leading-relaxed text-ink-3">{t('footer.sub')}</p>
                     </StaggerItem>
                     <StaggerItem direction="left" delay={0.12}>
                       <Link
                         to="/contact"
                         aria-label={t('footer.contact')}
                         className="inline-flex h-11 w-11 items-center justify-center rounded-xl border border-border-1 bg-surface-1 text-ink-2 transition-all hover:border-gold/30 hover:bg-gold/10 hover:text-gold"
                       >
                        <Mail className="h-5 w-5" />
                      </Link>
                    </StaggerItem>
                    <StaggerItem direction="left" delay={0.18}>
                      <div id="footer-social-links" className="mt-5 flex flex-wrap items-center gap-3" aria-label={t('footer.social_links')}>
                        <a href="https://wa.me/970597997040" target="_blank" rel="noreferrer" aria-label={t('floating.whatsapp')} title={t('floating.whatsapp')} className="inline-flex h-11 w-11 items-center justify-center rounded-full border border-[#25D366]/40 bg-[#10261a]/80 text-[#25D366] transition hover:bg-[#25D366] hover:text-white">
                          <i aria-hidden="true" className="fa-brands fa-whatsapp text-lg" />
                        </a>
                        <a href="https://t.me/share/url?url=https%3A%2F%2FBİŞİŞ.com&text=BİŞİŞ" target="_blank" rel="noreferrer" aria-label={t('floating.telegram')} title={t('floating.telegram')} className="inline-flex h-11 w-11 items-center justify-center rounded-full border border-[#229ED9]/40 bg-[#10212d]/80 text-[#229ED9] transition hover:bg-[#229ED9] hover:text-white">
                          <i aria-hidden="true" className="fa-brands fa-telegram text-lg" />
                        </a>
                        <a href="https://instagram.com/bishish_30" target="_blank" rel="noreferrer" aria-label={t('floating.instagram')} title={t('floating.instagram')} className="inline-flex h-11 w-11 items-center justify-center rounded-full border border-[#E4405F]/40 bg-[#321521]/80 text-[#E4405F] transition hover:bg-[#E4405F] hover:text-white">
                          <i aria-hidden="true" className="fa-brands fa-instagram text-lg" />
                        </a>
                        <a href="https://x.com/BİŞİŞHQ" target="_blank" rel="noreferrer" aria-label={t('floating.x')} title={t('floating.x')} className="inline-flex h-11 w-11 items-center justify-center rounded-full border border-white/25 bg-white/[0.06] text-white transition hover:bg-white hover:text-black">
                          <i aria-hidden="true" className="fa-brands fa-x-twitter text-lg" />
                        </a>
                        <a href="https://www.youtube.com/@BİŞİŞ-2030" target="_blank" rel="noreferrer" aria-label={t('floating.youtube')} title={t('floating.youtube')} className="inline-flex h-11 w-11 items-center justify-center rounded-full border border-[#FF0000]/40 bg-[#321010]/80 text-[#FF0000] transition hover:bg-[#FF0000] hover:text-white">
                          <i aria-hidden="true" className="fa-brands fa-youtube text-lg" />
                        </a>
                      </div>
                    </StaggerItem>
                  </>
                )}
              </div>

              {isOpen && footerLinks.map((group) => (
                 <StaggerItem key={group.title} direction="left">
                   <div className="space-y-4">
                     <h4 className="text-sm font-semibold uppercase tracking-wider text-ink-0">{group.title}</h4>
                     <ul className="space-y-3">
                       {group.links.map((link) => (
                         <li key={link.to}>
                           <Link to={link.to} className="group flex items-center gap-1 text-sm text-ink-2 transition-colors hover:text-gold">
                             {link.label}
                             <ArrowUpRight className="h-3 w-3 -translate-y-1 translate-x-1 opacity-0 transition-all group-hover:translate-x-0 group-hover:translate-y-0 group-hover:opacity-100" />
                           </Link>
                         </li>
                       ))}
                     </ul>
                   </div>
                 </StaggerItem>
              ))}

              {isOpen && (
                <div className="mt-16 flex flex-col items-center justify-between gap-4 border-t border-border-1 pt-8 md:flex-row">
                  <p className="text-sm text-ink-3">{t('footer.copyright')}</p>
                  <Link to="/contact" className="text-sm text-ink-3 transition-colors hover:text-gold">
                    {t('footer.contact')}
                  </Link>
                </div>
              )}
            </StaggerContainer>
          </div>

          {/* Collapsed brand bar - always visible when closed */}
          {!isOpen && (
            <div className="flex items-center justify-between py-4">
              <Link to="/" className="group inline-flex items-center gap-3" aria-label="BİŞİŞ">
                <div className="relative w-10 h-10 rounded-xl overflow-hidden border-2 border-gold/50 shadow-lg shadow-gold/40 group-hover:border-gold neon-hover-gold-4 group-hover:scale-105 transition-all duration-300">
                  <img
                    src="/BİŞİŞ-logo.jpg"
                    alt="BİŞİŞ"
                    className="w-full h-full object-cover"
                  />
                </div>
                <span className="text-xl font-bold font-outfit text-ink-0 tracking-wider group-hover:text-gold transition-colors neon-drop-gold-2">
                  BİŞİŞ
                </span>
              </Link>
            </div>
          )}
        </div>
      </footer>

      {/* Toggle Button */}
      <button
        type="button"
        onClick={toggleFooter}
        onKeyDown={handleKeyDown}
        className="fixed bottom-6 right-6 z-50 flex h-12 w-12 items-center justify-center rounded-full border border-gold/30 bg-surface-inset backdrop-blur-xl text-gold shadow-xl shadow-black/50 transition-all duration-300 hover:border-gold neon-hover-gold-3 focus:outline-none focus:ring-2 focus:ring-gold/50 focus:ring-offset-2 focus:ring-offset-black"
        aria-label={isOpen ? t('footer.collapse') : t('footer.expand')}
        aria-expanded={isOpen}
        aria-controls="footer-content"
      >
        {isOpen ? (
          <ChevronUp className="h-6 w-6" aria-hidden="true" />
        ) : (
          <ChevronDown className="h-6 w-6" aria-hidden="true" />
        )}
      </button>
    </>
  )
}

export default Footer