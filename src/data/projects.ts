export interface Project {
  id: number;
  title: string;
  description: string;
  image: string;
  tags: string[];
  demoUrl?: string;
  repoUrl?: string;
}

export const projects: Project[] = [
  {
    id: 1,
    title: "ArgenLeaf",
    description: "Versión DIY de paneles de luz inteligentes similar a Nanoleaf, utilizando Arduino como plataforma principal. Desarrollado en equipo, permite crear paneles modulares con efectos de iluminación personalizables.",
    image: "src/img/argenleaf.png",
    tags: ["Arduino", "Hardware", "C++"],
    repoUrl: "https://github.com/MAT1GR/ARGENLEAF"
  },
  {
    id: 2,
    title: "ConsultarVault",
    description: "Aplicación web para crear y almacenar contraseñas de forma segura y confiable. Interfaz intuitiva que facilita la gestión de credenciales.",
    image: "src/img/consultarvault.png",
    tags: ["JavaScript", "React", "SQL"],
    demoUrl: "https://mat1gr.github.io/ConsultarVault/",
    repoUrl: "https://github.com/MAT1GR/ConsultarVault"
  },
  {
    id: 3,
    title: "Transformador de Archivos",
    description: "Script especializado que combina y organiza texto de múltiples formatos de archivo en un único documento, diseñado específicamente para aplicaciones de Machine Learning.",
    image: "src/img/datos.png",
    tags: ["Python", "Automatización"],
    repoUrl: "https://github.com/MAT1GR/Transformador_de_archivos"
  },
  {
    id: 4,
    title: "Extracción de Datos",
    description: "Script en Python que automatiza la extracción y organización de datos clave, optimizando el procesamiento de información para análisis posteriores.",
    image: "src/img/extraccion.png",
    tags: ["Python", "Automatización"],
    repoUrl: "https://github.com/MAT1GR/extraccion_datos_py"
  },
  {
    id: 5,
    title: "Juego Ahorcado",
    description: "Juego de ahorcado en Python con menú, colores y registro de partidas, ideal para practicar lógica y estructuras básicas.",
    image: "src/img/ahorcado.png",
    tags: ["Python"],
    repoUrl: "https://github.com/MAT1GR/Juego-Ahorcado"
  },
   {
    id: 6,
    title: "Notas",
    description: "Una app de notas simple y rápida que permite crear, editar y eliminar notas, con guardado en la nube y sincronización por usuario usando React y Firebase.",
    image: "src/img/notas.png",
    tags: ["React","SQL","JavaScript"],
    repoUrl: "https://github.com/MAT1GR/App-Notas"
  }
];

export const allTags = Array.from(
  new Set(projects.flatMap(project => project.tags))
).sort();