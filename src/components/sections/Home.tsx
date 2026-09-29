import React, { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { ArrowDown, ArrowRight, Download, Github, Linkedin } from 'lucide-react';
import { profile } from '../../data/profile';
import TechMarquee from '../ui/TechMarquee';

const terminalLines = [
  { prompt: true, text: 'whoami' },
  { prompt: false, text: 'matias · dev full-stack · Rosario' },
  { prompt: true, text: 'cat stack.txt' },
  { prompt: false, text: 'TypeScript · React · Node.js · Python' },
  { prompt: true, text: 'git log --oneline -1' },
  { prompt: false, text: 'feat: sistema de gestión en producción' },
];

const ease = [0.22, 1, 0.36, 1] as const;

function useRotatingWord(words: string[], interval = 2200) {
  const [index, setIndex] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setIndex((i) => (i + 1) % words.length), interval);
    return () => clearInterval(id);
  }, [words.length, interval]);
  return words[index];
}

const Home: React.FC = () => {
  const word = useRotatingWord(profile.focusWords);
  const sectionRef = useRef<HTMLElement>(null);

  const handleMove = (e: React.MouseEvent<HTMLElement>) => {
    const el = sectionRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    el.style.setProperty('--x', `${e.clientX - rect.left}px`);
    el.style.setProperty('--y', `${e.clientY - rect.top}px`);
  };

  return (
    <>
      <section
        id="home"
        ref={sectionRef}
        onMouseMove={handleMove}
        className="relative flex min-h-[92vh] items-center overflow-hidden pt-24 pb-16"
      >
        <div className="grid-bg pointer-events-none absolute inset-0" />
        <div
          className="pointer-events-none absolute inset-0 transition-opacity duration-500"
          style={{
            background:
              'radial-gradient(600px circle at var(--x, 30%) var(--y, 30%), hsl(var(--primary) / 0.14), transparent 60%)',
          }}
        />

        <div className="container relative grid items-center gap-14 lg:grid-cols-[1.2fr_1fr]">
          <div>
            <motion.a
              href="#experience"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, ease }}
              className="inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-3 py-1 text-xs font-medium text-primary transition-colors hover:bg-primary/20"
            >
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary opacity-70" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-primary" />
              </span>
              Trabajando en Laboratorio Consultar
            </motion.a>

            <motion.h1
              initial={{ opacity: 0, y: 24 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.7, delay: 0.05, ease }}
              className="mt-7 text-5xl font-extrabold leading-[1.05] tracking-tight sm:text-6xl lg:text-7xl"
            >
              {profile.name.split(' ')[0]}
              <br />
              <span className="text-muted-foreground/60">{profile.name.split(' ')[1]}</span>
              <span className="text-primary">.</span>
            </motion.h1>

            <motion.div
              initial={{ opacity: 0, y: 24 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.7, delay: 0.15, ease }}
              className="mt-6 flex flex-wrap items-center gap-x-2 text-xl font-medium sm:text-2xl"
            >
              <span>{profile.role}</span>
              <span className="text-muted-foreground">/</span>
              <span className="relative inline-flex h-[1.4em] min-w-[9ch] overflow-hidden">
                <AnimatePresence mode="wait">
                  <motion.span
                    key={word}
                    initial={{ y: '100%', opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    exit={{ y: '-100%', opacity: 0 }}
                    transition={{ duration: 0.35, ease }}
                    className="font-semibold text-primary"
                  >
                    {word}
                  </motion.span>
                </AnimatePresence>
              </span>
            </motion.div>

            <motion.p
              initial={{ opacity: 0, y: 24 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.7, delay: 0.25, ease }}
              className="mt-5 max-w-md text-lg text-muted-foreground"
            >
              {profile.tagline}
            </motion.p>

            <motion.div
              initial={{ opacity: 0, y: 24 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.7, delay: 0.35, ease }}
              className="mt-9 flex flex-wrap items-center gap-3"
            >
              <a href="#projects" className="button button-primary">
                Ver proyectos <ArrowRight size={16} />
              </a>
              {profile.cvUrl && (
                <a href={profile.cvUrl} download className="button button-ghost">
                  <Download size={16} /> CV
                </a>
              )}
              <a href={profile.github} target="_blank" rel="noopener noreferrer" className="button button-ghost !px-3" aria-label="GitHub">
                <Github size={18} />
              </a>
              <a href={profile.linkedin} target="_blank" rel="noopener noreferrer" className="button button-ghost !px-3" aria-label="LinkedIn">
                <Linkedin size={18} />
              </a>
            </motion.div>
          </div>

          <motion.div
            initial={{ opacity: 0, y: 30, rotate: 1.5 }}
            animate={{ opacity: 1, y: 0, rotate: 0 }}
            transition={{ duration: 0.8, delay: 0.3, ease }}
            whileHover={{ y: -6 }}
            className="surface overflow-hidden shadow-[0_30px_80px_-40px_hsl(var(--primary)/0.45)]"
          >
            <div className="flex items-center gap-2 border-b border-border px-4 py-3">
              <span className="h-3 w-3 rounded-full bg-red-400/80" />
              <span className="h-3 w-3 rounded-full bg-yellow-400/80" />
              <span className="h-3 w-3 rounded-full bg-green-400/80" />
              <span className="ml-3 font-mono text-xs text-muted-foreground">~/matias — zsh</span>
            </div>
            <div className="space-y-1.5 p-5 font-mono text-[13px] leading-6">
              {terminalLines.map((line, i) => (
                <motion.p
                  key={i}
                  initial={{ opacity: 0, x: -6 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.8 + i * 0.35, duration: 0.3 }}
                  className={line.prompt ? '' : 'text-muted-foreground'}
                >
                  {line.prompt && <span className="mr-2 text-primary">❯</span>}
                  {line.text}
                </motion.p>
              ))}
              <motion.p
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.8 + terminalLines.length * 0.35 }}
              >
                <span className="mr-2 text-primary">❯</span>
                <span className="inline-block h-4 w-2 translate-y-0.5 animate-blink bg-primary" />
              </motion.p>
            </div>
          </motion.div>
        </div>

        <motion.a
          href="#about"
          aria-label="Bajar"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1, y: [0, 8, 0] }}
          transition={{ opacity: { delay: 1.5 }, y: { repeat: Infinity, duration: 2, ease: 'easeInOut' } }}
          className="absolute bottom-6 left-1/2 hidden -translate-x-1/2 text-muted-foreground transition-colors hover:text-primary md:block"
        >
          <ArrowDown size={20} />
        </motion.a>
      </section>

      <TechMarquee />
    </>
  );
};

export default Home;
