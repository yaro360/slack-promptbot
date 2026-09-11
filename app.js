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

const STRIPE_CHANNEL = process.env.STRIPE_CHANNEL_ID || '';

function parseStripePayment(text) {
  if (!text.includes('Payment Received') && !text.includes('Stripe Refunds') && !text.includes('Cancelled Subscription')) {
    return null;
  }

  const result = { type: 'unknown', customer: null, amount: 0, product: null, date: null };

  if (text.includes('Payment Received')) {
    result.type = 'payment';
    const customerMatch = text.match(/Customer:\s*(.+)/);
    const amountMatch = text.match(/Amount:\s*\$?([\d,]+(?:\.\d{2})?)/);
    const productMatch = text.match(/Product:\s*(.+)/);
    const dateMatch = text.match(/Date:\s*(.+)/);

    if (customerMatch) result.customer = customerMatch[1].trim();
    if (amountMatch) {
      const amounts = text.match(/\$([\d,]+(?:\.\d{2})?)/g) || [];
      result.amount = amounts.reduce((sum, a) => sum + parseFloat(a.replace(/[$,]/g, '')), 0);
    }
    if (productMatch) result.product = productMatch[1].trim();
    if (dateMatch) result.date = dateMatch[1].trim();
  } else if (text.includes('Stripe Refunds')) {
    result.type = 'refund';
    const refundMatch = text.match(/Amount Refunded:\s*\$?([\d,]+(?:\.\d{2})?)/);
    if (refundMatch) result.amount = parseFloat(refundMatch[1].replace(/,/g, ''));
  } else if (text.includes('Cancelled Subscription')) {
    result.type = 'cancellation';
    const nameMatch = text.match(/Name:\s*(.+)/);
    const planMatch = text.match(/Plan Amount:\s*\$?([\d,]+(?:\.\d{2})?)/);
    const reasonMatch = text.match(/Cancellation Details Reason:\s*(\w+)/);

    if (nameMatch) result.customer = nameMatch[1].trim();
    if (planMatch) result.amount = parseFloat(planMatch[1].replace(/,/g, ''));
    if (reasonMatch) result.reason = reasonMatch[1];
  }

  return result;
}

function categorizeProduct(productStr) {
  if (!productStr) return 'Unknown';
  const p = productStr.toLowerCase();
  if (p.includes('recurring revenue engine') && p.includes('setup')) return 'RRE Setup Fee';
  if (p.includes('recurring revenue engine')) return 'Recurring Revenue Engine';
  if (p.includes('rre license')) return 'RRE License Activation';
  if (p.includes('elite retail')) return 'AEO Elite Retail';
  if (p.includes('elite - premier') || p.includes('elite premier')) return 'AEO Elite Premier';
  if (p.includes('partner subscription')) return 'AEO Elite Partner';
  if (p.includes('elite subscription')) return 'AEO Elite Subscription';
  if (p.includes('membership subscription') || p.includes('elite membership')) return 'AEO Elite Membership';
  if (p.includes('setup fee')) return 'Setup Fees';
  if (p.includes('trial')) return 'Trial (No Revenue)';
  return 'Other';
}

function generateStripeAnalysis(messages) {
  const payments = [];
  const refunds = [];
  const cancellations = [];
  const productRevenue = {};
  const customerSpend = {};

  for (const msg of messages) {
    const parsed = parseStripePayment(msg.text || '');
    if (!parsed) continue;

    if (parsed.type === 'payment' && parsed.amount > 0) {
      payments.push(parsed);
      const category = categorizeProduct(parsed.product);
      productRevenue[category] = (productRevenue[category] || 0) + parsed.amount;
      if (parsed.customer) {
        customerSpend[parsed.customer] = (customerSpend[parsed.customer] || 0) + parsed.amount;
      }
    } else if (parsed.type === 'refund') {
      refunds.push(parsed);
    } else if (parsed.type === 'cancellation') {
      cancellations.push(parsed);
    }
  }

  const totalRevenue = payments.reduce((sum, p) => sum + p.amount, 0);
  const totalRefunds = refunds.reduce((sum, r) => sum + r.amount, 0);
  const netRevenue = totalRevenue - totalRefunds;

  const sortedProducts = Object.entries(productRevenue)
    .filter(([cat]) => cat !== 'Trial (No Revenue)')
    .sort((a, b) => b[1] - a[1]);

  const topCustomers = Object.entries(customerSpend)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10);

  const productTable = sortedProducts
    .map(([product, revenue]) => `• ${product}: $${revenue.toLocaleString('en-US', { minimumFractionDigits: 2 })}`)
    .join('\n');

  const customerTable = topCustomers
    .map(([customer, spent], i) => `${i + 1}. ${customer}: $${spent.toLocaleString('en-US', { minimumFractionDigits: 2 })}`)
    .join('\n');

  return {
    summary: `*Stripe Payment Analysis*\n\n` +
      `*Overview*\n` +
      `• Total Payments: ${payments.length}\n` +
      `• Gross Revenue: $${totalRevenue.toLocaleString('en-US', { minimumFractionDigits: 2 })}\n` +
      `• Refunds: ${refunds.length} ($${totalRefunds.toLocaleString('en-US', { minimumFractionDigits: 2 })})\n` +
      `• Cancellations: ${cancellations.length}\n` +
      `• Net Revenue: $${netRevenue.toLocaleString('en-US', { minimumFractionDigits: 2 })}\n\n` +
      `*Revenue by Product*\n${productTable}\n\n` +
      `*Top 10 Customers*\n${customerTable}`,
    payments: payments.length,
    totalRevenue,
    totalRefunds,
    cancellations: cancellations.length
  };
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

async function handleStripe({ say, arg }) {
  if (!STRIPE_CHANNEL) {
    await say({ text: `*Error:* STRIPE_CHANNEL_ID environment variable not set. Please configure it with the channel ID for #stripe-payment-data.` });
    return;
  }

  try {
    const daysArg = parseInt(arg) || 7;
    const days = Math.min(Math.max(daysArg, 1), 90);
    const oldest = Math.floor((Date.now() - days * 24 * 60 * 60 * 1000) / 1000);

    await say({ text: `_Analyzing Stripe payment data from the last ${days} days..._` });

    const allMessages = [];
    let cursor;

    do {
      const result = await app.client.conversations.history({
        channel: STRIPE_CHANNEL,
        oldest: oldest.toString(),
        limit: 200,
        cursor
      });
      allMessages.push(...(result.messages || []));
      cursor = result.response_metadata?.next_cursor;
    } while (cursor);

    if (allMessages.length === 0) {
      await say({ text: `No messages found in the last ${days} days.` });
      return;
    }

    const analysis = generateStripeAnalysis(allMessages);
    await say({ text: `${analysis.summary}\n\n_Analysis period: Last ${days} days (${allMessages.length} messages scanned)_` });
  } catch (e) {
    await say({ text: `*Error reading channel:* ${e.message}\n\nMake sure the bot has been added to the #stripe-payment-data channel and has the \`channels:history\` scope.` });
  }
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
• stripe [days] – analyze Stripe payment data (default: 7 days)

Examples:
@PromptBot bundle cozy home coffee ad at dawn
@PromptBot ideogram robot barista serving latte, neon cyberpunk
@PromptBot kling teacher welcoming students, first day of school
@PromptBot stripe 30 – analyze last 30 days of payments`
  });
}

const handlers = {
  'bundle': handleBundle,
  'ideogram': handleIdeogram,
  'kling': handleKling,
  'eleven': handleEleven,
  'stripe': handleStripe,
  'analyze': handleStripe,
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

