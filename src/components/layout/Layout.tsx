import React from 'react';
import Header from './Header';
import Footer from './Footer';
import Home from '../sections/Home';
import About from '../sections/About';
import Education from '../sections/Education';
import Skills from '../sections/Skills';
import Projects from '../sections/Projects';
import Contact from '../sections/Contact';

const Layout: React.FC = () => {
  return (
    <div className="flex flex-col min-h-screen">
      <Header />
      <main className="flex-grow">
        <Home />
        <About />
        <Education />
        <Skills />
        <Projects />
        <Contact />
      </main>
      <Footer />
    </div>
  );
};

export default Layout;