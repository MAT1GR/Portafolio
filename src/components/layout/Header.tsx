import React, { useState, useEffect } from 'react';
import { Menu, X, Moon, Sun } from 'lucide-react';
import { useTheme } from '../../context/ThemeContext';

const Header: React.FC = () => {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isScrolled, setIsScrolled] = useState(false);
  const { theme, toggleTheme } = useTheme();

  const toggleMenu = () => setIsMenuOpen(!isMenuOpen);
  const closeMenu = () => setIsMenuOpen(false);

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 50);
    };

    window.addEventListener('scroll', handleScroll);
    return () => {
      window.removeEventListener('scroll', handleScroll);
    };
  }, []);

  const navigationItems = [
    { name: 'Inicio', href: '#home' },
    { name: 'Sobre mí', href: '#about' },
    { name: 'Educación', href: '#education' },
    { name: 'Habilidades', href: '#skills' },
    { name: 'Proyectos', href: '#projects' },
    { name: 'Contacto', href: '#contact' }
  ];

  return (
    <header 
      className={`fixed w-full top-0 z-50 transition-all duration-300 ${
        isScrolled 
          ? 'bg-background/90 backdrop-blur-sm shadow-md' 
          : 'bg-transparent'
      }`}
    >
      <div className="container flex items-center justify-between h-16 md:h-20">
        <a 
          href="#home" 
          className="text-xl font-bold transition-colors hover:text-primary"
        >
          Matías Grigolo
        </a>

        {/* Desktop Navigation */}
        <nav className="hidden md:block">
          <ul className="flex items-center space-x-8">
            {navigationItems.map((item) => (
              <li key={item.name}>
                <a 
                  href={item.href}
                  className="font-medium transition-colors hover:text-primary"
                >
                  {item.name}
                </a>
              </li>
            ))}
            <li>
              <button
                onClick={toggleTheme}
                className="p-2 rounded-full hover:bg-muted transition-colors"
                aria-label={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
              >
                {theme === 'dark' ? (
                  <Sun size={20} className="text-foreground" />
                ) : (
                  <Moon size={20} className="text-foreground" />
                )}
              </button>
            </li>
          </ul>
        </nav>

        {/* Mobile Menu Button */}
        <div className="flex items-center md:hidden">
          <button
            onClick={toggleTheme}
            className="p-2 mr-2 rounded-full hover:bg-muted transition-colors"
            aria-label={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
          >
            {theme === 'dark' ? (
              <Sun size={20} className="text-foreground" />
            ) : (
              <Moon size={20} className="text-foreground" />
            )}
          </button>
          <button
            onClick={toggleMenu}
            className="p-2 rounded-md hover:bg-muted transition-colors"
            aria-label="Toggle menu"
          >
            {isMenuOpen ? (
              <X size={24} className="text-foreground" />
            ) : (
              <Menu size={24} className="text-foreground" />
            )}
          </button>
        </div>

        {/* Mobile Navigation */}
        {isMenuOpen && (
          <div className="absolute top-16 left-0 right-0 bg-background/95 backdrop-blur-sm shadow-lg md:hidden">
            <nav className="container py-4">
              <ul className="flex flex-col space-y-4">
                {navigationItems.map((item) => (
                  <li key={item.name}>
                    <a 
                      href={item.href}
                      className="block py-2 font-medium transition-colors hover:text-primary"
                      onClick={closeMenu}
                    >
                      {item.name}
                    </a>
                  </li>
                ))}
              </ul>
            </nav>
          </div>
        )}
      </div>
    </header>
  );
};

export default Header;