import React, { useEffect } from 'react';
import { Navbar } from '@/components/LandingRedesign/Navbar';
import { Hero } from '@/components/LandingRedesign/Hero';
import { ProblemSection } from '@/components/LandingRedesign/ProblemSection';
import { SocialProof } from '@/components/LandingRedesign/SocialProof';
import { TransformationSection } from '@/components/LandingRedesign/TransformationSection';
import { ModulesSection } from '@/components/LandingRedesign/ModulesSection';
import { AIIntegration } from '@/components/LandingRedesign/AIIntegration';
import { MeetingHighlight } from '@/components/LandingRedesign/MeetingHighlight';
import { AutomationsSection } from '@/components/LandingRedesign/AutomationsSection';
import { TargetAudience } from '@/components/LandingRedesign/TargetAudience';
import { ComparisonTable } from '@/components/LandingRedesign/ComparisonTable';
import { PricingSection } from '@/components/LandingRedesign/PricingSection';
import { FinalCTA } from '@/components/LandingRedesign/FinalCTA';
import { Footer } from '@/components/LandingRedesign/Footer';

const Landing = () => {
  useEffect(() => {
    // Ensure native scrolling is enabled for the landing page
    document.body.style.overflow = 'auto';
    document.documentElement.style.overflow = 'auto';
    
    // Smooth scroll behavior
    document.documentElement.style.scrollBehavior = 'smooth';
    
    return () => {
      document.documentElement.style.scrollBehavior = 'auto';
    };
  }, []);

  return (
    <div className="min-h-screen bg-[#faf9f7] text-[#1f1e1d] selection:bg-[#374DA4]/10 antialiased font-sans">
      <Navbar />
      <main>
        <Hero />
        
        <div className="space-y-0">
          <SocialProof />
          <ProblemSection />
          <TransformationSection />
          
          <div className="bg-[#faf9f7]">
            <ModulesSection />
          </div>
          
          <AIIntegration />
          <MeetingHighlight />
          <AutomationsSection />
          
          <TargetAudience />
          <ComparisonTable />
          <PricingSection />

          <FinalCTA />
        </div>
      </main>
      <Footer />
    </div>
  );
};

export default Landing;
