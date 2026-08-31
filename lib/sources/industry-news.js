const https = require('https');

function fetchUrl(url) {
  return new Promise((resolve, reject) => {
    const req = https.get(url, { 
      headers: { 'User-Agent': 'GMS_Intel_Report/1.0' },
      timeout: 15000
    }, (res) => {
      if (res.statusCode !== 200) {
        return reject(new Error(`HTTP ${res.statusCode}`));
      }
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve(data));
    });
    req.on('error', reject);
    req.on('timeout', () => { req.destroy(); reject(new Error('Timeout')); });
  });
}

function parseRSSItems(xml) {
  const items = [];
  const itemRegex = /<item>([\s\S]*?)<\/item>/gi;
  let match;
  
  while ((match = itemRegex.exec(xml)) !== null) {
    const itemXml = match[1];
    const title = extractTag(itemXml, 'title');
    const link = extractTag(itemXml, 'link');
    const pubDate = extractTag(itemXml, 'pubDate');
    const description = extractTag(itemXml, 'description');
    
    if (title && link) {
      items.push({ title, link, pubDate, description });
    }
  }
  return items;
}

function extractTag(xml, tag) {
  const cdataRegex = new RegExp(`<${tag}[^>]*><!\\[CDATA\\[([\\s\\S]*?)\\]\\]><\\/${tag}>`, 'i');
  const plainRegex = new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, 'i');
  
  let match = xml.match(cdataRegex);
  if (match) return match[1].trim();
  
  match = xml.match(plainRegex);
  if (match) return match[1].replace(/<[^>]+>/g, '').trim();
  
  return '';
}

const INDUSTRY_FEEDS = [
  { name: 'Search Engine Land', url: 'https://searchengineland.com/feed' },
  { name: 'MarTech', url: 'https://martech.org/feed/' },
  { name: 'Marketing Dive', url: 'https://www.marketingdive.com/feeds/news/' },
  { name: 'Social Media Today', url: 'https://www.socialmediatoday.com/rss.xml' },
  { name: 'Adweek', url: 'https://www.adweek.com/feed/' }
];

async function fetchIndustryNews(competitorNames, industryKeywords = []) {
  const signals = [];
  const searchTerms = [...competitorNames.map(n => n.toLowerCase()), ...industryKeywords.map(k => k.toLowerCase())];
  
  for (const feed of INDUSTRY_FEEDS) {
    try {
      const xml = await fetchUrl(feed.url);
      const items = parseRSSItems(xml);
      
      for (const item of items.slice(0, 20)) {
        const titleLower = (item.title || '').toLowerCase();
        const descLower = (item.description || '').toLowerCase();
        const combined = titleLower + ' ' + descLower;
        
        // Check for competitor/keyword matches
        let matchedTerm = null;
        for (const term of searchTerms) {
          if (combined.includes(term)) {
            matchedTerm = term;
            break;
          }
        }
        
        // Also include high-relevance industry news even without keyword match
        const isRelevant = /funding|acquisition|acquires|raises|series [a-c]|pricing|launches|announces|partnership/i.test(combined);
        
        if (matchedTerm || isRelevant) {
          const pubDate = item.pubDate ? new Date(item.pubDate) : new Date();
          const ageHours = (Date.now() - pubDate.getTime()) / (1000 * 60 * 60);
          
          if (ageHours <= 168) { // Last 7 days
            signals.push({
              company: matchedTerm ? capitalizeFirst(matchedTerm) : 'Industry',
              type: 'content',
              title: item.title,
              url: item.link,
              source: feed.name,
              timestamp: pubDate.toISOString(),
              tag: determineTag(item.title, item.description),
              keyword: matchedTerm
            });
          }
        }
      }
    } catch (err) {
      console.error(`Error fetching ${feed.name}:`, err.message);
    }
  }
  
  return signals.slice(0, 20);
}

function capitalizeFirst(str) {
  return str.charAt(0).toUpperCase() + str.slice(1);
}

function determineTag(title, description) {
  const combined = `${title} ${description}`.toLowerCase();
  if (/funding|raises|series|investment|valuation/i.test(combined)) return 'funding';
  if (/acqui|merger|buy|purchase/i.test(combined)) return 'acquisition';
  if (/partner|integration|collaborate/i.test(combined)) return 'partnership';
  if (/price|pricing|cost|plan|tier/i.test(combined)) return 'pricing';
  if (/launch|release|announce|new feature|update/i.test(combined)) return 'product';
  if (/hire|hiring|joins|appointed|ceo|cto/i.test(combined)) return 'hiring';
  return 'content';
}

module.exports = { fetchIndustryNews, INDUSTRY_FEEDS };
