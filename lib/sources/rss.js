const https = require('https');
const http = require('http');

function parseXML(xml) {
  const items = [];
  const itemRegex = /<item>([\s\S]*?)<\/item>/gi;
  let match;
  
  while ((match = itemRegex.exec(xml)) !== null) {
    const itemXml = match[1];
    const title = extractTag(itemXml, 'title');
    const link = extractTag(itemXml, 'link');
    const pubDate = extractTag(itemXml, 'pubDate');
    const description = extractTag(itemXml, 'description');
    
    items.push({ title, link, pubDate, description });
  }
  return items;
}

function extractTag(xml, tag) {
  const regex = new RegExp(`<${tag}[^>]*><!\\[CDATA\\[([\\s\\S]*?)\\]\\]><\\/${tag}>|<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, 'i');
  const match = xml.match(regex);
  return match ? (match[1] || match[2] || '').trim() : '';
}

function fetchUrl(url) {
  return new Promise((resolve, reject) => {
    const protocol = url.startsWith('https') ? https : http;
    const req = protocol.get(url, { headers: { 'User-Agent': 'CompetitiveIntelBot/1.0' } }, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        return fetchUrl(res.headers.location).then(resolve).catch(reject);
      }
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve(data));
    });
    req.on('error', reject);
    req.setTimeout(15000, () => {
      req.destroy();
      reject(new Error('Request timeout'));
    });
  });
}

async function fetchGoogleAlerts(competitorName) {
  const alertUrl = `https://www.google.com/alerts/feeds/${encodeURIComponent(competitorName)}`;
  try {
    const xml = await fetchUrl(alertUrl);
    const items = parseXML(xml);
    
    return items
      .filter(item => {
        const pubDate = new Date(item.pubDate);
        const ageHours = (Date.now() - pubDate.getTime()) / (1000 * 60 * 60);
        return ageHours <= 24;
      })
      .map(item => ({
        company: competitorName,
        type: 'content',
        title: item.title.replace(/<[^>]+>/g, ''),
        url: item.link,
        source: 'Google Alerts',
        timestamp: item.pubDate,
        tag: determineContentTag(item.title, item.description)
      }));
  } catch (err) {
    console.error(`Error fetching Google Alerts for ${competitorName}:`, err.message);
    return [];
  }
}

function determineContentTag(title, description) {
  const combined = `${title} ${description}`.toLowerCase();
  if (/funding|raise|invest|series|round/i.test(combined)) return 'funding';
  if (/acquire|acquisition|merger|buy/i.test(combined)) return 'acquisition';
  if (/partner|partnership|collaborate|integrat/i.test(combined)) return 'partnership';
  if (/hire|hiring|joins|appointed|ceo|cto|vp/i.test(combined)) return 'hiring';
  if (/price|pricing|cost|discount|deal/i.test(combined)) return 'pricing';
  if (/launch|release|new feature|update|announce/i.test(combined)) return 'product';
  return 'content';
}

async function fetchCompetitorBlog(domain, competitorName) {
  const feedUrls = [
    `https://${domain}/feed`,
    `https://${domain}/blog/feed`,
    `https://${domain}/rss`,
    `https://${domain}/blog/rss.xml`,
    `https://blog.${domain}/feed`
  ];

  for (const feedUrl of feedUrls) {
    try {
      const xml = await fetchUrl(feedUrl);
      if (xml.includes('<rss') || xml.includes('<feed')) {
        const items = parseXML(xml);
        return items
          .filter(item => {
            const pubDate = new Date(item.pubDate);
            const ageHours = (Date.now() - pubDate.getTime()) / (1000 * 60 * 60);
            return ageHours <= 24;
          })
          .map(item => ({
            company: competitorName,
            type: 'content',
            title: item.title.replace(/<[^>]+>/g, ''),
            url: item.link,
            source: `${competitorName} Blog`,
            timestamp: item.pubDate,
            tag: determineContentTag(item.title, item.description)
          }));
      }
    } catch {
      continue;
    }
  }
  return [];
}

module.exports = { fetchGoogleAlerts, fetchCompetitorBlog, parseXML };
