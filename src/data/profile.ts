import type { LucideIcon } from 'lucide-react';
import { AppWindow, Bot, Server, Smartphone } from 'lucide-react';

export const profile = {
  name: 'Matías Grigolo',
  role: 'Desarrollador de Software',
  focusWords: ['Web', 'Full-stack', 'Automatización', 'IA aplicada'],
  location: 'Rosario, Argentina',
  tagline: 'Construyo aplicaciones web y herramientas que usan empresas reales, todos los días.',
  email: 'grigomati@gmail.com',
  github: 'https://github.com/MAT1GR',
  linkedin: 'https://www.linkedin.com/in/matiasgrigolo/',
  // Poné tu CV en /public (ej. public/Matias-Grigolo-CV.pdf) y reemplazá null por '/Matias-Grigolo-CV.pdf'.
  cvUrl: null as string | null,
};

export const about =
  'Desarrollador y Técnico en Informática. Me ocupo del producto completo: interfaz, API, base de datos y deploy. Hoy desarrollo el sistema interno de Laboratorio Consultar y soluciones a medida para comercios.';

export const stats = [
  { value: 20, suffix: '+', label: 'repositorios públicos' },
  { value: 6, suffix: '', label: 'sistemas full-stack' },
  { value: 3, suffix: '', label: 'plataformas: web, mobile, desktop' },
];

export const currently = 'Integrando LLMs en aplicaciones y profundizando en arquitectura full-stack.';

export interface Service {
  title: string;
  description: string;
  icon: LucideIcon;
}

export const services: Service[] = [
  { title: 'Aplicaciones web', description: 'E-commerce, reservas y paneles de gestión.', icon: AppWindow },
  { title: 'Backend & APIs', description: 'Node.js, bases SQL, auth y pagos.', icon: Server },
  { title: 'Automatización & IA', description: 'Chatbots y scripts que eliminan tareas manuales.', icon: Bot },
  { title: 'Mobile & Desktop', description: 'Apps con Flutter y Tauri.', icon: Smartphone },
];

export interface Experience {
  role: string;
  company: string;
  period: string;
  highlights: string[];
  stack: string[];
}

export const experience: Experience[] = [
  {
    role: 'Desarrollador de Software',
    company: 'Laboratorio Consultar',
    period: '2025 — Hoy',
    highlights: [
      'Sistema de gestión interno (web + escritorio con Tauri)',
      'Chatbot de atención al cliente',
      'Automatizaciones de datos en Python',
    ],
    stack: ['TypeScript', 'React', 'Node.js', 'SQLite', 'Tauri', 'Python'],
  },
  {
    role: 'Desarrollador Freelance',
    company: 'Clientes en Rosario',
    period: '2025 — Hoy',
    highlights: [
      'E-commerce con Mercado Pago y panel admin',
      'Sistema de reservas online',
      'Gestión de clientes y cuentas corrientes',
    ],
    stack: ['React', 'Node.js', 'Prisma', 'Mercado Pago', 'TanStack'],
  },
];

export const education = {
  title: 'Técnico en Informática Profesional y Personal',
  institution: 'Casa Salesiana San José',
  period: '2019 — 2025',
};
