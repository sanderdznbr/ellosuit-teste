import React, { useEffect, useRef, useState } from 'react';
import { motion, useInView, useMotionValue, animate } from 'framer-motion';

type Metric = {
  target: number;
  prefix?: string;
  suffix?: string;
  useThousands?: boolean;
  label: string;
};

const METRICS: Metric[] = [
  { target: 2500, prefix: '+', useThousands: true, label: 'empresas usando' },
  { target: 12, suffix: 'M+', label: 'mensagens processadas/mês' },
  { target: 93, suffix: '%', label: 'reduzem tempo de resposta em 7 dias' },
];

const formatNumber = (n: number, m: Metric) => {
  const rounded = Math.round(n);
  const body = m.useThousands ? rounded.toLocaleString('pt-BR') : String(rounded);
  return `${m.prefix ?? ''}${body}${m.suffix ?? ''}`;
};

const AnimatedNumber: React.FC<{ metric: Metric; inView: boolean }> = ({ metric, inView }) => {
  const mv = useMotionValue(0);
  const [display, setDisplay] = useState(formatNumber(0, metric));

  useEffect(() => {
    if (!inView) return;
    const controls = animate(mv, metric.target, {
      duration: 2.2,
      ease: [0.22, 1, 0.36, 1],
      onUpdate: (v) => setDisplay(formatNumber(v, metric)),
    });
    return () => controls.stop();
  }, [inView, metric, mv]);

  return <>{display}</>;
};

export const SocialProof = () => {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, margin: '-10%' });

  return (
    <section className="py-28 md:py-40 bg-[#faf9f7]">
      <div ref={ref} className="container max-w-7xl mx-auto px-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-16 md:gap-10 text-center">
          {METRICS.map((m, i) => (
            <motion.div
              key={m.label}
              initial={{ opacity: 0, y: 24 }}
              animate={inView ? { opacity: 1, y: 0 } : {}}
              transition={{ duration: 0.7, delay: i * 0.15, ease: [0.22, 1, 0.36, 1] }}
              className="flex flex-col items-center"
            >
              <div className="mb-5">
                <div
                  className="text-5xl md:text-6xl lg:text-7xl font-semibold tracking-[-0.04em] leading-none text-[#374DA4]"
                >
                  <AnimatedNumber metric={m} inView={inView} />
                </div>
              </div>
              <div className="text-sm md:text-base text-[#6b6862] max-w-[260px]">
                {m.label}
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
};