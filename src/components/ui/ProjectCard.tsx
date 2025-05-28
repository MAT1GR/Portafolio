import React from 'react';
import { motion } from 'framer-motion';
import { ExternalLink, Github } from 'lucide-react';
import { Project } from '../../data/projects';

interface ProjectCardProps {
  project: Project;
}

const ProjectCard: React.FC<ProjectCardProps> = ({ project }) => {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ duration: 0.5 }}
      className="overflow-hidden transition-all rounded-xl shadow-lg bg-card hover:shadow-xl hover:scale-[1.02] duration-300 flex flex-col h-full"
    >
      <div className="relative overflow-hidden aspect-video">
        <img 
          src={project.image} 
          alt={project.title} 
          className="object-cover w-full h-full transition-transform duration-300 hover:scale-105"
        />
      </div>
      
      <div className="flex flex-col flex-grow p-8">
        <div className="flex-grow">
          <h3 className="mb-3 text-2xl font-semibold">{project.title}</h3>
          <p className="text-muted-foreground">
            {project.description}
          </p>
        </div>

        <div className="mt-8">
          <div className="flex flex-wrap gap-2 mb-6">
            {project.tags.map((tag) => (
              <span 
                key={tag} 
                className="px-3 py-1 text-sm font-medium rounded-full bg-primary/10 text-primary"
              >
                {tag}
              </span>
            ))}
          </div>
          
          <div className="flex space-x-4">
            {project.demoUrl && (
              <a 
                href={project.demoUrl} 
                target="_blank" 
                rel="noopener noreferrer"
                className="flex items-center px-4 py-2 text-sm font-medium transition-colors rounded-lg bg-primary/10 text-primary hover:bg-primary/20"
              >
                <ExternalLink size={16} className="mr-2" />
                Demo
              </a>
            )}
            
            {project.repoUrl && (
              <a 
                href={project.repoUrl} 
                target="_blank" 
                rel="noopener noreferrer"
                className="flex items-center px-4 py-2 text-sm font-medium transition-colors rounded-lg bg-primary/10 text-primary hover:bg-primary/20"
              >
                <Github size={16} className="mr-2" />
                Código
              </a>
            )}
          </div>
        </div>
      </div>
    </motion.div>
  );
};

export default ProjectCard;