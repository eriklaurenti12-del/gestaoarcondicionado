import { useEffect, useRef } from 'react';

interface ParticleBackgroundProps {
  className?: string; // Allow custom classes for positioning/z-index
}

export function ParticleBackground({ className = "" }: ParticleBackgroundProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let particles: Particle[] = [];
    let animationFrameId: number;
    let mouseX = 0;
    let mouseY = 0;

    // Canvas sizing
    const resizeCanvas = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
      initParticles();
    };

    class Particle {
      x: number;
      y: number;
      size: number;
      speedX: number;
      speedY: number;
      color: string;

      constructor() {
        this.x = Math.random() * canvas!.width;
        this.y = Math.random() * canvas!.height;
        // Snow size: mostly small, some variation
        this.size = Math.random() * 3 + 1;

        // Gentle floating movement 
        this.speedX = Math.random() * 0.5 - 0.25; // Gentle horizontal drift
        this.speedY = Math.random() * 0.5 + 0.2;  // Always falling down (positive Y) but slowly

        // Snow colors: Mostly white, some slight cyan/blue for depth
        const colors = [
          'rgba(255, 255, 255, 0.9)',  // Bright White
          'rgba(255, 255, 255, 0.5)',  // Translucent White
          'rgba(165, 243, 252, 0.7)', // Cyan-200 (Ice)
          'rgba(207, 250, 254, 0.6)'  // Cyan-50
        ];
        this.color = colors[Math.floor(Math.random() * colors.length)];
      }

      update() {
        this.x += this.speedX;
        this.y += this.speedY;

        // Wrap around screen - Snow falls from top
        if (this.y > canvas!.height) {
          this.y = 0 - 10;
          this.x = Math.random() * canvas!.width;
        }
        // Horizontal wrap
        if (this.x > canvas!.width) this.x = 0;
        if (this.x < 0) this.x = canvas!.width;

        // Mouse interaction - "Wind" effect
        const dx = mouseX - this.x;
        const dy = mouseY - this.y;
        const distance = Math.sqrt(dx * dx + dy * dy);
        const maxDistance = 200;

        if (distance < maxDistance) {
          const forceDirectionX = dx / distance;
          const forceDirectionY = dy / distance;
          const force = (maxDistance - distance) / maxDistance;

          // Repulse smoothly (Wind blows snow away)
          // Stronger X repulsion for "parting" effect, weaker Y to keep falling
          const strength = 6;
          this.x -= forceDirectionX * force * strength;
          this.y -= forceDirectionY * force * strength * 0.5;
        }
      }

      draw() {
        if (!ctx) return;
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
        ctx.fillStyle = this.color;

        // Add a soft glow to the snow
        ctx.shadowBlur = 8;
        ctx.shadowColor = this.color;

        ctx.fill();

        // Reset shadow for performance
        ctx.shadowBlur = 0;
      }
    }

    const initParticles = () => {
      particles = [];
      const numberOfParticles = Math.min((canvas.width * canvas.height) / 8000, 200);
      for (let i = 0; i < numberOfParticles; i++) {
        particles.push(new Particle());
      }
    };

    const animate = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      particles.forEach((particle) => {
        particle.update();
        particle.draw();
      });
      animationFrameId = requestAnimationFrame(animate);
    };

    const handleMouseMove = (e: MouseEvent) => {
      const rect = canvas.getBoundingClientRect();
      mouseX = e.clientX - rect.left;
      mouseY = e.clientY - rect.top;
    };

    window.addEventListener('resize', resizeCanvas);
    window.addEventListener('mousemove', handleMouseMove);

    resizeCanvas();
    animate();

    return () => {
      window.removeEventListener('resize', resizeCanvas);
      window.removeEventListener('mousemove', handleMouseMove);
      cancelAnimationFrame(animationFrameId);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className={`fixed inset-0 pointer-events-none ${className}`}
      style={{
        width: '100%',
        height: '100%',
        zIndex: 0
      }}
    />
  );
}
