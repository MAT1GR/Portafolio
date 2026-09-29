import React, { useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { ArrowUpRight, Github } from 'lucide-react';
import { featuredProjects, otherProjects, ProjectContext } from '../../data/projects';
import { profile } from '../../data/profile';
import ProjectCard from '../ui/ProjectCard';
import SectionHeading from '../ui/SectionHeading';

type Filter = 'Todos' | ProjectContext;
const filters: Filter[] = ['Todos', 'Profesional', 'Cliente', 'Personal'];

const Projects: React.FC = () => {
  const [filter, setFilter] = useState<Filter>('Todos');
  const visible = filter === 'Todos' ? featuredProjects : featuredProjects.filter((p) => p.context === filter);

  return (
    <section id="projects" className="section-padding border-t border-border">
      <div className="container">
        <SectionHeading
          index="04"
          label="Proyectos"
          title={
            <>
              Software <span className="text-primary">en uso real</span>.
            </>
          }
        />

        <div className="mb-8 inline-flex flex-wrap gap-1 rounded-full border border-border bg-card p-1">
          {filters.map((f) => {
            const count = f === 'Todos' ? featuredProjects.length : featuredProjects.filter((p) => p.context === f).length;
            return (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`relative rounded-full px-4 py-1.5 text-sm font-medium transition-colors ${
                  filter === f ? 'text-primary-foreground' : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                {filter === f && (
                  <motion.span
                    layoutId="project-filter"
                    className="absolute inset-0 rounded-full bg-primary"
                    transition={{ type: 'spring', stiffness: 400, damping: 35 }}
                  />
                )}
                <span className="relative">
                  {f} <span className="opacity-60">{count}</span>
                </span>
              </button>
            );
          })}
        </div>

        <motion.div layout className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
          <AnimatePresence mode="popLayout">
            {visible.map((project, i) => (
              <motion.div
                key={project.slug}
                layout
                initial={{ opacity: 0, y: 24, scale: 0.97 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                transition={{ duration: 0.35, delay: i * 0.05 }}
              >
                <ProjectCard project={project} />
              </motion.div>
            ))}
          </AnimatePresence>
        </motion.div>

        <div className="mt-20">
          <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
            <h3 className="text-xl font-bold tracking-tight">Otros proyectos</h3>
            <a href={profile.github} target="_blank" rel="noopener noreferrer" className="button button-ghost">
              <Github size={16} /> Todo en GitHub
            </a>
          </div>

          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {otherProjects.map((project, i) => (
              <motion.a
                key={project.title}
                href={project.url}
                target="_blank"
                rel="noopener noreferrer"
                initial={{ opacity: 0, y: 16 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.4, delay: i * 0.04 }}
                className="group surface flex flex-col p-5 transition-all duration-300 hover:-translate-y-1 hover:border-primary/60"
              >
                <div className="flex items-start justify-between gap-2">
                  <p className="font-semibold transition-colors group-hover:text-primary">{project.title}</p>
                  <ArrowUpRight
                    size={16}
                    className="shrink-0 text-muted-foreground transition-all group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:text-primary"
                  />
                </div>
                <p className="mt-1 text-sm text-muted-foreground">{project.description}</p>
                <p className="mt-auto pt-4 font-mono text-xs text-muted-foreground">{project.stack.join(' · ')}</p>
              </motion.a>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
};

export default Projects;
