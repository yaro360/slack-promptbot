const { App } = require('@slack/bolt');
require('dotenv').config();

const { generateDailyDigest, checkForUrgentSignals } = require('./lib/competitive-intel');
const { startDailyScheduler, runImmediately, getNextRunTime } = require('./lib/scheduler');
const { competitors, schedule } = require('./config/competitors');

const app = new App({
  token: process.env.SLACK_BOT_TOKEN,
  appToken: process.env.SLACK_APP_TOKEN,
  socketMode: true
});

const brand = process.env.DEFAULT_BRAND || 'Client Brand';
const COMPETITIVE_INTEL_CHANNEL = process.env.COMPETITIVE_INTEL_CHANNEL || schedule.channel;

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

*Competitive Intelligence Commands:*
• intel – run competitive intelligence scan now
• competitors – list monitored competitors
• intel-status – check next scheduled digest time

Examples:
@PromptBot bundle cozy home coffee ad at dawn
@PromptBot ideogram robot barista serving latte, neon cyberpunk
@PromptBot intel – run competitive scan immediately`
  });
}

async function handleIntel({ say }) {
  await say({ text: '🔍 Starting competitive intelligence scan... This may take a minute.' });
  
  try {
    const result = await generateDailyDigest();
    await say({ text: result.message });
  } catch (err) {
    await say({ text: `⚠️ Error running intel scan: ${err.message}` });
  }
}

async function handleCompetitors({ say }) {
  const tiers = competitors.tiers;
  let text = '*📊 Monitored Competitors*\n\n';
  
  for (const [tierName, companies] of Object.entries(tiers)) {
    text += `*${tierName}*\n`;
    for (const company of companies) {
      text += `• ${company.name} (${company.domain})\n`;
    }
    text += '\n';
  }
  
  text += `_Total: ${competitors.getCompetitorNames().length} competitors monitored_`;
  await say({ text });
}

async function handleIntelStatus({ say }) {
  const nextRun = getNextRunTime();
  const now = new Date();
  const msUntil = nextRun.getTime() - now.getTime();
  const daysUntil = Math.floor(msUntil / (1000 * 60 * 60 * 24));
  const hoursUntil = Math.floor((msUntil % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
  const minutesUntil = Math.floor((msUntil % (1000 * 60 * 60)) / (1000 * 60));
  
  const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const scheduleDesc = schedule.frequency === 'weekly' 
    ? `Weekly on ${dayNames[schedule.dayOfWeek]}s at ${schedule.time} ${schedule.timezone}`
    : `Daily at ${schedule.time} ${schedule.timezone}`;
  
  const timeUntil = daysUntil > 0 
    ? `${daysUntil}d ${hoursUntil}h ${minutesUntil}m`
    : `${hoursUntil}h ${minutesUntil}m`;
  
  await say({
    text: `*📅 Competitive Intelligence Schedule*\n\n` +
      `• Next digest: ${nextRun.toLocaleString('en-US', { timeZone: schedule.timezone })}\n` +
      `• Time until next run: ${timeUntil}\n` +
      `• Target channel: #${COMPETITIVE_INTEL_CHANNEL}\n` +
      `• Competitors monitored: ${competitors.getCompetitorNames().length}\n` +
      `• Schedule: ${scheduleDesc}`
  });
}

const handlers = {
  'bundle': handleBundle,
  'ideogram': handleIdeogram,
  'kling': handleKling,
  'eleven': handleEleven,
  'help': handleHelp,
  'intel': handleIntel,
  'competitors': handleCompetitors,
  'intel-status': handleIntelStatus,
  'intelstatus': handleIntelStatus,
  'status': handleIntelStatus
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

async function postDailyDigest() {
  try {
    const result = await generateDailyDigest();
    
    const channel = COMPETITIVE_INTEL_CHANNEL;
    await app.client.chat.postMessage({
      channel: channel,
      text: result.message,
      unfurl_links: false,
      unfurl_media: false
    });
    
    console.log(`[${new Date().toISOString()}] Posted daily digest to #${channel} (${result.signalCount} signals)`);
    
    if (result.signalCount === 0) {
      console.log('No actionable signals found - digest posted with no-activity message');
    }
  } catch (err) {
    console.error('Failed to post daily digest:', err);
  }
}

async function checkAndPostUrgentSignals() {
  try {
    const urgentSignals = await checkForUrgentSignals();
    
    if (urgentSignals.length > 0) {
      const channel = COMPETITIVE_INTEL_CHANNEL;
      let message = '🚨 *URGENT Competitive Signal Detected*\n\n';
      
      for (const signal of urgentSignals.slice(0, 3)) {
        message += `• *[${signal.company}]* — ${signal.title}\n  <${signal.url}|${signal.source}> | Tag: ${signal.tag.toUpperCase()}\n\n`;
      }
      
      await app.client.chat.postMessage({
        channel: channel,
        text: message,
        unfurl_links: false
      });
      
      console.log(`Posted ${urgentSignals.length} urgent signals to #${channel}`);
    }
  } catch (err) {
    console.error('Failed to check urgent signals:', err);
  }
}

(async () => {
  await app.start();
  console.log('⚡ Prompt Bot is running (Socket Mode)');
  
  const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const scheduleDesc = schedule.frequency === 'weekly' 
    ? `Weekly on ${dayNames[schedule.dayOfWeek]}s at ${schedule.time} ${schedule.timezone}`
    : `Daily at ${schedule.time} ${schedule.timezone}`;
  
  const schedulerInfo = startDailyScheduler(postDailyDigest);
  console.log(`📊 Competitive Intelligence Agent active`);
  console.log(`   Schedule: ${scheduleDesc}`);
  console.log(`   Next digest: ${schedulerInfo.nextRun.toLocaleString()}`);
  console.log(`   Channel: #${schedulerInfo.channel}`);
  console.log(`   Monitoring ${competitors.getCompetitorNames().length} competitors`);
})();

