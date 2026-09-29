import type { LucideIcon } from 'lucide-react';
import { CalendarCheck, FlaskConical, Flower2, Glasses, Receipt, Wallet } from 'lucide-react';

export type ProjectContext = 'Profesional' | 'Cliente' | 'Personal';

export interface FeaturedProject {
  slug: string;
  title: string;
  kind: string;
  context: ProjectContext;
  description: string;
  highlights: string[];
  stack: string[];
  icon: LucideIcon;
  repoUrl?: string;
}

export interface OtherProject {
  title: string;
  description: string;
  stack: string[];
  url: string;
}

export const featuredProjects: FeaturedProject[] = [
  {
    slug: 'isometer-go',
    title: 'ISOmeter Go',
    kind: 'Gestión de laboratorio',
    context: 'Profesional',
    description: 'El sistema con el que opera Laboratorio Consultar, en web y escritorio.',
    highlights: [
      'Roles y permisos por área',
      'Órdenes de trabajo y seguimiento',
      'Dashboard y PDFs automáticos',
      'Notificaciones en tiempo real',
    ],
    stack: ['React', 'TypeScript', 'Node.js', 'SQLite', 'Tauri'],
    icon: FlaskConical,
  },
  {
    slug: 'lucen',
    title: 'LUCEN',
    kind: 'E-commerce',
    context: 'Cliente',
    description: 'Tienda online con pagos, panel admin y recuperación de carritos.',
    highlights: [
      'Checkout con Mercado Pago',
      'Panel de pedidos, productos y clientes',
      'Emails automáticos',
      'Meta Conversions API',
    ],
    stack: ['React', 'TypeScript', 'Express', 'Prisma', 'Mercado Pago'],
    icon: Glasses,
  },
  {
    slug: 'viveroflor',
    title: 'ViveroFlor',
    kind: 'E-commerce',
    context: 'Cliente',
    description: 'E-commerce mobile-first para un vivero: catálogo, carrito y gestión de pedidos.',
    highlights: ['Catálogo con filtros y stock', 'Retiro o envío', 'Panel de productos y pedidos'],
    stack: ['TanStack Start', 'React', 'TypeScript', 'Vercel'],
    icon: Flower2,
  },
  {
    slug: 'indoorkart',
    title: 'Rosario Indoor Kart',
    kind: 'Reservas online',
    context: 'Cliente',
    description: 'Reservas de karting con panel para el staff.',
    highlights: ['Bloqueo temporal anti-sobreventa', 'Horarios, karts y precios', 'Roles Admin / Staff'],
    stack: ['React', 'TypeScript', 'Express', 'Prisma'],
    icon: CalendarCheck,
  },
  {
    slug: 'rospack',
    title: 'Rospack',
    kind: 'Gestión comercial',
    context: 'Cliente',
    description: 'Clientes, trabajos, presupuestos, cheques y cuentas corrientes.',
    highlights: ['API REST validada', 'Reportes con gráficos', 'Exporta PDF y Excel'],
    stack: ['React', 'TypeScript', 'Express', 'SQLite'],
    icon: Receipt,
    repoUrl: 'https://github.com/MAT1GR/rospack',
  },
  {
    slug: 'billie',
    title: 'Billie',
    kind: 'App de finanzas',
    context: 'Personal',
    description: 'Finanzas personales y en pareja, en el celular.',
    highlights: ['Presupuestos, deudas y metas', 'Login biométrico', 'Gráficos y export CSV'],
    stack: ['Flutter', 'Supabase', 'React'],
    icon: Wallet,
    repoUrl: 'https://github.com/MAT1GR/BillieCel',
  },
];

export const otherProjects: OtherProject[] = [
  { title: 'ArgenLeaf', description: 'Paneles de luz inteligentes', stack: ['C++', 'Arduino'], url: 'https://github.com/MAT1GR/ARGENLEAF' },
  { title: 'Washify', description: 'Reservas de lavaderos', stack: ['Flutter', 'Supabase'], url: 'https://github.com/MAT1GR/washify' },
  { title: 'App de Notas', description: 'Editor con sync en la nube', stack: ['React', 'Firebase'], url: 'https://github.com/MAT1GR/App-Notas' },
  { title: 'Transformador de Archivos', description: 'Datasets para ML', stack: ['Python'], url: 'https://github.com/MAT1GR/Transformador_de_archivos' },
  { title: 'Extracción de Datos', description: 'Automatización de datos', stack: ['Python'], url: 'https://github.com/MAT1GR/extraccion_datos_py' },
  { title: 'Preparador de Fotos', description: 'HEIC a WebP optimizado', stack: ['Python'], url: 'https://github.com/MAT1GR/PreparadorFotosWeb' },
  { title: 'ConsultarVault', description: 'Gestor de contraseñas', stack: ['JavaScript'], url: 'https://github.com/MAT1GR/ConsultarVault' },
  { title: 'Geometry Dash', description: 'Juego de plataformas', stack: ['Godot'], url: 'https://github.com/MAT1GR/GeometryDash' },
];
