import React from 'react'
import { Activity, ShieldCheck, Zap, Globe2 } from 'lucide-react'

const LiveStatusRibbon: React.FC = () => {

  const metrics = [
    {
      icon: Activity,
      label: 'BİŞIŞ Core V1',
      status: 'Operational',
      highlight: true,
    },
    {
      icon: Zap,
      label: 'Dispatch Queue',
      status: '< 15m Instant',
    },
    {
      icon: ShieldCheck,
      label: 'Escrow Security',
      status: 'Polygon USDC',
    },
    {
      icon: Globe2,
      label: 'Global Delivery',
      status: 'AR · TR · EN',
    },
  ]

  return (
    <div className="w-full border-y border-white/5 bg-black/40 backdrop-blur-md py-2.5 overflow-hidden">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex flex-wrap items-center justify-between gap-4 text-xs">
          <div className="flex items-center gap-2">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-light opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald"></span>
            </span>
            <span className="font-semibold uppercase tracking-wider text-white/90">
              System Health
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-6 sm:gap-8 text-white/60">
            {metrics.map((m, idx) => (
              <div key={idx} className="flex items-center gap-2">
                <m.icon className="w-3.5 h-3.5 text-gold/80" />
                <span className="text-white/40">{m.label}:</span>
                <span className={m.highlight ? 'text-emerald-light font-medium' : 'text-white/80 font-medium'}>
                  {m.status}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

export default LiveStatusRibbon
