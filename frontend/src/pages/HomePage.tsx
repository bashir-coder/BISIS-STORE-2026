import React from 'react'
import Hero from '../sections/Hero'
import About from '../sections/About'
import Steps from '../sections/Steps'
import TrustBadges from '@/sections/TrustBadges'
import StatsStrip from '../sections/StatsStrip'

const HomePage: React.FC = () => {
  return (
    <main>
      <Hero />
      <StatsStrip />
      <About />
      <Steps />
      <TrustBadges />
    </main>
  )
}

export default HomePage

