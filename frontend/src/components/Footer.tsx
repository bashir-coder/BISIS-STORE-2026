import React from 'react'
import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { ArrowUpRight, Mail, Sparkles } from 'lucide-react'
import { FadeIn } from './ui/FadeIn'
import { StaggerContainer, StaggerItem } from './ui/StaggerChildren'

const Footer: React.FC = () => {
  const { t } = useTranslation()

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
        { label: t('nav.faq'), to: '/faq' },
        { label: t('nav.contact'), to: '/contact' },
      ],
    },
  ]

  return (
    <footer className="relative overflow-hidden border-t border-white/10 bg-black/40 backdrop-blur-xl">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-72 bg-[radial-gradient(circle_at_50%_0%,rgba(212,175,55,0.14),transparent_65%)]" />
      <div className="h-px w-full bg-gradient-to-r from-transparent via-gold/50 to-transparent" />

      <div className="section-padding relative pt-16 pb-10">
        <FadeIn delay={0.1}>
          <section className="relative mb-20 overflow-hidden rounded-[2rem] border border-gold/20 bg-gradient-to-br from-gold/15 via-white/[0.04] to-transparent p-8 sm:p-10 lg:p-12">
            <div className="pointer-events-none absolute -right-20 -top-24 h-64 w-64 rounded-full bg-gold/10 blur-3xl" />
            <div className="pointer-events-none absolute -bottom-32 left-1/3 h-72 w-72 rounded-full bg-amber-300/5 blur-3xl" />
            <div className="relative flex flex-col gap-8 lg:flex-row lg:items-end lg:justify-between">
              <div className="max-w-2xl">
                <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-gold/20 bg-black/30 px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.18em] text-gold">
                  <Sparkles className="h-3.5 w-3.5" />
                  <span>{t('hero.badge')}</span>
                </div>
                <h2 className="text-3xl font-bold leading-tight text-white sm:text-4xl">{t('footer.cta_title')}</h2>
                <p className="mt-4 max-w-xl text-sm leading-7 text-white/60 sm:text-base">{t('footer.cta_body')}</p>
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

        <StaggerContainer stagger={0.06} delay={0.15}>
          <div className="lg:col-span-2">
<StaggerItem direction="left" delay={0}>
               <Link to="/" className="group inline-flex items-center gap-3.5" aria-label="BİŞİŞ">
                 <div className="relative w-12 h-12 rounded-xl overflow-hidden border-2 border-gold/50 shadow-lg shadow-gold/40 group-hover:border-gold group-hover:shadow-[0_0_20px_rgba(212,175,55,0.55)] group-hover:scale-105 transition-all duration-300">
                   <img
                     src="/BİŞİŞ-logo.jpg"
                     alt="BİŞİŞ"
                     className="w-full h-full object-cover"
                   />
                 </div>

                 <span className="text-2xl font-bold font-outfit text-white tracking-wider group-hover:text-gold transition-colors drop-shadow-[0_0_8px_rgba(212,175,55,0.3)]">
                   BİŞİŞ
                 </span>
               </Link>
            </StaggerItem>
            <StaggerItem direction="left" delay={0.06}>
              <p className="max-w-sm text-sm leading-relaxed text-white/50">{t('footer.sub')}</p>
            </StaggerItem>
            <StaggerItem direction="left" delay={0.12}>
              <Link
                to="/contact"
                aria-label={t('footer.contact')}
                className="inline-flex h-11 w-11 items-center justify-center rounded-xl border border-white/10 bg-white/[0.03] text-white/60 transition-all hover:border-gold/30 hover:bg-gold/10 hover:text-gold"
              >
                <Mail className="h-5 w-5" />
              </Link>
            </StaggerItem>
            <StaggerItem direction="left" delay={0.18}>
              <div id="footer-social-links" className="mt-5 flex flex-wrap items-center gap-3" aria-label="BİŞİŞ social links">
                <a href="https://wa.me/970597997040" target="_blank" rel="noreferrer" aria-label="WhatsApp" title="WhatsApp" className="inline-flex h-11 w-11 items-center justify-center rounded-full border border-[#25D366]/40 bg-[#10261a]/80 text-[#25D366] transition hover:bg-[#25D366] hover:text-white">
                  <i aria-hidden="true" className="fa-brands fa-whatsapp text-lg" />
                </a>
                <a href="https://t.me/share/url?url=https%3A%2F%2FBİŞİŞ.com&text=BİŞİŞ" target="_blank" rel="noreferrer" aria-label="Telegram" title="Telegram" className="inline-flex h-11 w-11 items-center justify-center rounded-full border border-[#229ED9]/40 bg-[#10212d]/80 text-[#229ED9] transition hover:bg-[#229ED9] hover:text-white">
                  <i aria-hidden="true" className="fa-brands fa-telegram text-lg" />
                </a>
                <a href="https://instagram.com/bishish_30" target="_blank" rel="noreferrer" aria-label="Instagram" title="Instagram" className="inline-flex h-11 w-11 items-center justify-center rounded-full border border-[#E4405F]/40 bg-[#321521]/80 text-[#E4405F] transition hover:bg-[#E4405F] hover:text-white">
                  <i aria-hidden="true" className="fa-brands fa-instagram text-lg" />
                </a>
                <a href="https://x.com/BİŞİŞHQ" target="_blank" rel="noreferrer" aria-label="X" title="X" className="inline-flex h-11 w-11 items-center justify-center rounded-full border border-white/25 bg-white/[0.06] text-white transition hover:bg-white hover:text-black">
                  <i aria-hidden="true" className="fa-brands fa-x-twitter text-lg" />
                </a>
                <a href="https://www.youtube.com/@BİŞİŞ-2030" target="_blank" rel="noreferrer" aria-label="YouTube" title="YouTube" className="inline-flex h-11 w-11 items-center justify-center rounded-full border border-[#FF0000]/40 bg-[#321010]/80 text-[#FF0000] transition hover:bg-[#FF0000] hover:text-white">
                  <i aria-hidden="true" className="fa-brands fa-youtube text-lg" />
                </a>
              </div>
            </StaggerItem>
          </div>

          {footerLinks.map((group) => (
            <StaggerItem key={group.title} direction="left">
              <div className="space-y-4">
                <h4 className="text-sm font-semibold uppercase tracking-wider text-white">{group.title}</h4>
                <ul className="space-y-3">
                  {group.links.map((link) => (
                    <li key={link.to}>
                      <Link to={link.to} className="group flex items-center gap-1 text-sm text-white/50 transition-colors hover:text-gold">
                        {link.label}
                        <ArrowUpRight className="h-3 w-3 -translate-y-1 translate-x-1 opacity-0 transition-all group-hover:translate-x-0 group-hover:translate-y-0 group-hover:opacity-100" />
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            </StaggerItem>
          ))}
        </StaggerContainer>

        <div className="mt-16 flex flex-col items-center justify-between gap-4 border-t border-white/5 pt-8 md:flex-row">
          <p className="text-sm text-white/40">{t('footer.copyright')}</p>
          <Link to="/contact" className="text-sm text-white/40 transition-colors hover:text-gold">
            {t('footer.contact')}
          </Link>
        </div>
      </div>
    </footer>
  )
}

export default Footer

