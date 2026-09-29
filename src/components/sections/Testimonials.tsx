import React from 'react';
import { motion } from 'framer-motion';
import { Linkedin, Quote } from 'lucide-react';
import { testimonials } from '../../data/testimonials';
import { profile } from '../../data/profile';
import SectionHeading from '../ui/SectionHeading';
import SpotlightCard from '../ui/SpotlightCard';

const Testimonials: React.FC = () => {
  return (
    <section id="testimonials" className="section-padding border-t border-border">
      <div className="container">
        <SectionHeading
          index="05"
          label="Recomendaciones"
          title={
            <>
              Lo que dicen <span className="text-primary">quienes trabajaron conmigo</span>.
            </>
          }
        />

        <div className="grid gap-5 md:grid-cols-3">
          {testimonials.map((t, i) => (
            <motion.div
              key={t.name}
              initial={{ opacity: 0, y: 24 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: i * 0.1 }}
            >
              <SpotlightCard className="h-full">
                <figure className="flex h-full flex-col p-6 md:p-7">
                  <Quote
                    size={28}
                    className="text-primary transition-transform duration-300 group-hover:-rotate-12 group-hover:scale-110"
                  />
                  <blockquote className="mt-4 flex-1 text-lg leading-relaxed">“{t.quote}”</blockquote>
                  <figcaption className="mt-6 flex items-center gap-3 border-t border-border pt-5">
                    <img
                      src={t.avatar}
                      alt={t.name}
                      loading="lazy"
                      className="h-11 w-11 shrink-0 rounded-full object-cover ring-2 ring-border transition-all duration-300 group-hover:ring-primary"
                    />
                    <div className="min-w-0">
                      <p className="font-semibold">{t.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {t.role} · {t.relation}
                      </p>
                    </div>
                  </figcaption>
                </figure>
              </SpotlightCard>
            </motion.div>
          ))}
        </div>

        <a
          href={`${profile.linkedin}details/recommendations/`}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-8 inline-flex items-center gap-2 text-sm font-medium text-muted-foreground transition-colors hover:text-primary"
        >
          <Linkedin size={16} /> Ver recomendaciones en LinkedIn
        </a>
      </div>
    </section>
  );
};

export default Testimonials;
