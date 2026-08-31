const https = require('https');

function fetchUrl(url) {
  return new Promise((resolve, reject) => {
    const req = https.get(url, {
      headers: { 
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept': 'text/html,application/xhtml+xml'
      },
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

async function fetchCrunchbaseNews(competitorNames) {
  const signals = [];
  
  try {
    // Fetch Crunchbase news RSS
    const rssUrl = 'https://news.crunchbase.com/feed/';
    const xml = await fetchUrl(rssUrl);
    
    const items = xml.match(/<item>([\s\S]*?)<\/item>/gi) || [];
    
    for (const item of items.slice(0, 30)) {
      const titleMatch = item.match(/<title>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/title>/i);
      const linkMatch = item.match(/<link>([^<]+)<\/link>/);
      const pubDateMatch = item.match(/<pubDate>([^<]+)<\/pubDate>/);
      const descMatch = item.match(/<description>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/description>/i);
      
      if (!titleMatch || !linkMatch) continue;
      
      const title = titleMatch[1].replace(/<[^>]+>/g, '').trim();
      const link = linkMatch[1].trim();
      const pubDate = pubDateMatch ? new Date(pubDateMatch[1]) : new Date();
      const desc = descMatch ? descMatch[1].replace(/<[^>]+>/g, '').trim() : '';
      const combined = (title + ' ' + desc).toLowerCase();
      
      // Check for competitor mentions
      let matchedCompetitor = null;
      for (const comp of competitorNames) {
        if (combined.includes(comp.toLowerCase())) {
          matchedCompetitor = comp;
          break;
        }
      }
      
      // Also include funding/acquisition news even without competitor match
      const isFundingNews = /funding|raises|series [a-e]|seed|million|acquisition|acquires|ipo|valuation/i.test(combined);
      const isMarketingTech = /marketing|saas|crm|automation|email|funnel|landing page|seo/i.test(combined);
      
      if (matchedCompetitor || (isFundingNews && isMarketingTech)) {
        const ageHours = (Date.now() - pubDate.getTime()) / (1000 * 60 * 60);
        if (ageHours <= 168) { // Last 7 days
          signals.push({
            company: matchedCompetitor || 'Industry',
            type: 'funding',
            title: title,
            url: link,
            source: 'Crunchbase News',
            timestamp: pubDate.toISOString(),
            tag: determineCrunchbaseTag(title, desc)
          });
        }
      }
    }
  } catch (err) {
    console.error('Error fetching Crunchbase news:', err.message);
  }
  
  return signals.slice(0, 15);
}

function determineCrunchbaseTag(title, desc) {
  const combined = (title + ' ' + desc).toLowerCase();
  if (/acquisition|acquires|acquire|bought|merger/i.test(combined)) return 'acquisition';
  if (/funding|raises|series|seed|round|investment|valuation/i.test(combined)) return 'funding';
  if (/ipo|public|nasdaq|nyse/i.test(combined)) return 'funding';
  if (/layoff|cuts|downsiz/i.test(combined)) return 'hiring';
  if (/hires|appoints|joins|ceo|cto|cfo/i.test(combined)) return 'hiring';
  if (/launch|product|feature|release/i.test(combined)) return 'product';
  return 'content';
}

module.exports = { fetchCrunchbaseNews };
