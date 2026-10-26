// Before/after slider: a range input over two screenshots. Sweeps a few times when it first
// comes on screen (not under prefers-reduced-motion), and stops as soon as it is touched.
const SWEEPS = 2;
const PERIOD = 4200;

export default function init(frame, { reduceMotion }) {
  const range = frame.querySelector('.ba-range');
  const set = (value) => frame.style.setProperty('--pos', `${value}%`);
  let frameId = 0;
  let stopped = reduceMotion.matches;

  const stop = () => {
    stopped = true;
    cancelAnimationFrame(frameId);
  };
  range.addEventListener('input', () => {
    stop();
    set(range.value);
  });
  for (const type of ['pointerdown', 'keydown', 'focus']) range.addEventListener(type, stop);
  set(range.value);
  if (stopped) return;

  let started = 0;
  const tick = (now) => {
    if (stopped) return;
    started ||= now;
    const t = (now - started) / PERIOD;
    if (t >= SWEEPS) {
      set(50);
      range.value = 50;
      stopped = true;
      return;
    }
    const value = Math.round((50 + 32 * Math.sin(t * 2 * Math.PI)) * 10) / 10;
    range.value = Math.round(value);
    set(value);
    frameId = requestAnimationFrame(tick);
  };
  const io = new IntersectionObserver(([entry]) => {
    if (entry.isIntersecting && !stopped) {
      io.disconnect();
      frameId = requestAnimationFrame(tick);
    }
  }, { threshold: 0.6 });
  io.observe(frame);
}
