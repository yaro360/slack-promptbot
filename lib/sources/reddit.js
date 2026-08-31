const https = require('https');

const SUBREDDITS = ['Entrepreneur', 'ClickFunnels', 'SEO', 'digitalmarketing'];
const CACHE_DURATION = 60 * 60 * 1000; // 1 hour

// Reddit OAuth credentials
const REDDIT_CLIENT_ID = process.env.REDDIT_CLIENT_ID || 'AvtSgRAroZBgaV2ClP7Zug';
const REDDIT_CLIENT_SECRET = process.env.REDDIT_CLIENT_SECRET || 'KYtlQIysA6WiTquk7Qtarl-NHDvsIw';
const REDDIT_USER_AGENT = 'TestSentiment/1.0 by /u/Yavero';

let cache = { data: null, timestamp: 0 };
let accessToken = null;
let tokenExpiry = 0;

async function getAccessToken() {
  if (accessToken && Date.now() < tokenExpiry) {
    return accessToken;
  }
  
  return new Promise((resolve, reject) => {
    const auth = Buffer.from(`${REDDIT_CLIENT_ID}:${REDDIT_CLIENT_SECRET}`).toString('base64');
    
    const postData = 'grant_type=client_credentials';
    
    const options = {
      hostname: 'www.reddit.com',
      path: '/api/v1/access_token',
      method: 'POST',
      headers: {
        'Authorization': `Basic ${auth}`,
        'Content-Type': 'application/x-www-form-urlencoded',
        'Content-Length': postData.length,
        'User-Agent': REDDIT_USER_AGENT
      }
    };
    
    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const json = JSON.parse(data);
          if (json.access_token) {
            accessToken = json.access_token;
            tokenExpiry = Date.now() + (json.expires_in * 1000) - 60000; // Refresh 1 min early
            console.log('Reddit OAuth token obtained successfully');
            resolve(accessToken);
          } else {
            reject(new Error('No access token in response: ' + data));
          }
        } catch (e) {
          reject(new Error('Failed to parse token response: ' + e.message));
        }
      });
    });
    
    req.on('error', reject);
    req.setTimeout(10000, () => { req.destroy(); reject(new Error('Token request timeout')); });
    req.write(postData);
    req.end();
  });
}

async function fetchRedditAPI(endpoint) {
  const token = await getAccessToken();
  
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'oauth.reddit.com',
      path: endpoint,
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
        'User-Agent': REDDIT_USER_AGENT
      }
    };
    
    const req = https.request(options, (res) => {
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
          resolve(JSON.parse(data));
        } catch (e) {
          reject(new Error(`Failed to parse JSON: ${e.message}`));
        }
      });
    });
    
    req.on('error', reject);
    req.setTimeout(15000, () => { req.destroy(); reject(new Error('Request timeout')); });
    req.end();
  });
}

async function fetchSubreddit(subreddit, competitorNames) {
  try {
    const json = await fetchRedditAPI(`/r/${subreddit}/new?limit=50&raw_json=1`);
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
