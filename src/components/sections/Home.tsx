import React from 'react';
import { motion } from 'framer-motion';
import { ChevronDown } from 'lucide-react';

const Home: React.FC = () => {
  return (
    <section 
      id="home" 
      className="relative flex items-center justify-center min-h-screen pt-16 overflow-hidden"
    >
      <div className="container flex flex-col items-center justify-center text-center">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="w-full"
        >
          <h1 className="text-4xl font-bold tracking-tight sm:text-5xl md:text-6xl lg:text-7xl">
            <span className="block">Hola, soy</span>
            <span className="block mt-2 text-primary">Matías Grigolo</span>
          </h1>
        </motion.div>
        
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.2 }}
          className="w-full max-w-2xl mx-auto"
        >
          <p className="mt-6 text-xl font-medium text-muted-foreground">
            Desarrollador / Técnico en Informática
          </p>
          
          <p className="mt-4 text-lg text-muted-foreground">
            Me interesa desarrollar tecnologías que resuelvan problemas reales de forma simple y clara.
          </p>
        </motion.div>
        
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.4 }}
          className="mt-10"
        >
          <a 
            href="#projects" 
            className="button button-primary"
          >
            Ver proyectos
          </a>
        </motion.div>
      </div>
      
      <div className="absolute bottom-8 left-0 right-0 flex justify-center">
        <motion.a
          href="#about"
          className="flex flex-col items-center text-muted-foreground hover:text-primary transition-colors"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ 
            duration: 0.5, 
            delay: 0.6,
            repeat: Infinity,
            repeatType: "reverse",
            repeatDelay: 0.2
          }}
        >
          <span className="mb-2 text-sm font-medium">Descubrir más</span>
          <ChevronDown size={24} />
        </motion.a>
      </div>
    </section>
  );
};

export default Home;