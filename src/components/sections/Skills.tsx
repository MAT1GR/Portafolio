import React, { useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { skillGroups } from '../../data/skills';
import SectionHeading from '../ui/SectionHeading';

const Skills: React.FC = () => {
  const [active, setActive] = useState(0);
  const group = skillGroups[active];

  return (
    <section id="skills" className="section-padding border-t border-border">
      <div className="container">
        <SectionHeading
          index="02"
          label="Stack"
          title={
            <>
              Herramientas que uso <span className="text-primary">en producción</span>.
            </>
          }
        />

        <div className="grid grid-cols-1 gap-8 md:grid-cols-[260px_1fr]">
          <div className="flex gap-2 overflow-x-auto pb-2 md:flex-col md:overflow-visible md:pb-0" role="tablist">
            {skillGroups.map((g, i) => {
              const Icon = g.icon;
              const isActive = i === active;
              return (
                <button
                  key={g.title}
                  role="tab"
                  aria-selected={isActive}
                  onClick={() => setActive(i)}
                  className={`relative flex shrink-0 items-center gap-3 rounded-xl px-4 py-3 text-left text-sm font-medium transition-colors ${
                    isActive ? 'text-primary-foreground' : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  {isActive && (
                    <motion.span
                      layoutId="skill-tab"
                      className="absolute inset-0 rounded-xl bg-primary"
                      transition={{ type: 'spring', stiffness: 400, damping: 35 }}
                    />
                  )}
                  <Icon size={18} className="relative" />
                  <span className="relative whitespace-nowrap">{g.title}</span>
                </button>
              );
            })}
          </div>

          <div className="surface relative min-h-[220px] overflow-hidden p-8">
            <div className="grid-bg pointer-events-none absolute inset-0 opacity-50" />
            <AnimatePresence mode="wait">
              <motion.div
                key={group.title}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.2 }}
                className="relative"
              >
                <p className="font-mono text-xs uppercase tracking-[0.2em] text-muted-foreground">{group.title}</p>
                <div className="mt-6 flex flex-wrap gap-3">
                  {group.items.map((item, i) => (
                    <motion.span
                      key={item}
                      initial={{ opacity: 0, y: 12, scale: 0.9 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      transition={{ delay: i * 0.04, type: 'spring', stiffness: 400, damping: 25 }}
                      whileHover={{ y: -4 }}
                      className="cursor-default rounded-xl border border-border bg-card px-4 py-2.5 font-medium shadow-sm transition-colors hover:border-primary hover:text-primary"
                    >
                      {item}
                    </motion.span>
                  ))}
                </div>
              </motion.div>
            </AnimatePresence>
          </div>
        </div>
      </div>
    </section>
  );
};

export default Skills;
