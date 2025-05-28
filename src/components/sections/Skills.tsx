import React from 'react';
import { motion } from 'framer-motion';
import { skills } from '../../data/skills';
import SkillCard from '../ui/SkillCard';

const Skills: React.FC = () => {
  return (
    <section id="skills" className="section-padding bg-gradient-to-b from-background to-muted/50">
      <div className="container max-w-6xl">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
        >
          <h2 className="section-title">Habilidades</h2>
        </motion.div>
        
        <div className="space-y-20">
          {skills.map((category, index) => (
            <motion.div 
              key={category.title}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: index * 0.1 }}
              className="relative"
            >
              <div className="flex items-center mb-10">
                <div className="flex items-center space-x-4">
                  {category.icon}
                  <h3 className="text-2xl font-semibold bg-gradient-to-r from-primary to-primary/70 bg-clip-text text-transparent">
                    {category.title}
                  </h3>
                </div>
                <div className="flex-grow h-px ml-6 bg-gradient-to-r from-primary/20 to-transparent"></div>
              </div>
              <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
                {category.skills.map((skill, skillIndex) => (
                  <motion.div
                    key={skill.name}
                    initial={{ opacity: 0, y: 20 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    transition={{ duration: 0.3, delay: skillIndex * 0.1 }}
                  >
                    <SkillCard skill={skill} />
                  </motion.div>
                ))}
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default Skills;