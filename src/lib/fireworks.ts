// The fireworks of a lesson finished with three stars. Rockets rise from the bottom and from both sides of the window,
// and each one bursts into sparks in the colours of the look. The show lasts a few seconds and then stops, so nothing
// keeps drawing once it is over. The component (components/Fireworks.tsx) leaves the show out for reduced motion.

type Side = 'bottom' | 'left' | 'right';

interface Point {
  x: number;
  y: number;
}

interface Rocket {
  from: Point;
  to: Point;
  elapsed: number;
  flight: number;
  colour: string;
  trail: Point[];
}

interface Spark {
  x: number;
  y: number;
  vx: number;
  vy: number;
  elapsed: number;
  life: number;
  size: number;
  colour: string;
}

// When each rocket leaves, in milliseconds from the start, and from which side. Every edge of the window gets some.
const LAUNCHES: Array<{ at: number; side: Side }> = [
  { at: 0, side: 'bottom' },
  { at: 330, side: 'left' },
  { at: 760, side: 'right' },
  { at: 1250, side: 'bottom' },
  { at: 1700, side: 'left' },
  { at: 2200, side: 'right' },
  { at: 2800, side: 'bottom' },
  { at: 3300, side: 'bottom' },
  { at: 3750, side: 'left' },
];

// The colour tokens of the look. A token that a look does not define is left out.
const COLOUR_TOKENS = ['--primary', '--primary-600', '--violet', '--sun', '--amber', '--teal', '--blue'];

const FRAME_MS = 1000 / 60;
const GRAVITY = 0.07; // px per frame, added to the fall of every spark each frame
const DRAG = 0.978; // the share of its speed a spark keeps each frame
const TRAIL = 8; // the points kept for the tail of a rocket

const between = (low: number, high: number): number => low + Math.random() * (high - low);

function pick<T>(list: T[]): T {
  return list[Math.floor(Math.random() * list.length)] as T;
}

function readColours(): string[] {
  const style = getComputedStyle(document.documentElement);
  const colours = COLOUR_TOKENS.map((token) => style.getPropertyValue(token).trim()).filter((value) => value !== '');
  return colours.length > 0 ? colours : [style.color];
}

// Draws the show on the canvas. It returns the function that stops it and clears the canvas.
export function runFireworks(canvas: HTMLCanvasElement): () => void {
  const context = canvas.getContext('2d');
  if (!context) return () => undefined;

  const colours = readColours();
  let rockets: Rocket[] = [];
  let sparks: Spark[] = [];
  let width = 0;
  let height = 0;
  let launched = 0;
  let elapsed = 0;
  let last: number | null = null;
  let frame = 0;
  let running = true;

  const resize = () => {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    width = canvas.clientWidth;
    height = canvas.clientHeight;
    canvas.width = Math.max(1, Math.round(width * dpr));
    canvas.height = Math.max(1, Math.round(height * dpr));
    context.setTransform(dpr, 0, 0, dpr, 0, 0);
  };

  const launch = (side: Side): Rocket => {
    const colour = pick(colours);
    if (side === 'bottom') {
      return {
        from: { x: between(0.15, 0.85) * width, y: height + 8 },
        to: { x: between(0.2, 0.8) * width, y: between(0.18, 0.5) * height },
        elapsed: 0,
        flight: between(850, 1050),
        colour,
        trail: [],
      };
    }
    const fromLeft = side === 'left';
    return {
      from: { x: fromLeft ? -8 : width + 8, y: between(0.55, 0.9) * height },
      to: {
        x: fromLeft ? between(0.1, 0.3) * width : between(0.7, 0.9) * width,
        y: between(0.2, 0.45) * height,
      },
      elapsed: 0,
      flight: between(750, 950),
      colour,
      trail: [],
    };
  };

  const burst = (at: Point, colour: string) => {
    const count = 56 + Math.floor(Math.random() * 24);
    const turn = Math.random() * Math.PI * 2;
    for (let i = 0; i < count; i += 1) {
      const angle = turn + (i / count) * Math.PI * 2 + between(-0.1, 0.1);
      const speed = between(2.4, 5.2);
      sparks.push({
        x: at.x,
        y: at.y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        elapsed: 0,
        life: between(1100, 1800),
        size: between(1.6, 2.8),
        colour: Math.random() < 0.7 ? colour : pick(colours),
      });
    }
  };

  const step = (dt: number) => {
    const frames = dt / FRAME_MS;
    const drag = Math.pow(DRAG, frames);
    const flying: Rocket[] = [];
    for (const rocket of rockets) {
      rocket.elapsed += dt;
      const t = Math.min(rocket.elapsed / rocket.flight, 1);
      const eased = 1 - Math.pow(1 - t, 3); // quick at the start, and slowing as it nears its height
      const point = {
        x: rocket.from.x + (rocket.to.x - rocket.from.x) * eased,
        y: rocket.from.y + (rocket.to.y - rocket.from.y) * eased,
      };
      rocket.trail.push(point);
      if (rocket.trail.length > TRAIL) rocket.trail.shift();
      if (t >= 1) burst(rocket.to, rocket.colour);
      else flying.push(rocket);
    }
    rockets = flying;

    const living: Spark[] = [];
    for (const spark of sparks) {
      spark.elapsed += dt;
      if (spark.elapsed >= spark.life) continue;
      spark.vx *= drag;
      spark.vy = spark.vy * drag + GRAVITY * frames;
      spark.x += spark.vx * frames;
      spark.y += spark.vy * frames;
      living.push(spark);
    }
    sparks = living;
  };

  const draw = () => {
    context.clearRect(0, 0, width, height);
    context.lineCap = 'round';
    context.lineWidth = 2;
    for (const rocket of rockets) {
      context.strokeStyle = rocket.colour;
      context.fillStyle = rocket.colour;
      const trail = rocket.trail;
      for (let i = 1; i < trail.length; i += 1) {
        const from = trail[i - 1];
        const to = trail[i];
        if (!from || !to) continue;
        context.globalAlpha = (i / trail.length) * 0.6;
        context.beginPath();
        context.moveTo(from.x, from.y);
        context.lineTo(to.x, to.y);
        context.stroke();
      }
      const head = trail[trail.length - 1];
      if (head) {
        context.globalAlpha = 1;
        context.beginPath();
        context.arc(head.x, head.y, 2.4, 0, Math.PI * 2);
        context.fill();
      }
    }
    for (const spark of sparks) {
      const left = 1 - spark.elapsed / spark.life;
      context.globalAlpha = Math.pow(left, 1.3);
      context.fillStyle = spark.colour;
      context.beginPath();
      context.arc(spark.x, spark.y, spark.size, 0, Math.PI * 2);
      context.fill();
    }
    context.globalAlpha = 1;
  };

  const tick = (now: number) => {
    if (!running) return;
    if (last === null) last = now;
    // A long pause, such as a hidden window, does not jump the show ahead.
    const dt = Math.min(now - last, 64);
    last = now;
    elapsed += dt;
    for (let next = LAUNCHES[launched]; next && elapsed >= next.at; next = LAUNCHES[launched]) {
      rockets.push(launch(next.side));
      launched += 1;
    }
    step(dt);
    draw();
    if (launched >= LAUNCHES.length && rockets.length === 0 && sparks.length === 0) {
      context.clearRect(0, 0, width, height);
      running = false;
      return;
    }
    frame = requestAnimationFrame(tick);
  };

  resize();
  window.addEventListener('resize', resize);
  frame = requestAnimationFrame(tick);

  return () => {
    running = false;
    cancelAnimationFrame(frame);
    window.removeEventListener('resize', resize);
    context.clearRect(0, 0, width, height);
  };
}
