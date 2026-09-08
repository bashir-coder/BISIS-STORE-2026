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
    id: 'starter',
    nameKey: 'packages.starter.name',
    descKey: 'packages.starter.desc',
    price: 249,
    features: [
      'packages.starter.feature1',
      'packages.starter.feature2',
      'packages.starter.feature3',
      'packages.starter.feature4',
    ],
    popular: false,
  },
  {
    id: 'growth',
    nameKey: 'packages.growth.name',
    descKey: 'packages.growth.desc',
    price: 649,
    features: [
      'packages.growth.feature1',
      'packages.growth.feature2',
      'packages.growth.feature3',
      'packages.growth.feature4',
    ],
    popular: true,
  },
  {
    id: 'investor',
    nameKey: 'packages.investor.name',
    descKey: 'packages.investor.desc',
    price: 1499,
    features: [
      'packages.investor.feature1',
      'packages.investor.feature2',
      'packages.investor.feature3',
      'packages.investor.feature4',
    ],
    popular: false,
  },
] as const

export const LIFE_PLAN_PRICE = 49

export const DONATION_PERCENTAGE = 0.10
export const DONATION_CAUSE = 'Gaza Emergency Relief'

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
