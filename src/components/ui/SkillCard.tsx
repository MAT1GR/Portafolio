import React from 'react';
import { Skill } from '../../data/skills';
import { Code, Database, Cpu, Settings, PenTool as Tool, FileCode, FileJson, MessageSquareCode } from 'lucide-react';

interface SkillCardProps {
  skill: Skill;
}

const SkillCard: React.FC<SkillCardProps> = ({ skill }) => {
  const getIcon = () => {
    switch (skill.icon) {
      case 'html':
        return <FileCode className="text-orange-500\" size={24} />;
      case 'css':
        return <FileCode className="text-blue-500" size={24} />;
      case 'javascript':
        return <FileJson className="text-yellow-500" size={24} />;
      case 'react':
        return <MessageSquareCode className="text-blue-400" size={24} />;
      case 'bootstrap':
        return <FileCode className="text-purple-500" size={24} />;
      case 'python':
        return <FileCode className="text-green-500" size={24} />;
      case 'database':
        return <Database className="text-indigo-500" size={24} />;
      case 'code':
        return <Code className="text-gray-500" size={24} />;
      case 'cpu':
        return <Cpu className="text-red-500" size={24} />;
      case 'tool':
        return <Tool className="text-gray-500" size={24} />;
      case 'settings':
        return <Settings className="text-gray-500" size={24} />;
      default:
        return <Code className="text-primary" size={24} />;
    }
  };

  return (
    <div className="group relative overflow-hidden p-6 rounded-xl bg-card/50 backdrop-blur-sm border border-border/50 transition-all duration-300 hover:shadow-lg hover:scale-[1.02] hover:border-primary/20">
      <div className="absolute inset-0 bg-gradient-to-br from-primary/10 via-primary/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
      <div className="relative flex items-center space-x-4">
        <div className="flex items-center justify-center w-14 h-14 rounded-xl bg-gradient-to-br from-primary/20 to-primary/5 group-hover:from-primary/30 group-hover:to-primary/10 transition-all duration-300">
          {getIcon()}
        </div>
        <div>
          <h3 className="text-lg font-medium group-hover:text-primary transition-colors duration-300">
            {skill.name}
          </h3>
          {skill.level && (
            <div className="mt-1 text-sm text-muted-foreground">
              {skill.level}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default SkillCard;