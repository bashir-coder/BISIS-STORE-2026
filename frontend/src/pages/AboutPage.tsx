import React from 'react'
import { motion } from 'framer-motion'
import AboutSection from '../sections/About'

const AboutPage: React.FC = () => {
  return (
    <div className="min-h-screen pt-24 pb-20 section-padding">
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
        <AboutSection />
      </motion.div>
    </div>
  )
}

export default AboutPage

