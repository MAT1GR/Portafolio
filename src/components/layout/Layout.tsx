import React from 'react';
import Header from './Header';
import Footer from './Footer';
import Home from '../sections/Home';
import About from '../sections/About';
import Skills from '../sections/Skills';
import Experience from '../sections/Experience';
import Projects from '../sections/Projects';
import Testimonials from '../sections/Testimonials';
import Contact from '../sections/Contact';

const Layout: React.FC = () => {
  return (
    <div className="flex min-h-screen flex-col">
      <Header />
      <main className="flex-grow">
        <Home />
        <About />
        <Skills />
        <Experience />
        <Projects />
        <Testimonials />
        <Contact />
      </main>
      <Footer />
    </div>
  );
};

export default Layout;
