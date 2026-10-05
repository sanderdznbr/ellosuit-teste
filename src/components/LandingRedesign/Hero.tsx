import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { motion } from 'framer-motion';
import { Users, Zap, TrendingUp, PieChart } from 'lucide-react';
import heroDashboardAsset from '@/assets/capture-print.gif.asset.json';
import automatizeAsset from '@/assets/automatize.gif.asset.json';
import characterAsset from '@/assets/capture-character.png.asset.json';
const heroDashboard = heroDashboardAsset.url;
const automatizeImg = automatizeAsset.url;
const heroCharacter = characterAsset.url;

export const Hero = () => {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState(0);

  const tabs = [
    { name: 'Capture', icon: Users, image: heroDashboard },
    { name: 'Automatize', icon: Zap, image: automatizeImg },
    { name: 'Escale', icon: TrendingUp, image: heroDashboard },
    { name: 'Analise', icon: PieChart, image: heroDashboard },
  ];

  return (
    <section className="relative pt-28 pb-16 md:pt-36 md:pb-24 overflow-hidden bg-[#faf9f7]">
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full h-full -z-10 pointer-events-none">
        <div className="absolute top-[10%] left-1/2 -translate-x-1/2 w-[1100px] h-[700px] bg-[#374DA4]/[0.03] blur-[140px] rounded-full" />
      </div>

      <div className="container max-w-7xl mx-auto px-6">
        <div className="text-center max-w-4xl mx-auto mb-10">
          <motion.h1
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.05 }}
            className="text-5xl md:text-7xl lg:text-[88px] font-semibold tracking-[-0.03em] text-[#1f1e1d] mb-6 leading-[1.05]"
          >
            Escale{' '}
            <span className="relative inline-block whitespace-nowrap">
              conversas,
              <motion.svg
                aria-hidden="true"
                viewBox="0 0 300 24"
                preserveAspectRatio="none"
                className="absolute left-[-1%] -bottom-2 md:-bottom-3 w-[102%] h-[0.3em] pointer-events-none overflow-visible"
              >
                <motion.path
                  d="M4 14 C 70 4, 160 4, 230 10 S 285 18, 296 8"
                  fill="none"
                  stroke="#374DA4"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  initial={{ pathLength: 0, opacity: 0 }}
                  animate={{ pathLength: 1, opacity: 1 }}
                  transition={{
                    pathLength: { duration: 1.6, ease: [0.22, 1, 0.36, 1], delay: 0.5 },
                    opacity: { duration: 0.3, delay: 0.5 },
                  }}
                />
              </motion.svg>
            </span>
            <br />evite o caos
          </motion.h1>

          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.15 }}
            className="text-base md:text-lg text-[#6b6862] mb-10 max-w-xl mx-auto leading-relaxed"
          >
            CRM com IA para automatizar conversas, agendamentos e fluxos de trabalho no WhatsApp.
          </motion.p>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.25 }}
            className="flex flex-col items-center justify-center gap-6 mb-8"
          >
            <Button
              size="lg"
              onClick={() => navigate('/register')}
              className="group relative inline-flex items-center gap-2 rounded-full px-10 py-7 text-base font-semibold text-white bg-[#374DA4] hover:bg-[#2e4290] transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-[#374DA4] border-0 shadow-none"
            >
              <span className="relative z-10 tracking-wide">Grátis por 7 dias</span>
            </Button>

            {/* Badges */}
            <div className="flex items-center opacity-70">
              <img
                src="https://pcfcdn.kommo.com/images/pages/main/badges/meta-badge.png"
                alt="Meta Business Partner"
                className="h-2.5 md:h-3 w-auto object-contain"
                loading="lazy"
              />
            </div>
          </motion.div>
        </div>

        {/* Tabs */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.3 }}
          className="flex items-center justify-center gap-3 sm:gap-6 md:gap-10 mb-10 border-b border-[#e7e3da] max-w-3xl mx-auto px-2"
        >
          {tabs.map((t, i) => {
            const Icon = t.icon;
            const active = i === activeTab;
            return (
              <button
                key={t.name}
                onClick={() => setActiveTab(i)}
                className={`relative flex items-center gap-1.5 sm:gap-2 py-3 text-xs sm:text-sm md:text-base font-medium whitespace-nowrap transition-colors ${active ? 'text-[#374DA4]' : 'text-[#8a867e] hover:text-[#1f1e1d]'}`}
              >
                <Icon className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                {t.name}
                {active && <span className="absolute left-0 right-0 -bottom-px h-0.5 bg-[#374DA4] rounded-full" />}
              </button>
            );
          })}
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 40 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.4 }}
          className="relative max-w-5xl mx-auto px-2 md:px-0"
        >
          <div className="relative">
            <div className="relative rounded-[24px] overflow-hidden bg-white border border-[#e7e3da]">
              <img
                src={tabs[activeTab].image}
                alt="Dashboard Ellosuit — CRM WhatsApp com IA"
                width={1600}
                height={1000}
                className="w-full h-auto block"
              />
            </div>
          </div>
        </motion.div>
      </div>
    </section>
  );
};