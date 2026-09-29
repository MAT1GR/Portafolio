import React, { useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { ArrowUpRight, Check, Copy, Download, Github, Linkedin, Mail } from 'lucide-react';
import { profile } from '../../data/profile';

const Contact: React.FC = () => {
  const [copied, setCopied] = useState(false);

  const copyEmail = async () => {
    try {
      await navigator.clipboard.writeText(profile.email);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      window.location.href = `mailto:${profile.email}`;
    }
  };

  return (
    <section id="contact" className="section-padding border-t border-border">
      <div className="container">
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="relative overflow-hidden rounded-3xl bg-primary px-6 py-16 text-center text-primary-foreground md:px-12 md:py-24"
        >
          <div className="pointer-events-none absolute inset-0 opacity-[0.12] [background-image:radial-gradient(currentColor_1px,transparent_1px)] [background-size:22px_22px]" />

          <div className="relative">
            <p className="font-mono text-xs uppercase tracking-[0.2em] opacity-70">05 — Contacto</p>
            <h2 className="mx-auto mt-5 max-w-2xl text-4xl font-extrabold tracking-tight md:text-6xl">
              Construyamos algo juntos.
            </h2>

            <div className="mt-10 flex flex-col items-center justify-center gap-3 sm:flex-row">
              <a
                href={`mailto:${profile.email}`}
                className="button bg-primary-foreground text-primary hover:-translate-y-0.5 hover:shadow-xl"
              >
                <Mail size={16} /> Escribime
              </a>
              <button
                onClick={copyEmail}
                className="button border border-primary-foreground/30 hover:bg-primary-foreground/10"
                aria-live="polite"
              >
                <AnimatePresence mode="wait" initial={false}>
                  <motion.span
                    key={copied ? 'ok' : 'copy'}
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -6 }}
                    transition={{ duration: 0.15 }}
                    className="inline-flex items-center gap-2"
                  >
                    {copied ? <Check size={16} /> : <Copy size={16} />}
                    {copied ? '¡Copiado!' : profile.email}
                  </motion.span>
                </AnimatePresence>
              </button>
            </div>

            <div className="mt-8 flex items-center justify-center gap-6 text-sm font-medium">
              <a href={profile.github} target="_blank" rel="noopener noreferrer" className="group inline-flex items-center gap-1.5 opacity-80 hover:opacity-100">
                <Github size={16} /> GitHub
                <ArrowUpRight size={14} className="transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
              </a>
              <a href={profile.linkedin} target="_blank" rel="noopener noreferrer" className="group inline-flex items-center gap-1.5 opacity-80 hover:opacity-100">
                <Linkedin size={16} /> LinkedIn
                <ArrowUpRight size={14} className="transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
              </a>
              {profile.cvUrl && (
                <a href={profile.cvUrl} download className="inline-flex items-center gap-1.5 opacity-80 hover:opacity-100">
                  <Download size={16} /> CV
                </a>
              )}
            </div>
          </div>
        </motion.div>
      </div>
    </section>
  );
};

export default Contact;
