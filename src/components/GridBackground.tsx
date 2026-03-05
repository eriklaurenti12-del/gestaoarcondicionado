import { useEffect, useRef } from 'react';

interface GridBackgroundProps {
  effect: 'grid' | 'dots' | 'gradient';
  gridColor?: string;
  gridOpacity?: number;
  glowColor?: string;
  fondoColor?: string;
}

export function GridBackground({ effect, gridColor = '#6366f1', gridOpacity = 15, glowColor = '#7c3aed', fondoColor = '#0f172a' }: GridBackgroundProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animId: number;
    let time = 0;

    const resize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };
    resize();
    window.addEventListener('resize', resize);

    const hexToRgb = (hex: string) => {
      const r = parseInt(hex.slice(1, 3), 16);
      const g = parseInt(hex.slice(3, 5), 16);
      const b = parseInt(hex.slice(5, 7), 16);
      return { r, g, b };
    };

    const animate = () => {
      time += 0.005;
      const { width, height } = canvas;
      
      // Clear with background
      ctx.fillStyle = fondoColor;
      ctx.fillRect(0, 0, width, height);

      const gc = hexToRgb(gridColor);
      const glc = hexToRgb(glowColor);
      const alpha = gridOpacity / 100;

      if (effect === 'grid') {
        const cellSize = 80;
        
        // Draw grid lines
        ctx.strokeStyle = `rgba(${gc.r}, ${gc.g}, ${gc.b}, ${alpha})`;
        ctx.lineWidth = 1;

        for (let x = 0; x <= width; x += cellSize) {
          ctx.beginPath();
          ctx.moveTo(x, 0);
          ctx.lineTo(x, height);
          ctx.stroke();
        }
        for (let y = 0; y <= height; y += cellSize) {
          ctx.beginPath();
          ctx.moveTo(0, y);
          ctx.lineTo(width, y);
          ctx.stroke();
        }

        // Animated glow spots
        const glowX = width * 0.7 + Math.sin(time) * 100;
        const glowY = height * 0.3 + Math.cos(time * 0.7) * 80;
        const glow = ctx.createRadialGradient(glowX, glowY, 0, glowX, glowY, 400);
        glow.addColorStop(0, `rgba(${glc.r}, ${glc.g}, ${glc.b}, 0.15)`);
        glow.addColorStop(0.5, `rgba(${glc.r}, ${glc.g}, ${glc.b}, 0.05)`);
        glow.addColorStop(1, 'transparent');
        ctx.fillStyle = glow;
        ctx.fillRect(0, 0, width, height);

        // Second glow
        const glow2X = width * 0.3 + Math.cos(time * 0.5) * 120;
        const glow2Y = height * 0.7 + Math.sin(time * 0.8) * 60;
        const glow2 = ctx.createRadialGradient(glow2X, glow2Y, 0, glow2X, glow2Y, 300);
        glow2.addColorStop(0, `rgba(${gc.r}, ${gc.g}, ${gc.b}, 0.1)`);
        glow2.addColorStop(1, 'transparent');
        ctx.fillStyle = glow2;
        ctx.fillRect(0, 0, width, height);

        // Vignette edges
        const vignette = ctx.createRadialGradient(width / 2, height / 2, height * 0.3, width / 2, height / 2, height);
        vignette.addColorStop(0, 'transparent');
        vignette.addColorStop(1, `rgba(0, 0, 0, 0.6)`);
        ctx.fillStyle = vignette;
        ctx.fillRect(0, 0, width, height);

      } else if (effect === 'dots') {
        const spacing = 40;
        const dotRadius = 1.5;

        for (let x = spacing; x < width; x += spacing) {
          for (let y = spacing; y < height; y += spacing) {
            const dist = Math.sqrt((x - width / 2) ** 2 + (y - height / 2) ** 2);
            const pulse = Math.sin(time * 2 + dist * 0.005) * 0.3 + 0.7;
            ctx.beginPath();
            ctx.arc(x, y, dotRadius, 0, Math.PI * 2);
            ctx.fillStyle = `rgba(${gc.r}, ${gc.g}, ${gc.b}, ${alpha * pulse})`;
            ctx.fill();
          }
        }

        // Glow
        const glowX = width * 0.6 + Math.sin(time) * 150;
        const glowY = height * 0.4 + Math.cos(time * 0.6) * 100;
        const glow = ctx.createRadialGradient(glowX, glowY, 0, glowX, glowY, 350);
        glow.addColorStop(0, `rgba(${glc.r}, ${glc.g}, ${glc.b}, 0.12)`);
        glow.addColorStop(1, 'transparent');
        ctx.fillStyle = glow;
        ctx.fillRect(0, 0, width, height);

      } else if (effect === 'gradient') {
        const x1 = width * 0.3 + Math.sin(time) * width * 0.2;
        const y1 = height * 0.3 + Math.cos(time * 0.7) * height * 0.2;
        const x2 = width * 0.7 + Math.cos(time * 0.5) * width * 0.2;
        const y2 = height * 0.7 + Math.sin(time * 0.8) * height * 0.2;

        const grad1 = ctx.createRadialGradient(x1, y1, 0, x1, y1, 500);
        grad1.addColorStop(0, `rgba(${gc.r}, ${gc.g}, ${gc.b}, 0.2)`);
        grad1.addColorStop(1, 'transparent');
        ctx.fillStyle = grad1;
        ctx.fillRect(0, 0, width, height);

        const grad2 = ctx.createRadialGradient(x2, y2, 0, x2, y2, 400);
        grad2.addColorStop(0, `rgba(${glc.r}, ${glc.g}, ${glc.b}, 0.15)`);
        grad2.addColorStop(1, 'transparent');
        ctx.fillStyle = grad2;
        ctx.fillRect(0, 0, width, height);
      }

      animId = requestAnimationFrame(animate);
    };

    animate();

    return () => {
      window.removeEventListener('resize', resize);
      cancelAnimationFrame(animId);
    };
  }, [effect, gridColor, gridOpacity, glowColor, fondoColor]);

  return (
    <canvas ref={canvasRef} className="fixed inset-0 pointer-events-none z-0" />
  );
}
