import React, { useEffect, useRef, useState } from 'react';
import { animate, motion, useInView } from 'framer-motion';
import { Sparkles } from 'lucide-react';
import { about, currently, services, stats } from '../../data/profile';
import SectionHeading from '../ui/SectionHeading';
import SpotlightCard from '../ui/SpotlightCard';

const CountUp: React.FC<{ to: number }> = ({ to }) => {
  const ref = useRef<HTMLSpanElement>(null);
  const inView = useInView(ref, { once: true });
  const [value, setValue] = useState(0);

  useEffect(() => {
    if (!inView) return;
    const controls = animate(0, to, { duration: 1.4, ease: 'easeOut', onUpdate: (v) => setValue(Math.round(v)) });
    return () => controls.stop();
  }, [inView, to]);

  return <span ref={ref}>{value}</span>;
};

const About: React.FC = () => {
  return (
    <section id="about" className="section-padding">
      <div className="container">
        <SectionHeading
          index="01"
          label="Sobre mí"
          title={
            <>
              Del problema al <span className="text-primary">producto funcionando</span>.
            </>
          }
        />

        <div className="grid gap-10 lg:grid-cols-[1fr_1.1fr] lg:gap-16">
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
          >
            <div className="flex items-center gap-5">
              <img
                src="/img/about.jpg"
                alt="Matías Grigolo"
                className="h-20 w-20 rounded-2xl object-cover ring-2 ring-primary/40 ring-offset-4 ring-offset-background"
                loading="lazy"
              />
              <p className="inline-flex items-start gap-2 text-sm text-muted-foreground">
                <Sparkles size={16} className="mt-0.5 shrink-0 text-primary" />
                {currently}
              </p>
            </div>

            <p className="mt-8 text-xl leading-relaxed">{about}</p>

            <div className="mt-10 grid grid-cols-3 gap-4 border-t border-border pt-8">
              {stats.map((stat) => (
                <div key={stat.label}>
                  <p className="text-4xl font-bold text-primary md:text-5xl">
                    <CountUp to={stat.value} />
                    {stat.suffix}
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground sm:text-sm">{stat.label}</p>
                </div>
              ))}
            </div>
          </motion.div>

          <div className="grid gap-4 sm:grid-cols-2">
            {services.map((service, i) => {
              const Icon = service.icon;
              return (
                <motion.div
                  key={service.title}
                  initial={{ opacity: 0, y: 24 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.5, delay: i * 0.08 }}
                >
                  <SpotlightCard className="h-full p-6">
                    <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10 text-primary transition-all duration-300 group-hover:scale-110 group-hover:bg-primary group-hover:text-primary-foreground">
                      <Icon size={20} />
                    </div>
                    <h3 className="mt-5 font-semibold">{service.title}</h3>
                    <p className="mt-1 text-sm text-muted-foreground">{service.description}</p>
                  </SpotlightCard>
                </motion.div>
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );
};

export default About;
