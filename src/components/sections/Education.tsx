import React from 'react';
import { motion } from 'framer-motion';
import { GraduationCap, Briefcase } from 'lucide-react';

const Education: React.FC = () => {
  return (
    <section id="education" className="section-padding bg-gradient-to-b from-muted to-background">
      <div className="container max-w-6xl">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
          className="text-center mb-16"
        >
          <h2 className="text-4xl md:text-5xl font-bold bg-gradient-to-r from-primary to-primary/70 bg-clip-text text-transparent mb-6">
            Educación y Experiencia
          </h2>
          <div className="w-24 h-1 mx-auto bg-gradient-to-r from-primary to-transparent rounded-full"></div>
        </motion.div>

        <div className="grid gap-12 md:grid-cols-2">
          {/* Educación */}
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5, delay: 0.2 }}
          >
            <div className="flex items-center space-x-4 mb-8">
              <div className="flex items-center justify-center w-12 h-12 rounded-xl bg-primary/10">
                <GraduationCap className="w-6 h-6 text-primary" />
              </div>
              <h3 className="text-2xl font-semibold bg-gradient-to-r from-primary to-primary/70 bg-clip-text text-transparent">
                Educación
              </h3>
            </div>

            <div className="h-full">
              <div className="p-6 rounded-xl bg-card/50 backdrop-blur-sm border border-border/50 transition-all duration-300 hover:border-primary/20 hover:shadow-lg group h-full">
                <h4 className="text-lg font-semibold group-hover:text-primary transition-colors">
                  Técnico en Informática Profesional y Personal
                </h4>
                <p className="text-muted-foreground mt-2">Casa Salesiana San José</p>
                <p className="text-sm text-muted-foreground mt-1">2019 - 2025</p>
                <ul className="mt-4 space-y-2 text-sm text-muted-foreground list-disc list-inside">
                  <li>Formación técnica en desarrollo de software</li>
                  <li>Especialización en mantenimiento de hardware</li>
                  <li>Proyectos prácticos y trabajo en equipo</li>
                </ul>
              </div>
            </div>
          </motion.div>

          {/* Experiencia */}
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5, delay: 0.2 }}
          >
            <div className="flex items-center space-x-4 mb-8">
              <div className="flex items-center justify-center w-12 h-12 rounded-xl bg-primary/10">
                <Briefcase className="w-6 h-6 text-primary" />
              </div>
              <h3 className="text-2xl font-semibold bg-gradient-to-r from-primary to-primary/70 bg-clip-text text-transparent">
                Experiencia
              </h3>
            </div>

            <div className="h-full">
              <div className="p-6 rounded-xl bg-card/50 backdrop-blur-sm border border-border/50 transition-all duration-300 hover:border-primary/20 hover:shadow-lg group h-full">
                <h4 className="text-lg font-semibold group-hover:text-primary transition-colors">
                  Desarrollador
                </h4>
                <p className="text-muted-foreground mt-2">Laboratorio Consultar</p>
                <p className="text-sm text-muted-foreground mt-1">2025 - Presente</p>
                <ul className="mt-4 space-y-2 text-sm text-muted-foreground list-disc list-inside">
                  <li>Desarrollo de un chatbot para atención al cliente.</li>
                  <li>Creación de scripts en Python para procesar y filtrar información.</li>
                  <li>Optimización de procesos internos</li>
                </ul>
              </div>
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  );
};

export default Education;