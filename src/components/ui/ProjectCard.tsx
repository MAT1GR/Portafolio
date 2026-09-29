import React, { useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Github, Plus } from 'lucide-react';
import { FeaturedProject } from '../../data/projects';
import SpotlightCard from './SpotlightCard';

interface ProjectCardProps {
  project: FeaturedProject;
}

const ProjectCard: React.FC<ProjectCardProps> = ({ project }) => {
  const [open, setOpen] = useState(false);
  const Icon = project.icon;

  return (
    <SpotlightCard className="flex h-full flex-col">
      <div className="flex h-full flex-col p-6 md:p-7">
        <div className="flex items-start justify-between gap-4">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10 text-primary transition-all duration-300 group-hover:rotate-[-6deg] group-hover:scale-110 group-hover:bg-primary group-hover:text-primary-foreground">
            <Icon size={22} />
          </div>
          <span className="font-mono text-[11px] uppercase tracking-widest text-muted-foreground">
            {project.context}
          </span>
        </div>

        <p className="mt-6 font-mono text-xs text-primary">{project.kind}</p>
        <h3 className="mt-1 text-2xl font-bold tracking-tight">{project.title}</h3>
        <p className="mt-2 text-muted-foreground">{project.description}</p>

        <AnimatePresence initial={false}>
          {open && (
            <motion.ul
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
              className="overflow-hidden"
            >
              <div className="mt-4 space-y-2 border-l-2 border-primary pl-4">
                {project.highlights.map((item) => (
                  <li key={item} className="text-sm">
                    {item}
                  </li>
                ))}
              </div>
            </motion.ul>
          )}
        </AnimatePresence>

        <div className="mt-5 flex flex-wrap gap-1.5">
          {project.stack.map((tech) => (
            <span key={tech} className="chip">
              {tech}
            </span>
          ))}
        </div>

        <div className="mt-auto flex items-center justify-between gap-3 pt-6">
          <button
            onClick={() => setOpen((o) => !o)}
            aria-expanded={open}
            className="inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground transition-colors hover:text-primary"
          >
            <motion.span animate={{ rotate: open ? 45 : 0 }} className="inline-flex">
              <Plus size={16} />
            </motion.span>
            {open ? 'Menos' : 'Qué incluye'}
          </button>

          {project.repoUrl && (
            <a
              href={project.repoUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground transition-colors hover:text-primary"
            >
              <Github size={16} /> Código
            </a>
          )}
        </div>
      </div>
    </SpotlightCard>
  );
};

export default ProjectCard;
