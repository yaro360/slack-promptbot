const https = require('https');

const SUBREDDITS = ['Entrepreneur', 'ClickFunnels', 'SEO', 'digitalmarketing'];
const CACHE_DURATION = 60 * 60 * 1000; // 1 hour

let cache = { data: null, timestamp: 0 };

function fetchJSON(url) {
  return new Promise((resolve, reject) => {
    const options = {
      headers: { 
        'User-Agent': 'GMS_Intel_Report/1.0 (Competitive Intelligence Bot)',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8'
      }
    };
    
    const req = https.get(url, options, (res) => {
      if (res.statusCode === 429) {
        return reject(new Error('Rate limited by Reddit'));
      }
      if (res.statusCode !== 200) {
        return reject(new Error(`HTTP ${res.statusCode}`));
      }
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          if (data.trim().startsWith('<')) {
            return reject(new Error('Received HTML instead of JSON'));
          }
          resolve(JSON.parse(data));
        } catch (e) {
          reject(new Error(`Failed to parse JSON: ${e.message}`));
        }
      });
    });
    req.on('error', reject);
    req.setTimeout(15000, () => {
      req.destroy();
      reject(new Error('Request timeout'));
    });
  });
}

async function fetchWithRetry(url, retries = 2) {
  for (let i = 0; i <= retries; i++) {
    try {
      await new Promise(r => setTimeout(r, i * 2000));
      return await fetchJSON(url);
    } catch (err) {
      if (i === retries) throw err;
    }
  }
}

async function fetchSubreddit(subreddit, competitorNames) {
  const url = `https://www.reddit.com/r/${subreddit}/new.json?limit=50&raw_json=1`;
  try {
    const json = await fetchWithRetry(url);
    const posts = json?.data?.children || [];
    
    const signals = [];
    for (const post of posts) {
      const data = post.data;
      const title = (data.title || '').toLowerCase();
      const text = (data.selftext || '').toLowerCase();
      const combined = `${title} ${text}`;
      
      for (const competitor of competitorNames) {
        const lowerName = competitor.toLowerCase();
        if (combined.includes(lowerName)) {
          const ageHours = (Date.now() / 1000 - data.created_utc) / 3600;
          if (ageHours <= 24) {
            signals.push({
              company: competitor,
              type: 'sentiment',
              title: data.title,
              url: `https://reddit.com${data.permalink}`,
              source: `r/${subreddit}`,
              score: data.score,
              comments: data.num_comments,
              timestamp: new Date(data.created_utc * 1000).toISOString(),
              tag: determineSentimentTag(title, text)
            });
          }
        }
      }
    }
    return signals;
  } catch (err) {
    console.error(`Error fetching r/${subreddit}:`, err.message);
    return [];
  }
}

function determineSentimentTag(title, text) {
  const combined = `${title} ${text}`;
  if (/price|pricing|cost|expensive|cheap|afford/i.test(combined)) return 'pricing';
  if (/bug|issue|problem|broken|error|crash/i.test(combined)) return 'review';
  if (/new feature|update|release|launch|announce/i.test(combined)) return 'product';
  if (/love|great|awesome|recommend|best/i.test(combined)) return 'sentiment';
  if (/hate|terrible|worst|avoid|scam/i.test(combined)) return 'sentiment';
  return 'sentiment';
}

async function fetchRedditSignals(competitorNames) {
  if (cache.data && Date.now() - cache.timestamp < CACHE_DURATION) {
    return cache.data;
  }

  const allSignals = [];
  for (const sub of SUBREDDITS) {
    const signals = await fetchSubreddit(sub, competitorNames);
    allSignals.push(...signals);
    await new Promise(r => setTimeout(r, 1000));
  }

  const uniqueSignals = dedupeSignals(allSignals);
  cache = { data: uniqueSignals, timestamp: Date.now() };
  return uniqueSignals;
}

function dedupeSignals(signals) {
  const seen = new Set();
  return signals.filter(s => {
    const key = `${s.company}-${s.url}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

module.exports = { fetchRedditSignals, SUBREDDITS };
