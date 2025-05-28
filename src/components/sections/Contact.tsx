import React from 'react';
import { motion } from 'framer-motion';
import { Github, Linkedin, Mail } from 'lucide-react';

const Contact: React.FC = () => {
  return (
    <section id="contact" className="section-padding">
      <div className="container max-w-6xl">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
        >
          <h2 className="section-title text-center">Contacto</h2>
        </motion.div>
        
        <motion.div
          initial={{ opacity: 0, x: -20 }}
          whileInView={{ opacity: 1, x: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5, delay: 0.2 }}
          className="max-w-md mx-auto"
        >
          <p className="mb-8 text-lg text-muted-foreground text-center">
            Estoy interesado en oportunidades profesionales, especialmente proyectos ambiciosos o
            innovadores. Si tienes alguna pregunta, no dudes en contactarme.
          </p>
          
          <div className="space-y-6">
            <a 
              href="mailto:grigomati@gmail.com" 
              className="flex items-center justify-center group"
            >
              <div className="flex items-center justify-center w-12 h-12 mr-4 transition-colors rounded-xl bg-primary/10 group-hover:bg-primary/20">
                <Mail className="text-primary" size={24} />
              </div>
              <span className="text-lg group-hover:text-primary transition-colors">
                grigomati@gmail.com
              </span>
            </a>
            
            <a 
              href="https://github.com/MAT1GR" 
              target="_blank" 
              rel="noopener noreferrer"
              className="flex items-center justify-center group"
            >
              <div className="flex items-center justify-center w-12 h-12 mr-4 transition-colors rounded-xl bg-primary/10 group-hover:bg-primary/20">
                <Github className="text-primary" size={24} />
              </div>
              <span className="text-lg group-hover:text-primary transition-colors">
                github.com/MAT1GR
              </span>
            </a>
            
            <a 
              href="https://www.linkedin.com/in/matiasgrigolo/" 
              target="_blank" 
              rel="noopener noreferrer"
              className="flex items-center justify-center group"
            >
              <div className="flex items-center justify-center w-12 h-12 mr-4 transition-colors rounded-xl bg-primary/10 group-hover:bg-primary/20">
                <Linkedin className="text-primary" size={24} />
              </div>
              <span className="text-lg group-hover:text-primary transition-colors">
                linkedin.com/in/matiasgrigolo
              </span>
            </a>
          </div>
        </motion.div>
      </div>
    </section>
  );
};

export default Contact;