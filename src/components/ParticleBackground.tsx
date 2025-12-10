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
      size: number; // Length of the shard
      width: number; // Width of the shard
      speedX: number;
      speedY: number;
      color: string;
      rotation: number;
      rotationSpeed: number;

      constructor() {
        this.x = Math.random() * canvas!.width;
        this.y = Math.random() * canvas!.height;
        // Make them look like small shards/confetti
        this.size = Math.random() * 8 + 4; // Length 4-12px
        this.width = Math.random() * 2 + 1; // Width 1-3px

        this.speedX = Math.random() * 0.4 - 0.2;
        this.speedY = Math.random() * 0.4 - 0.2;

        // Colors from the Antigravity aesthetic (Blues, Cyans, slight Purple)
        // Adjusted to pop on dark background
        const colors = [
          'rgba(66, 133, 244, 0.6)', // Google Blue
          'rgba(34, 211, 238, 0.6)', // Cyan
          'rgba(139, 92, 246, 0.5)', // Violet
          'rgba(255, 255, 255, 0.4)'  // White/Grey
        ];
        this.color = colors[Math.floor(Math.random() * colors.length)];

        this.rotation = Math.random() * Math.PI * 2;
        this.rotationSpeed = (Math.random() - 0.5) * 0.02;
      }

      update() {
        this.x += this.speedX;
        this.y += this.speedY;
        this.rotation += this.rotationSpeed;

        if (this.x > canvas!.width) this.x = 0;
        if (this.x < 0) this.x = canvas!.width;
        if (this.y > canvas!.height) this.y = 0;
        if (this.y < 0) this.y = canvas!.height;

        // Mouse interaction
        const dx = mouseX - this.x;
        const dy = mouseY - this.y;
        const distance = Math.sqrt(dx * dx + dy * dy);
        const maxDistance = 200; // Slightly larger radius for 'field' effect

        if (distance < maxDistance) {
          const forceDirectionX = dx / distance;
          const forceDirectionY = dy / distance;
          const force = (maxDistance - distance) / maxDistance;

          // Repulse smoothly
          const strength = 4;
          this.x -= forceDirectionX * force * strength;
          this.y -= forceDirectionY * force * strength;

          // Add some spin when interacting
          this.rotation += 0.1 * force;
        }
      }

      draw() {
        if (!ctx) return;
        ctx.save();
        ctx.translate(this.x, this.y);
        ctx.rotate(this.rotation);
        ctx.fillStyle = this.color;
        // Draw rectangle centered on coordinate
        ctx.fillRect(-this.size / 2, -this.width / 2, this.size, this.width);
        ctx.restore();
      }
    }

    const initParticles = () => {
      particles = [];
      // Higher density for the 'confetti' look
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
        zIndex: 0 // Default, can be overridden by className/parent
      }}
    />
  );
}
