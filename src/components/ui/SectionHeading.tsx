import React from 'react';
import { motion } from 'framer-motion';

interface SectionHeadingProps {
  index: string;
  label: string;
  title: React.ReactNode;
  description?: string;
}

const SectionHeading: React.FC<SectionHeadingProps> = ({ index, label, title, description }) => (
  <motion.div
    initial={{ opacity: 0, y: 24 }}
    whileInView={{ opacity: 1, y: 0 }}
    viewport={{ once: true, margin: '-80px' }}
    transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
    className="mb-14 max-w-2xl"
  >
    <p className="mb-4 flex items-center gap-3 font-mono text-xs uppercase tracking-[0.2em] text-primary">
      <span>{index}</span>
      <span className="h-px w-8 bg-primary" />
      <span>{label}</span>
    </p>
    <h2 className="text-4xl font-bold tracking-tight md:text-5xl">{title}</h2>
    {description && <p className="mt-4 text-lg text-muted-foreground">{description}</p>}
  </motion.div>
);

export default SectionHeading;
