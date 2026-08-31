const https = require('https');

const COMPETITOR_CHANNELS = {
  'ClickFunnels': 'UCrEIOeOHiJPC6kXCwIJn0sw',
  'HubSpot': 'UCPUpo1MiGwmHxZ8Pf4bk_lA',
  'Semrush': 'UCVHdZRd2KEdFjbMqifD51pg',
  'ActiveCampaign': 'UCz8aNrXCMSi4sMmXQiV0jrg',
  'GoHighLevel': 'UCXf2F9GgrtkWTdfnl2EAR0g',
  'ConvertKit': 'UCK9cLOLfm0xbdFz7fLHqY-A',
  'Kajabi': 'UCY_1q9M3vHxzJJnbN2K9AkA',
  'Leadpages': 'UCl6IbQmKsXsYnzjJjLMGNbw',
  'Unbounce': 'UCrF0mhjwqyqJ4AJj3F2SkOA'
};

function fetchJSON(url) {
  return new Promise((resolve, reject) => {
    const req = https.get(url, {
      headers: { 'User-Agent': 'GMS_Intel_Report/1.0' },
      timeout: 10000
    }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          resolve(JSON.parse(data));
        } catch (e) {
          reject(new Error('JSON parse error'));
        }
      });
    });
    req.on('error', reject);
    req.on('timeout', () => { req.destroy(); reject(new Error('Timeout')); });
  });
}

function fetchUrl(url) {
  return new Promise((resolve, reject) => {
    const req = https.get(url, {
      headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' },
      timeout: 15000
    }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve(data));
    });
    req.on('error', reject);
    req.on('timeout', () => { req.destroy(); reject(new Error('Timeout')); });
  });
}

async function fetchYouTubeRSS(channelId, competitorName) {
  const signals = [];
  const rssUrl = `https://www.youtube.com/feeds/videos.xml?channel_id=${channelId}`;
  
  try {
    const xml = await fetchUrl(rssUrl);
    
    const entries = xml.match(/<entry>([\s\S]*?)<\/entry>/gi) || [];
    
    for (const entry of entries.slice(0, 5)) {
      const titleMatch = entry.match(/<title>([^<]+)<\/title>/);
      const linkMatch = entry.match(/<link rel="alternate" href="([^"]+)"/);
      const publishedMatch = entry.match(/<published>([^<]+)<\/published>/);
      
      if (titleMatch && linkMatch) {
        const title = titleMatch[1];
        const url = linkMatch[1];
        const published = publishedMatch ? new Date(publishedMatch[1]) : new Date();
        const ageHours = (Date.now() - published.getTime()) / (1000 * 60 * 60);
        
        if (ageHours <= 168) { // Last 7 days
          signals.push({
            company: competitorName,
            type: 'content',
            title: `📺 ${title}`,
            url: url,
            source: 'YouTube',
            timestamp: published.toISOString(),
            tag: determineVideoTag(title)
          });
        }
      }
    }
  } catch (err) {
    console.error(`Error fetching YouTube for ${competitorName}:`, err.message);
  }
  
  return signals;
}

function determineVideoTag(title) {
  const lower = title.toLowerCase();
  if (/launch|new|introducing|announcing|release/i.test(lower)) return 'product';
  if (/webinar|live|training|tutorial/i.test(lower)) return 'content';
  if (/pricing|plan|cost/i.test(lower)) return 'pricing';
  if (/update|feature/i.test(lower)) return 'product';
  return 'content';
}

async function fetchCompetitorYouTube() {
  const signals = [];
  
  for (const [name, channelId] of Object.entries(COMPETITOR_CHANNELS)) {
    const channelSignals = await fetchYouTubeRSS(channelId, name);
    signals.push(...channelSignals);
    await new Promise(r => setTimeout(r, 500)); // Rate limit
  }
  
  return signals;
}

module.exports = { fetchCompetitorYouTube, COMPETITOR_CHANNELS };
