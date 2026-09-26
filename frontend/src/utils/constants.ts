export const SERVICES_CATEGORIES = [
  { id: 'ai', icon: 'Brain', labelKey: 'services.categories.ai' },
  { id: 'strategy', icon: 'Target', labelKey: 'services.categories.strategy' },
  { id: 'compliance', icon: 'Shield', labelKey: 'services.categories.compliance' },
  { id: 'finance', icon: 'TrendingUp', labelKey: 'services.categories.finance' },
  { id: 'marketing', icon: 'Megaphone', labelKey: 'services.categories.marketing' },
  { id: 'product', icon: 'Box', labelKey: 'services.categories.product' },
] as const

export const PACKAGES = [
  {
    id: 'foundation',
    nameKey: 'packages.foundation.name',
    descKey: 'packages.foundation.description',
    price: 699,
    features: [
      'packages.foundation.feature1',
      'packages.foundation.feature2',
      'packages.foundation.feature3',
      'packages.foundation.feature4',
    ],
    popular: false,
  },
  {
    id: 'growth',
    nameKey: 'packages.growth.name',
    descKey: 'packages.growth.description',
    price: 1499,
    features: [
      'packages.growth.feature1',
      'packages.growth.feature2',
      'packages.growth.feature3',
      'packages.growth.feature4',
    ],
    popular: true,
  },
  {
    id: 'scale',
    nameKey: 'packages.scale.name',
    descKey: 'packages.scale.description',
    price: 2499,
    features: [
      'packages.scale.feature1',
      'packages.scale.feature2',
      'packages.scale.feature3',
      'packages.scale.feature4',
    ],
    popular: false,
  },
] as const

export const LIFE_PLAN_PRICE = 150

export const DONATION_PERCENTAGE = 0.10

export const STEPS = [
  { icon: '💡', titleKey: 'steps.step1.title', descKey: 'steps.step1.desc' },
  { icon: '📋', titleKey: 'steps.step2.title', descKey: 'steps.step2.desc' },
  { icon: '⚙️', titleKey: 'steps.step3.title', descKey: 'steps.step3.desc' },
  { icon: '🚀', titleKey: 'steps.step4.title', descKey: 'steps.step4.desc' },
] as const

export const TRUST_BADGES = [
  { icon: 'Lock', labelKey: 'trust.badges.ssl' },
  { icon: 'ShieldCheck', labelKey: 'trust.badges.recaptcha' },
  { icon: 'Wallet', labelKey: 'trust.badges.payment' },
  { icon: 'Headphones', labelKey: 'trust.badges.support' },
] as const
