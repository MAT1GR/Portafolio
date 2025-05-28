import React from 'react';
import { motion } from 'framer-motion';
import { Code, Brain, Laptop } from 'lucide-react';

const About: React.FC = () => {
  return (
    <section id="about" className="bg-muted section-padding">
      <div className="container max-w-6xl">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
          className="text-center mb-16"
        >
          <h2 className="text-4xl md:text-5xl font-bold bg-gradient-to-r from-primary to-primary/70 bg-clip-text text-transparent mb-6">
            Sobre mí
          </h2>
          <div className="w-24 h-1 mx-auto bg-gradient-to-r from-primary to-transparent rounded-full"></div>
        </motion.div>
        
        <div className="grid grid-cols-1 gap-12 md:grid-cols-2">
          <motion.div 
            className="flex justify-center"
            initial={{ opacity: 0, x: -20 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5, delay: 0.2 }}
          >
            <div className="overflow-hidden rounded-2xl shadow-lg aspect-square bg-secondary max-w-md w-full">
              <img 
                src="src/img/about.jpg" 
                alt="Matías Grigolo" 
                className="object-cover w-full h-full"
              />
            </div>
          </motion.div>
          
          <motion.div 
            initial={{ opacity: 0, x: 20 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5, delay: 0.2 }}
          >
            <p className="mb-6 text-lg">
              Soy un desarrollador web y técnico en informática con experiencia en soluciones digitales. 
              Me formé académicamente en Casa Salesiana San José, donde adquirí una sólida base técnica.
            </p>
            
            <p className="mb-6 text-lg">
              Actualmente trabajo en Laboratorio Consultar, donde aplico mis conocimientos técnicos para mejorar
              procesos y desarrollar soluciones innovadoras.
            </p>
            
            <p className="mb-8 text-lg">
              Me apasiona la tecnología y estoy constantemente aprendiendo para mantenerme actualizado con las últimas tendencias 
              y herramientas del desarrollo.
            </p>
            
            <h3 className="mb-6 text-2xl font-semibold text-primary">Áreas de interés</h3>
            
            <div className="flex flex-wrap gap-4">
              <div className="flex items-center px-4 py-3 rounded-xl bg-background/50 backdrop-blur-sm border border-border/50 transition-all duration-300 hover:border-primary/20 hover:shadow-lg group">
                <Code className="shrink-0 mr-3 text-primary transition-transform duration-300 group-hover:scale-110" size={24} />
                <span className="font-medium whitespace-nowrap">Desarrollo</span>
              </div>
              
              <div className="flex items-center px-4 py-3 rounded-xl bg-background/50 backdrop-blur-sm border border-border/50 transition-all duration-300 hover:border-primary/20 hover:shadow-lg group">
                <Laptop className="shrink-0 mr-3 text-primary transition-transform duration-300 group-hover:scale-110" size={24} />
                <span className="font-medium whitespace-nowrap">Infraestructura</span>
              </div>
              
              <div className="flex items-center px-4 py-3 rounded-xl bg-background/50 backdrop-blur-sm border border-border/50 transition-all duration-300 hover:border-primary/20 hover:shadow-lg group">
                <Brain className="shrink-0 mr-3 text-primary transition-transform duration-300 group-hover:scale-110" size={24} />
                <span className="font-medium whitespace-nowrap">IA</span>
              </div>
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  );
};

export default About;