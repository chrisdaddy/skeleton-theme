// AI-kit chat: replays the scripted transcript once when it comes on screen. The full
// transcript is in the HTML, so without JS (or under prefers-reduced-motion) it simply shows.
// What the input box shows once the transcript has played.
const NEXT_PROMPT = 'Write an advertorial from our top 50 reviews, angle: busy parents…';
const TYPE_MS = 24;
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

export default function init(root, { reduceMotion }) {
  if (reduceMotion.matches) return;
  const log = root.querySelector('[data-chat-log]');
  const input = root.querySelector('[data-chat-input]');
  const messages = [...log.children];
  const originals = messages.map((msg) => msg.innerHTML);
  // Keep the box at its final height so the page doesn't move while it plays.
  log.style.minHeight = `${log.offsetHeight}px`;
  for (const msg of messages) msg.classList.add('is-pending');
  input.textContent = '';
  let cancelled = false;
  reduceMotion.addEventListener?.('change', () => {
    cancelled = true;
    messages.forEach((msg, i) => {
      msg.innerHTML = originals[i];
      msg.classList.remove('is-pending', 'is-typing');
    });
    input.textContent = NEXT_PROMPT;
  });

  async function type(text) {
    for (let i = 1; i <= text.length && !cancelled; i += 1) {
      input.textContent = text.slice(0, i);
      await sleep(TYPE_MS);
    }
  }

  (async () => {
    await sleep(400);
    for (let i = 0; i < messages.length && !cancelled; i += 2) {
      const ask = messages[i];
      const reply = messages[i + 1];
      await type(ask.textContent);
      await sleep(350);
      if (cancelled) return;
      input.textContent = '';
      ask.classList.remove('is-pending');
      if (!reply) continue;
      reply.textContent = '';
      reply.classList.add('is-typing');
      reply.classList.remove('is-pending');
      await sleep(900);
      reply.classList.remove('is-typing');
      reply.innerHTML = originals[i + 1];
      await sleep(1100);
    }
    if (!cancelled) await type(NEXT_PROMPT);
  })();
}
