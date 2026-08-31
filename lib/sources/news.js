const https = require('https');

function fetchJSON(url) {
  return new Promise((resolve, reject) => {
    const req = https.get(url, { headers: { 'User-Agent': 'CompetitiveIntelBot/1.0' } }, (res) => {
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
    req.setTimeout(10000, () => {
      req.destroy();
      reject(new Error('Request timeout'));
    });
  });
}

async function fetchHackerNews(competitorNames) {
  const signals = [];
  
  try {
    const topStoriesUrl = 'https://hacker-news.firebaseio.com/v0/newstories.json';
    const storyIds = await fetchJSON(topStoriesUrl);
    
    if (!Array.isArray(storyIds)) {
      console.error('HN API returned non-array:', typeof storyIds);
      return signals;
    }
    
    const storyPromises = storyIds.slice(0, 50).map(id => 
      fetchJSON(`https://hacker-news.firebaseio.com/v0/item/${id}.json`)
        .catch(() => null)
    );
    
    const stories = await Promise.all(storyPromises);
    
    for (const story of stories.filter(Boolean)) {
      const title = (story.title || '').toLowerCase();
      const url = story.url || '';
      
      for (const competitor of competitorNames) {
        const lowerName = competitor.toLowerCase();
        if (title.includes(lowerName) || url.toLowerCase().includes(lowerName.replace(/\s+/g, ''))) {
          const ageHours = (Date.now() / 1000 - story.time) / 3600;
          if (ageHours <= 24) {
            signals.push({
              company: competitor,
              type: 'content',
              title: story.title,
              url: story.url || `https://news.ycombinator.com/item?id=${story.id}`,
              source: 'Hacker News',
              score: story.score,
              comments: story.descendants || 0,
              timestamp: new Date(story.time * 1000).toISOString(),
              tag: 'content'
            });
          }
        }
      }
    }
  } catch (err) {
    console.error('Error fetching HN:', err.message);
  }
  
  return signals;
}

async function fetchProductHunt(competitorNames) {
  const signals = [];
  
  try {
    for (const competitor of competitorNames.slice(0, 5)) {
      signals.push({
        company: competitor,
        type: 'product',
        title: `Check Product Hunt for ${competitor} launches`,
        url: `https://www.producthunt.com/search?q=${encodeURIComponent(competitor)}`,
        source: 'Product Hunt (manual check)',
        timestamp: new Date().toISOString(),
        tag: 'product',
        needsManualCheck: true
      });
    }
  } catch (err) {
    console.error('Error with Product Hunt:', err.message);
  }
  
  return signals.slice(0, 5);
}

async function fetchProductHuntNews(competitorNames) {
  const signals = [];
  
  try {
    const rssUrl = 'https://www.producthunt.com/feed';
    const https = require('https');
    
    const xml = await new Promise((resolve, reject) => {
      const req = https.get(rssUrl, { 
        headers: { 'User-Agent': 'GMS_Intel_Report/1.0' },
        timeout: 10000
      }, (res) => {
        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => resolve(data));
      });
      req.on('error', reject);
      req.on('timeout', () => { req.destroy(); reject(new Error('Timeout')); });
    });
    
    const { parseXML } = require('./rss');
    const items = parseXML(xml);
    
    for (const item of items.slice(0, 30)) {
      const titleLower = (item.title || '').toLowerCase();
      const descLower = (item.description || '').toLowerCase();
      
      for (const competitor of competitorNames) {
        const lowerName = competitor.toLowerCase();
        if (titleLower.includes(lowerName) || descLower.includes(lowerName)) {
          signals.push({
            company: competitor,
            type: 'product',
            title: item.title,
            url: item.link,
            source: 'Product Hunt',
            timestamp: item.pubDate || new Date().toISOString(),
            tag: 'product'
          });
        }
      }
    }
  } catch (err) {
    console.error('Error fetching Product Hunt RSS:', err.message);
  }
  
  return signals;
}

async function fetchTechCrunch(competitorNames) {
  const signals = [];
  
  try {
    const rssUrl = 'https://techcrunch.com/feed/';
    const https = require('https');
    
    const xml = await new Promise((resolve, reject) => {
      https.get(rssUrl, { headers: { 'User-Agent': 'CompetitiveIntelBot/1.0' } }, (res) => {
        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => resolve(data));
      }).on('error', reject);
    });
    
    const { parseXML } = require('./rss');
    const items = parseXML(xml);
    
    for (const item of items) {
      const titleLower = (item.title || '').toLowerCase();
      const descLower = (item.description || '').toLowerCase();
      
      for (const competitor of competitorNames) {
        const lowerName = competitor.toLowerCase();
        if (titleLower.includes(lowerName) || descLower.includes(lowerName)) {
          const pubDate = new Date(item.pubDate);
          const ageHours = (Date.now() - pubDate.getTime()) / (1000 * 60 * 60);
          if (ageHours <= 24) {
            signals.push({
              company: competitor,
              type: 'content',
              title: item.title,
              url: item.link,
              source: 'TechCrunch',
              timestamp: item.pubDate,
              tag: determineFundingTag(item.title, item.description)
            });
          }
        }
      }
    }
  } catch (err) {
    console.error('Error fetching TechCrunch:', err.message);
  }
  
  return signals;
}

function determineFundingTag(title, description) {
  const combined = `${title} ${description}`.toLowerCase();
  if (/funding|raise|series|round|valuation|invest/i.test(combined)) return 'funding';
  if (/acquire|acquisition|buy|merge/i.test(combined)) return 'acquisition';
  if (/launch|release|announce|new/i.test(combined)) return 'product';
  if (/hire|appoint|join|ceo|cto/i.test(combined)) return 'hiring';
  return 'content';
}

module.exports = { fetchHackerNews, fetchProductHunt, fetchTechCrunch, fetchProductHuntNews };
