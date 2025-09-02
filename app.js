const { App } = require('@slack/bolt');
require('dotenv').config();

const app = new App({
  token: process.env.SLACK_BOT_TOKEN,
  appToken: process.env.SLACK_APP_TOKEN,
  socketMode: true
});

const brand = process.env.DEFAULT_BRAND || 'Client Brand';

function sanitize(text = '') {
  return (text || '').replace(/<@[^>]+>/g, '').replace(/\s+/g, ' ').trim();
}
function splitCommand(text) {
  const cleaned = sanitize(text);
  const [cmd, ...rest] = cleaned.split(' ');
  return { cmd: (cmd || '').toLowerCase(), arg: rest.join(' ').trim() };
}
function ensureScene(arg) {
  return arg && arg.length > 0
    ? arg
    : 'small business owner working late on a laptop, coffee shop at night';
}

const styles = {
  ideogram: [
    'photorealistic, 35mm lens, shallow depth of field',
    '2D flat vector, bold shapes, minimal palette',
    'anime cinematic, dynamic pose, speed lines',
    '3D Pixar-like render, soft global illumination',
    'blueprint schematic, isometric, white-on-blue'
  ],
  palettes: [
    'warm tungsten, soft shadows',
    'cool teal & orange, high contrast',
    'neon magenta/cyan, rim light',
    'natural daylight, bounce fill',
    'monochrome grayscale, film grain'
  ],
  compositions: [
    'centered, symmetrical',
    'rule of thirds, leading lines',
    'wide establishing shot',
    'tight close-up, subject fills frame',
    'over-the-shoulder perspective'
  ]
};

function ideogramPrompts(scene) {
  const base = scene;
  const picks = (arr, n) => arr.slice(0, n);
  const out = [];
  const selectedStyles = picks(styles.ideogram, 3);

  selectedStyles.forEach((s, i) => {
    const comp = styles.compositions[i] || styles.compositions[0];
    const pal = styles.palettes[i] || styles.palettes[0];
    out.push(
`Subject & Action: ${base}
Style: ${s}
Environment: on-brand setting for ${brand}
Composition: ${comp}
Lighting/Color: ${pal}
Quality: high detail, crisp textures, clean background
Notes: accurate anatomy, coherent text, no watermarks, 1024x1024`
    );
  });
  return out;
}

function klingShotList(scene) {
  return [
    `SHOT 1 – Establishing: Wide shot of ${scene}, 24mm lens, slow push-in, natural ambience`,
    `SHOT 2 – Action: Medium of main subject performing key action, 35mm, subtle handheld`,
    `SHOT 3 – Detail: Macro insert of hands/object, 85mm macro, hard edge light`,
    `SHOT 4 – Reaction: Close-up face, 50mm, soft key + practicals in bokeh`,
    `SHOT 5 – Dynamic: Tracking lateral move, 35mm, parallax with foreground elements`,
    `SHOT 6 – Payoff: Hero angle, 28mm low angle, backlight rim, logo/product in frame`
  ].join('\n');
}

function elevenLabsDirections(scene) {
  return [
    `Voice: Warm, confident, mid‑tempo (120–140 wpm).`,
    `Pronunciation: Brand as "${brand}".`,
    `Energy Map: Calm (0–5s), Engaged (5–20s), Upbeat CTA (20–30s).`,
    `Script Beats:`,
    `  1) Problem (one sentence) tied to ${scene}.`,
    `  2) Solution (brand hook) with one benefit and one stat.`,
    `  3) CTA (visit site / sign up) with urgency.`
  ].join('\n');
}

function canvaChecklist() {
  return [
    `Canvas 1080x1920 (Reels/TikTok) or 1920x1080 (YouTube).`,
    `Import: images from Ideogram, clips from Kling, VO from ElevenLabs.`,
    `Sequence: 1) Establish 2) Action 3) Detail 4) Reaction 5) Dynamic 6) Payoff.`,
    `Text: Large, high-contrast, 6–10 words max per card.`,
    `Brand: Colors, logo safe-area, consistent lower-third.`,
    `Audio: -6 dB peak, duck music to -18 dB under VO.`,
    `Export: H.264, 12–16 Mbps, AAC 320 kbps.`
  ].map(x => `• ${x}`).join('\n');
}

function formatBlock(title, body) {
  return `*${title}*\n\n\`\`\`\n${body}\n\`\`\``;
}

async function handleBundle({ say, arg }) {
  const scene = ensureScene(arg);
  const ideos = ideogramPrompts(scene).map((p, i) =>
    formatBlock(`Ideogram Prompt ${i + 1}`, p)
  ).join('\n\n');
  const kling = formatBlock('Kling Shot List (6 shots)', klingShotList(scene));
  const elabs = formatBlock('ElevenLabs Voice Directions', elevenLabsDirections(scene));
  const canva = formatBlock('Canva Assembly Checklist', canvaChecklist());
  await say({
    text: `Here’s your *prompt bundle* for: _${scene}_\n\n${ideos}\n\n${kling}\n\n${elabs}\n\n${canva}`
  });
}

async function handleIdeogram({ say, arg }) {
  const scene = ensureScene(arg);
  const ideos = ideogramPrompts(scene)
    .map((p, i) => formatBlock(`Ideogram Prompt ${i + 1}`, p))
    .join('\n\n');
  await say({ text: `*Ideogram prompts* for _${scene}_\n\n${ideos}` });
}

async function handleKling({ say, arg }) {
  const scene = ensureScene(arg);
  const kling = formatBlock('Kling Shot List (6 shots)', klingShotList(scene));
  await say({ text: `*Kling plan* for _${scene}_\n\n${kling}` });
}

async function handleEleven({ say, arg }) {
  const scene = ensureScene(arg);
  const elabs = formatBlock('ElevenLabs Voice Directions', elevenLabsDirections(scene));
  await say({ text: `*ElevenLabs directions* for _${scene}_\n\n${elabs}` });
}

async function handleHelp({ say }) {
  await say({
    text:
`*Prompt Bot Help*

Mention the bot with a command + short scene description:
• ideogram – generate 3 Ideogram prompts (5‑point formula)
• kling – 6‑shot storyboard with lenses and movement
• eleven – voice directions + script beats
• bundle – all of the above + Canva checklist

Examples:
@PromptBot bundle cozy home coffee ad at dawn
@PromptBot ideogram robot barista serving latte, neon cyberpunk
@PromptBot kling teacher welcoming students, first day of school`
  });
}

const handlers = {
  'bundle': handleBundle,
  'ideogram': handleIdeogram,
  'kling': handleKling,
  'eleven': handleEleven,
  'help': handleHelp
};

app.event('app_mention', async ({ event, say }) => {
  try {
    const { cmd, arg } = splitCommand(event.text);
    const handler = handlers[cmd] || handleHelp;
    await handler({ say, arg });
  } catch (e) {
    await say(`Sorry, I hit an error.\n\`\`\`\n${e?.message || e}\n\`\`\``);
  }
});

(async () => {
  await app.start();
  console.log('⚡ Prompt Bot is running (Socket Mode)');
})();

