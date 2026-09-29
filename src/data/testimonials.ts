export interface Testimonial {
  name: string;
  role: string;
  relation: string;
  quote: string;
  avatar: string;
}

// Recomendaciones públicas de LinkedIn.
export const testimonials: Testimonial[] = [
  {
    name: 'Luciano Santini',
    avatar: '/img/testimonials/luciano-santini.png',
    role: 'Desarrollador de Software',
    relation: 'Trabajamos en el mismo equipo',
    quote:
      'Un placer trabajar con Mati! Siempre predispuesto y capaz. Se destaca por sus ideas para resolver problemas y su creatividad.',
  },
  {
    name: 'Benicio Figueiras',
    avatar: '/img/testimonials/benicio-figueiras.png',
    role: 'Técnico en Informática',
    relation: 'Compañero de estudios',
    quote:
      'A lo largo de nuestro transcurso escolar, tuvimos varios proyectos, y en todos, Matías se destacaba por su destreza en la resolución de problemas y su mentalidad de nunca rendirse.',
  },
  {
    name: 'Ignacio Oliden',
    avatar: '/img/testimonials/ignacio-oliden.png',
    role: 'Técnico en Informática',
    relation: 'Compañero de estudios',
    quote: 'Muy disciplinado en su área, lo recomiendo.',
  },
];
