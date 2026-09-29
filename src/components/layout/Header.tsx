import React, { useEffect, useState } from 'react';
import { AnimatePresence, motion, useScroll, useSpring } from 'framer-motion';
import { Menu, Moon, Sun, X } from 'lucide-react';
import { useTheme } from '../../context/ThemeContext';

const navigationItems = [
  { name: 'Sobre mí', id: 'about' },
  { name: 'Stack', id: 'skills' },
  { name: 'Experiencia', id: 'experience' },
  { name: 'Proyectos', id: 'projects' },
];

function useActiveSection(ids: string[]) {
  const [active, setActive] = useState<string | null>(null);
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) setActive(entry.target.id);
        });
      },
      { rootMargin: '-45% 0px -50% 0px' }
    );
    ['home', ...ids, 'contact'].forEach((id) => {
      const el = document.getElementById(id);
      if (el) observer.observe(el);
    });
    return () => observer.disconnect();
  }, [ids]);
  return active;
}

const sectionIds = navigationItems.map((item) => item.id);

const Header: React.FC = () => {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isScrolled, setIsScrolled] = useState(false);
  const { theme, toggleTheme } = useTheme();
  const active = useActiveSection(sectionIds);
  const { scrollYProgress } = useScroll();
  const progress = useSpring(scrollYProgress, { stiffness: 200, damping: 30 });

  useEffect(() => {
    const handleScroll = () => setIsScrolled(window.scrollY > 20);
    handleScroll();
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const iconButton = 'p-2 rounded-full text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors';
  const themeLabel = theme === 'dark' ? 'Cambiar a modo claro' : 'Cambiar a modo oscuro';

  const ThemeIcon = (
    <AnimatePresence mode="wait" initial={false}>
      <motion.span
        key={theme}
        initial={{ rotate: -90, opacity: 0 }}
        animate={{ rotate: 0, opacity: 1 }}
        exit={{ rotate: 90, opacity: 0 }}
        transition={{ duration: 0.2 }}
        className="inline-flex"
      >
        {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
      </motion.span>
    </AnimatePresence>
  );

  return (
    <header
      className={`fixed top-0 z-50 w-full transition-all duration-300 ${
        isScrolled || isMenuOpen ? 'border-b border-border bg-background/75 backdrop-blur-xl' : 'border-b border-transparent'
      }`}
    >
      <motion.div style={{ scaleX: progress }} className="absolute bottom-[-1px] left-0 right-0 h-0.5 origin-left bg-primary" />

      <div className="container flex h-16 items-center justify-between">
        <a href="#home" className="group flex items-center gap-2 font-bold tracking-tight">
          <img
            src="/img/about.jpg"
            alt=""
            className="h-9 w-9 rounded-full object-cover ring-2 ring-primary transition-transform duration-300 group-hover:scale-110 group-hover:rotate-[-6deg]"
          />
          <span className="hidden sm:inline">Matías Grigolo</span>
        </a>

        <nav className="hidden items-center gap-1 md:flex">
          {navigationItems.map((item) => (
            <a
              key={item.id}
              href={`#${item.id}`}
              className={`relative rounded-full px-4 py-2 text-sm font-medium transition-colors ${
                active === item.id ? 'text-foreground' : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              {active === item.id && (
                <motion.span
                  layoutId="nav-active"
                  className="absolute inset-0 rounded-full bg-secondary"
                  transition={{ type: 'spring', stiffness: 400, damping: 35 }}
                />
              )}
              <span className="relative">{item.name}</span>
            </a>
          ))}
          <button onClick={toggleTheme} className={`${iconButton} ml-1`} aria-label={themeLabel}>
            {ThemeIcon}
          </button>
          <a href="#contact" className="button button-primary ml-2 !py-2">
            Contacto
          </a>
        </nav>

        <div className="flex items-center gap-1 md:hidden">
          <button onClick={toggleTheme} className={iconButton} aria-label={themeLabel}>
            {ThemeIcon}
          </button>
          <button
            onClick={() => setIsMenuOpen((open) => !open)}
            className={iconButton}
            aria-label="Abrir menú"
            aria-expanded={isMenuOpen}
          >
            {isMenuOpen ? <X size={20} /> : <Menu size={20} />}
          </button>
        </div>
      </div>

      <AnimatePresence>
        {isMenuOpen && (
          <motion.nav
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="container overflow-hidden md:hidden"
          >
            <ul className="flex flex-col pb-4">
              {[...navigationItems, { name: 'Contacto', id: 'contact' }].map((item) => (
                <li key={item.id}>
                  <a
                    href={`#${item.id}`}
                    className={`block py-3 text-lg font-medium transition-colors ${
                      active === item.id ? 'text-primary' : 'text-muted-foreground hover:text-foreground'
                    }`}
                    onClick={() => setIsMenuOpen(false)}
                  >
                    {item.name}
                  </a>
                </li>
              ))}
            </ul>
          </motion.nav>
        )}
      </AnimatePresence>
    </header>
  );
};

export default Header;
