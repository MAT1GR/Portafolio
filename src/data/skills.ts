import type { LucideIcon } from 'lucide-react';
import { Bot, Cpu, Database, Layout, Smartphone, Wrench } from 'lucide-react';

export interface SkillGroup {
  title: string;
  icon: LucideIcon;
  items: string[];
}

export const skillGroups: SkillGroup[] = [
  {
    title: 'Frontend',
    icon: Layout,
    items: ['TypeScript', 'JavaScript', 'React', 'TanStack Start', 'Tailwind CSS', 'HTML', 'CSS'],
  },
  {
    title: 'Backend & Datos',
    icon: Database,
    items: ['Node.js', 'Express', 'REST APIs', 'Prisma', 'SQL', 'SQLite', 'Supabase', 'Firebase', 'JWT', 'Zod'],
  },
  {
    title: 'IA & Automatización',
    icon: Bot,
    items: ['Chatbots', 'Integración de LLMs', 'Python', 'Procesamiento de datos', 'Desarrollo asistido por IA'],
  },
  {
    title: 'Mobile & Desktop',
    icon: Smartphone,
    items: ['Flutter', 'Dart', 'Tauri'],
  },
  {
    title: 'Herramientas',
    icon: Wrench,
    items: ['Git', 'GitHub', 'Vite', 'Vercel', 'Mercado Pago API'],
  },
  {
    title: 'Sistemas & Hardware',
    icon: Cpu,
    items: ['C++', 'Arduino', 'Hardware', 'Redes', 'Soporte técnico'],
  },
];
