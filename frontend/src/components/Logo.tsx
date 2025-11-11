import logoImage from '../assets/mmlogo.png';

interface LogoProps {
  className?: string;
  variant?: 'full' | 'icon';
  size?: 'sm' | 'md' | 'lg';
}

export default function Logo({ className = '', variant = 'full', size = 'md' }: LogoProps) {
  const sizeClasses = {
    sm: 'h-8',
    md: 'h-12',
    lg: 'h-20'
  };

  if (variant === 'icon') {
    return (
      <div className={`${className}`}>
        <img
          src={logoImage}
          alt="Medicine Man"
          className={`${sizeClasses[size]} w-auto`}
        />
      </div>
    );
  }

  return (
    <div className={`flex items-center space-x-3 ${className}`}>
      <img
        src={logoImage}
        alt="Medicine Man Logo"
        className={`${sizeClasses[size]} w-auto`}
      />
      <div className="flex flex-col">
        <span className="text-xl font-bold text-white leading-tight">Medicine Man</span>
        <span className="text-xs text-slate-400 leading-tight">Server Management</span>
      </div>
    </div>
  );
}
