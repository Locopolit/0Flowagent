import React, { useRef, useEffect } from "react";

export default function ParticleNetwork({ className }) {
  const canvasRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    let animId;
    let particles = [];
    const PARTICLE_COUNT = 80;
    const CONNECTION_DIST = 150;
    const MOUSE = { x: -1000, y: -1000 };

    const resize = () => {
      canvas.width = canvas.offsetWidth * window.devicePixelRatio;
      canvas.height = canvas.offsetHeight * window.devicePixelRatio;
      ctx.scale(window.devicePixelRatio, window.devicePixelRatio);
    };

    class Particle {
      constructor() {
        this.reset();
      }
      reset() {
        this.x = Math.random() * canvas.offsetWidth;
        this.y = Math.random() * canvas.offsetHeight;
        this.vx = (Math.random() - 0.5) * 0.4;
        this.vy = (Math.random() - 0.5) * 0.4;
        this.radius = Math.random() * 1.5 + 0.5;
        this.opacity = Math.random() * 0.5 + 0.3;
        // Some particles glow blue, others white
        this.hue = Math.random() > 0.7 ? 220 : Math.random() > 0.5 ? 250 : 0;
        this.saturation = this.hue === 0 ? 0 : 70;
      }
      update() {
        this.x += this.vx;
        this.y += this.vy;
        // Subtle attraction to mouse
        const dx = MOUSE.x - this.x;
        const dy = MOUSE.y - this.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < 200) {
          this.vx += dx * 0.00003;
          this.vy += dy * 0.00003;
        }
        // Speed limit
        const speed = Math.sqrt(this.vx * this.vx + this.vy * this.vy);
        if (speed > 0.8) {
          this.vx *= 0.98;
          this.vy *= 0.98;
        }
        // Wrap edges
        if (this.x < 0) this.x = canvas.offsetWidth;
        if (this.x > canvas.offsetWidth) this.x = 0;
        if (this.y < 0) this.y = canvas.offsetHeight;
        if (this.y > canvas.offsetHeight) this.y = 0;
      }
      draw() {
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
        ctx.fillStyle = `hsla(${this.hue}, ${this.saturation}%, 70%, ${this.opacity})`;
        ctx.fill();
      }
    }

    const init = () => {
      resize();
      particles = [];
      for (let i = 0; i < PARTICLE_COUNT; i++) {
        particles.push(new Particle());
      }
    };

    const drawConnections = () => {
      for (let i = 0; i < particles.length; i++) {
        for (let j = i + 1; j < particles.length; j++) {
          const dx = particles[i].x - particles[j].x;
          const dy = particles[i].y - particles[j].y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist < CONNECTION_DIST) {
            const opacity = (1 - dist / CONNECTION_DIST) * 0.15;
            ctx.beginPath();
            ctx.moveTo(particles[i].x, particles[i].y);
            ctx.lineTo(particles[j].x, particles[j].y);
            ctx.strokeStyle = `rgba(100, 150, 255, ${opacity})`;
            ctx.lineWidth = 0.5;
            ctx.stroke();
          }
        }
      }
    };

    // Floating "data pulses" along connections
    let pulses = [];
    const spawnPulse = () => {
      if (pulses.length > 5) return;
      const i = Math.floor(Math.random() * particles.length);
      const j = Math.floor(Math.random() * particles.length);
      if (i === j) return;
      const dx = particles[i].x - particles[j].x;
      const dy = particles[i].y - particles[j].y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist < CONNECTION_DIST) {
        pulses.push({ from: i, to: j, t: 0, speed: 0.01 + Math.random() * 0.015 });
      }
    };

    const drawPulses = () => {
      pulses = pulses.filter((p) => p.t <= 1);
      pulses.forEach((p) => {
        p.t += p.speed;
        const x = particles[p.from].x + (particles[p.to].x - particles[p.from].x) * p.t;
        const y = particles[p.from].y + (particles[p.to].y - particles[p.from].y) * p.t;
        ctx.beginPath();
        ctx.arc(x, y, 2, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(96, 165, 250, ${0.8 - p.t * 0.6})`;
        ctx.fill();
        // glow
        ctx.beginPath();
        ctx.arc(x, y, 5, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(96, 165, 250, ${0.2 - p.t * 0.15})`;
        ctx.fill();
      });
    };

    let frame = 0;
    const animate = () => {
      ctx.clearRect(0, 0, canvas.offsetWidth, canvas.offsetHeight);
      particles.forEach((p) => {
        p.update();
        p.draw();
      });
      drawConnections();
      drawPulses();
      frame++;
      if (frame % 60 === 0) spawnPulse();
      animId = requestAnimationFrame(animate);
    };

    const handleMouse = (e) => {
      const rect = canvas.getBoundingClientRect();
      MOUSE.x = e.clientX - rect.left;
      MOUSE.y = e.clientY - rect.top;
    };

    const handleLeave = () => {
      MOUSE.x = -1000;
      MOUSE.y = -1000;
    };

    init();
    animate();

    window.addEventListener("resize", () => { resize(); });
    canvas.addEventListener("mousemove", handleMouse);
    canvas.addEventListener("mouseleave", handleLeave);

    return () => {
      cancelAnimationFrame(animId);
      window.removeEventListener("resize", resize);
      canvas.removeEventListener("mousemove", handleMouse);
      canvas.removeEventListener("mouseleave", handleLeave);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className={className}
      style={{ width: "100%", height: "100%" }}
    />
  );
}
