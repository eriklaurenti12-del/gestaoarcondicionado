import React from 'react';

interface MarqueeBannerProps {
  items: { text: string; highlight?: boolean }[];
  direction?: 'left' | 'right';
  speed?: 'slow' | 'normal' | 'fast';
  position?: 'top' | 'bottom' | 'hero-below' | 'above-prices';
  bgColor?: string;
  textColor?: string;
  fontSize?: 'sm' | 'md' | 'lg' | 'xl';
  style?: 'solid' | 'gradient' | 'glass' | 'neon';
  separator?: string;
  angle?: number;
}

const MarqueeBanner: React.FC<MarqueeBannerProps> = ({
  items,
  direction = 'left',
  speed = 'normal',
  bgColor = '#06b6d4',
  textColor = '#ffffff',
  fontSize = 'md',
  style = 'solid',
  separator = '✦',
  angle = 0,
}) => {
  if (!items.length) return null;

  const speedMap = { slow: '40s', normal: '25s', fast: '12s' };
  const fontSizeMap = { sm: 'text-xs', md: 'text-sm', lg: 'text-base', xl: 'text-lg' };
  const animDuration = speedMap[speed];

  const bgStyles: Record<string, React.CSSProperties> = {
    solid: { backgroundColor: bgColor },
    gradient: { background: `linear-gradient(90deg, ${bgColor}, ${bgColor}88, ${bgColor})` },
    glass: { backgroundColor: `${bgColor}33`, backdropFilter: 'blur(10px)', borderTop: `1px solid ${bgColor}44`, borderBottom: `1px solid ${bgColor}44` },
    neon: { backgroundColor: '#000', boxShadow: `0 0 20px ${bgColor}66, inset 0 0 20px ${bgColor}22` },
  };

  const textItems = items.map((item, i) => (
    <React.Fragment key={i}>
      <span className={`${item.highlight ? 'font-bold' : 'font-medium'} whitespace-nowrap px-3`}
        style={{ color: textColor, textShadow: style === 'neon' ? `0 0 10px ${bgColor}, 0 0 20px ${bgColor}66` : 'none' }}>
        {item.text}
      </span>
      <span className="mx-2 opacity-50" style={{ color: textColor }}>{separator}</span>
    </React.Fragment>
  ));

  // Repeat items enough to fill the screen
  const repeated = [...textItems, ...textItems, ...textItems, ...textItems];

  return (
    <div
      className="overflow-hidden relative w-full py-2.5"
      style={{
        ...bgStyles[style],
        transform: angle ? `rotate(${angle}deg)` : undefined,
        transformOrigin: 'center',
        zIndex: 10,
      }}
    >
      <div
        className={`flex items-center ${fontSizeMap[fontSize]}`}
        style={{
          animation: `marquee-${direction} ${animDuration} linear infinite`,
          width: 'max-content',
        }}
      >
        {repeated}
      </div>

      <style>{`
        @keyframes marquee-left {
          0% { transform: translateX(0); }
          100% { transform: translateX(-50%); }
        }
        @keyframes marquee-right {
          0% { transform: translateX(-50%); }
          100% { transform: translateX(0); }
        }
      `}</style>
    </div>
  );
};

export default MarqueeBanner;
