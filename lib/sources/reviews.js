const https = require('https');

function fetchUrl(url) {
  return new Promise((resolve, reject) => {
    const req = https.get(url, { 
      headers: { 
        'User-Agent': 'Mozilla/5.0 (compatible; CompetitiveIntelBot/1.0)',
        'Accept': 'text/html,application/xhtml+xml,application/xml'
      } 
    }, (res) => {
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

function extractG2Reviews(html, competitorName) {
  const signals = [];
  
  const ratingMatch = html.match(/(\d+\.?\d*)\s*(?:out of 5|\/5|stars?)/i);
  const reviewCountMatch = html.match(/(\d+(?:,\d+)?)\s*reviews?/i);
  
  if (ratingMatch || reviewCountMatch) {
    signals.push({
      company: competitorName,
      type: 'review',
      title: `G2 rating check: ${ratingMatch ? ratingMatch[1] + '/5' : 'N/A'} (${reviewCountMatch ? reviewCountMatch[1] : 'N/A'} reviews)`,
      url: `https://www.g2.com/search?query=${encodeURIComponent(competitorName)}`,
      source: 'G2 (automated check)',
      timestamp: new Date().toISOString(),
      tag: 'review'
    });
  }
  
  return signals;
}

async function checkG2Reviews(competitorNames) {
  const signals = [];
  
  for (const competitor of competitorNames) {
    const searchUrl = `https://www.g2.com/search?query=${encodeURIComponent(competitor)}`;
    signals.push({
      company: competitor,
      type: 'review',
      title: `Check G2 reviews for ${competitor}`,
      url: searchUrl,
      source: 'G2 (manual check recommended)',
      timestamp: new Date().toISOString(),
      tag: 'review',
      needsManualCheck: true
    });
  }
  
  return signals.slice(0, 10);
}

async function checkCapterraReviews(competitorNames) {
  const signals = [];
  
  for (const competitor of competitorNames) {
    const searchUrl = `https://www.capterra.com/search/?search=${encodeURIComponent(competitor)}`;
    signals.push({
      company: competitor,
      type: 'review',
      title: `Check Capterra reviews for ${competitor}`,
      url: searchUrl,
      source: 'Capterra (manual check recommended)',
      timestamp: new Date().toISOString(),
      tag: 'review',
      needsManualCheck: true
    });
  }
  
  return signals.slice(0, 10);
}

async function fetchReviewSignals(competitorNames) {
  const [g2, capterra] = await Promise.all([
    checkG2Reviews(competitorNames),
    checkCapterraReviews(competitorNames)
  ]);
  
  const manualCheckSignals = [...g2, ...capterra].filter(s => s.needsManualCheck);
  
  if (manualCheckSignals.length > 0) {
    return [{
      company: 'Multiple',
      type: 'review',
      title: 'Daily review platform check recommended',
      url: 'https://www.g2.com/',
      source: 'G2 & Capterra',
      timestamp: new Date().toISOString(),
      tag: 'review',
      details: `Check ${competitorNames.slice(0, 5).join(', ')} on review platforms`
    }];
  }
  
  return [];
}

module.exports = { fetchReviewSignals, checkG2Reviews, checkCapterraReviews };
