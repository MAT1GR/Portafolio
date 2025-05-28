import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { projects, allTags } from '../../data/projects';
import ProjectCard from '../ui/ProjectCard';

const Projects: React.FC = () => {
  const [selectedTag, setSelectedTag] = useState<string | null>(null);
  
  const filteredProjects = selectedTag
    ? projects.filter(project => project.tags.includes(selectedTag))
    : projects;

  const filteredTags = allTags.filter(tag => !['DIY', 'Machine Learning', 'Procesamiento de Datos', 'Seguridad', 'Web'].includes(tag));

  return (
    <section id="projects" className="bg-muted section-padding">
      <div className="container">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
        >
          <h2 className="section-title text-center">Proyectos</h2>
        </motion.div>
        
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5, delay: 0.2 }}
          className="flex flex-wrap justify-center gap-2 mb-8"
        >
          
          
        </motion.div>
        
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
          {filteredProjects.map((project) => (
            <ProjectCard key={project.id} project={project} />
          ))}
        </div>
        
        {filteredProjects.length === 0 && (
          <p className="py-8 text-center text-muted-foreground">
            No hay proyectos que coincidan con este filtro.
          </p>
        )}
      </div>
    </section>
  );
};

export default Projects;