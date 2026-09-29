import React from 'react';

const techs = [
  'TypeScript', 'React', 'Node.js', 'Express', 'Python', 'Prisma', 'SQL', 'Supabase',
  'Firebase', 'Tailwind CSS', 'TanStack', 'Flutter', 'Tauri', 'Mercado Pago', 'Git', 'Vercel',
];

// Cinta infinita con el stack. La lista se duplica para que el loop no tenga salto.
const TechMarquee: React.FC = () => (
  <div className="relative overflow-hidden border-y border-border bg-card/40 py-5 [mask-image:linear-gradient(to_right,transparent,black_10%,black_90%,transparent)]">
    <div className="flex w-max animate-marquee gap-10 hover:[animation-play-state:paused]">
      {[...techs, ...techs].map((tech, i) => (
        <span
          key={i}
          aria-hidden={i >= techs.length}
          className="flex items-center gap-10 whitespace-nowrap font-mono text-sm text-muted-foreground transition-colors hover:text-primary"
        >
          {tech}
          <span className="h-1.5 w-1.5 rounded-full bg-primary" />
        </span>
      ))}
    </div>
  </div>
);

export default TechMarquee;
