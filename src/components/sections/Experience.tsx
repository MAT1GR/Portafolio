import React from 'react';
import { motion } from 'framer-motion';
import { GraduationCap } from 'lucide-react';
import { education, experience } from '../../data/profile';
import SectionHeading from '../ui/SectionHeading';

const Experience: React.FC = () => {
  return (
    <section id="experience" className="section-padding border-t border-border">
      <div className="container">
        <SectionHeading index="03" label="Trayectoria" title="Experiencia" />

        <div className="relative space-y-6 pl-8 md:pl-12">
          <motion.div
            initial={{ scaleY: 0 }}
            whileInView={{ scaleY: 1 }}
            viewport={{ once: true }}
            transition={{ duration: 1.2, ease: 'easeOut' }}
            className="absolute left-[7px] top-2 bottom-2 w-px origin-top bg-gradient-to-b from-primary via-primary/40 to-border md:left-[11px]"
          />

          {experience.map((job, i) => (
            <motion.article
              key={job.company}
              initial={{ opacity: 0, y: 24 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: '-60px' }}
              transition={{ duration: 0.5, delay: i * 0.1 }}
              className="relative"
            >
              <span className="absolute -left-8 top-7 flex h-4 w-4 items-center justify-center rounded-full bg-primary shadow-[0_0_0_4px_hsl(var(--background)),0_0_20px_hsl(var(--primary)/0.6)] md:-left-12 md:h-6 md:w-6">
                <span className="h-1.5 w-1.5 rounded-full bg-primary-foreground" />
              </span>

              <div className="surface p-6 transition-colors hover:border-primary/50 md:p-7">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <div>
                    <h3 className="text-xl font-semibold">{job.company}</h3>
                    <p className="text-primary">{job.role}</p>
                  </div>
                  <span className="chip">{job.period}</span>
                </div>
                <ul className="mt-5 grid gap-2 sm:grid-cols-3">
                  {job.highlights.map((item) => (
                    <li key={item} className="rounded-lg bg-secondary/60 px-3 py-2.5 text-sm">
                      {item}
                    </li>
                  ))}
                </ul>
                <div className="mt-4 flex flex-wrap gap-1.5">
                  {job.stack.map((tech) => (
                    <span key={tech} className="chip">
                      {tech}
                    </span>
                  ))}
                </div>
              </div>
            </motion.article>
          ))}

          <motion.article
            initial={{ opacity: 0, y: 24 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: '-60px' }}
            transition={{ duration: 0.5, delay: 0.2 }}
            className="relative"
          >
            <span className="absolute -left-8 top-5 flex h-4 w-4 items-center justify-center rounded-full border-2 border-primary bg-background md:-left-12 md:h-6 md:w-6" />
            <div className="surface flex flex-wrap items-center gap-4 p-6 md:p-7">
              <GraduationCap size={22} className="text-primary" />
              <div className="flex-1">
                <h3 className="font-semibold">{education.title}</h3>
                <p className="text-sm text-muted-foreground">{education.institution}</p>
              </div>
              <span className="chip">{education.period}</span>
            </div>
          </motion.article>
        </div>
      </div>
    </section>
  );
};

export default Experience;
