import React from 'react';
import { Code2, Database, Cpu } from 'lucide-react';

export interface Skill {
  name: string;
  icon: string;
  level?: string;
}

export interface SkillCategory {
  title: string;
  icon: () => React.ReactNode;
  skills: Skill[];
}

export const skills: SkillCategory[] = [
  {
    title: "Frontend",
    icon: () => <Code2 className="w-6 h-6 text-primary" />,
    skills: [
      {
        name: "HTML",
        icon: "html",
        level: "Desarrollo web moderno"
      },
      {
        name: "CSS",
        icon: "css",
        level: "Diseño responsive"
      },
      {
        name: "JavaScript",
        icon: "javascript",
        level: "ES6+"
      },
      {
        name: "React",
        icon: "react",
        level: "Desarrollo de UI"
      },
      {
        name: "Bootstrap",
        icon: "bootstrap",
        level: "Framework CSS"
      }
    ]
  },
  {
    title: "Backend / Lenguajes",
    icon: () => <Database className="w-6 h-6 text-primary" />,
    skills: [
      {
        name: "Python",
        icon: "python",
        level: "Automatización y scripts"
      },
      {
        name: "SQL",
        icon: "database",
        level: "Gestión de bases de datos"
      },
      {
        name: "C++",
        icon: "code",
        level: "Programación de sistemas"
      }
    ]
  },
  {
    title: "Otros",
    icon: () => <Cpu className="w-6 h-6 text-primary" />,
    skills: [
      {
        name: "Hardware",
        icon: "cpu",
        level: "Mantenimiento y reparación"
      },
      {
        name: "Soporte Técnico",
        icon: "tool",
        level: "Resolución de problemas"
      },
      {
        name: "Resolución de Problemas",
        icon: "settings",
        level: "Análisis y soluciones"
      }
    ]
  }
];