const { competitors, sources, schedule, signalTags, industryKeywords } = require('../config/competitors');
const { fetchRedditSignals } = require('./sources/reddit');
const { fetchGoogleAlerts, fetchCompetitorBlog } = require('./sources/rss');
const { fetchHackerNews, fetchTechCrunch, fetchProductHuntNews } = require('./sources/news');
const { fetchReviewSignals } = require('./sources/reviews');
const { fetchIndustryNews } = require('./sources/industry-news');

const ACTIONABLE_THRESHOLD = {
  reddit: { minScore: 10, minComments: 5 },
  news: { minScore: 50 },
  default: { minRelevance: 0.5 }
};

async function collectAllSignals() {
  const competitorNames = competitors.getCompetitorNames();
  const allCompetitors = competitors.getAllCompetitors();
  
  console.log(`Collecting signals for ${competitorNames.length} competitors...`);
  
  const fetchTasks = [
    fetchHackerNews(competitorNames, industryKeywords),
    fetchTechCrunch(competitorNames),
    fetchProductHuntNews(competitorNames),
    fetchIndustryNews(competitorNames, industryKeywords),
    ...competitorNames.slice(0, 10).map(name => fetchGoogleAlerts(name)),
    ...allCompetitors.slice(0, 10).map(c => fetchCompetitorBlog(c.domain, c.name)),
    fetchReviewSignals(competitorNames.slice(0, 10))
  ];
  
  if (sources.reddit.enabled) {
    console.log('Reddit enabled - fetching subreddit signals...');
    fetchTasks.push(fetchRedditSignals(competitorNames));
  } else {
    console.log('Reddit disabled - skipping subreddit signals');
  }
  
  const results = await Promise.allSettled(fetchTasks);
  
  const signals = [];
  for (const result of results) {
    if (result.status === 'fulfilled' && Array.isArray(result.value)) {
      signals.push(...result.value);
    }
  }
  
  return signals;
}

function isActionable(signal) {
  if (signal.needsManualCheck) return true;
  
  if (signal.source?.includes('Reddit')) {
    return signal.score >= ACTIONABLE_THRESHOLD.reddit.minScore || 
           signal.comments >= ACTIONABLE_THRESHOLD.reddit.minComments;
  }
  
  if (signal.source === 'Hacker News') {
    return signal.score >= ACTIONABLE_THRESHOLD.news.minScore;
  }
  
  const highPriorityTags = ['funding', 'acquisition', 'pricing', 'product', 'partnership'];
  if (highPriorityTags.includes(signal.tag)) {
    return true;
  }
  
  return true;
}

function filterActionableSignals(signals) {
  return signals.filter(isActionable);
}

function dedupeSignals(signals) {
  const seen = new Map();
  
  for (const signal of signals) {
    const key = `${signal.company}-${signal.title?.slice(0, 50)}`;
    const existing = seen.get(key);
    
    if (!existing) {
      seen.set(key, signal);
    } else if (signal.score > (existing.score || 0)) {
      seen.set(key, signal);
    }
  }
  
  return Array.from(seen.values());
}

function prioritizeSignals(signals) {
  const tagPriority = {
    funding: 10,
    acquisition: 10,
    pricing: 9,
    product: 8,
    partnership: 7,
    hiring: 6,
    ad: 5,
    review: 4,
    sentiment: 3,
    content: 2
  };
  
  return signals.sort((a, b) => {
    const priorityA = tagPriority[a.tag] || 1;
    const priorityB = tagPriority[b.tag] || 1;
    
    if (priorityB !== priorityA) return priorityB - priorityA;
    
    return new Date(b.timestamp || 0) - new Date(a.timestamp || 0);
  });
}

function formatSignalForSlack(signal) {
  const tagEmoji = {
    funding: '💰',
    acquisition: '🤝',
    pricing: '💵',
    product: '🚀',
    partnership: '🤝',
    hiring: '👤',
    ad: '📢',
    review: '⭐',
    sentiment: '💬',
    content: '📝'
  };
  
  const emoji = tagEmoji[signal.tag] || '📌';
  const tag = signal.tag?.toUpperCase() || 'INFO';
  const company = signal.company || 'Unknown';
  const title = signal.title || 'No title';
  const url = signal.url || '#';
  const source = signal.source || 'Unknown';
  
  return `${emoji} *[${company}]* — ${title} — <${url}|${source}>\n   _Tag: ${tag}_`;
}

function formatDigestMessage(signals, date) {
  if (signals.length === 0) {
    return `📊 *Competitive Intelligence Daily Digest*\n_${date}_\n\nNo actionable signals detected in the last 24 hours. All quiet on the competitive front.`;
  }
  
  const header = `📊 *Competitive Intelligence Daily Digest*\n_${date}_\n\n*${signals.length} actionable signal${signals.length === 1 ? '' : 's'} detected:*\n\n`;
  
  const groupedByTag = {};
  for (const signal of signals) {
    const tag = signal.tag || 'other';
    if (!groupedByTag[tag]) groupedByTag[tag] = [];
    groupedByTag[tag].push(signal);
  }
  
  let body = '';
  const tagOrder = ['funding', 'acquisition', 'pricing', 'product', 'partnership', 'hiring', 'ad', 'review', 'sentiment', 'content'];
  
  for (const tag of tagOrder) {
    const tagSignals = groupedByTag[tag];
    if (tagSignals && tagSignals.length > 0) {
      body += `\n*━━━ ${tag.toUpperCase()} ━━━*\n`;
      for (const signal of tagSignals.slice(0, 5)) {
        body += formatSignalForSlack(signal) + '\n';
      }
      if (tagSignals.length > 5) {
        body += `   _...and ${tagSignals.length - 5} more ${tag} signals_\n`;
      }
    }
  }
  
  const footer = `\n---\n_Monitoring ${competitors.getCompetitorNames().length} competitors across ${Object.keys(sources).length} data sources_`;
  
  return header + body + footer;
}

async function generateDailyDigest() {
  console.log('Starting daily competitive intelligence collection...');
  
  try {
    const rawSignals = await collectAllSignals();
    console.log(`Collected ${rawSignals.length} raw signals`);
    
    const actionableSignals = filterActionableSignals(rawSignals);
    console.log(`Filtered to ${actionableSignals.length} actionable signals`);
    
    const dedupedSignals = dedupeSignals(actionableSignals);
    console.log(`Deduped to ${dedupedSignals.length} unique signals`);
    
    const prioritizedSignals = prioritizeSignals(dedupedSignals);
    
    const date = new Date().toLocaleDateString('en-US', { 
      weekday: 'long', 
      year: 'numeric', 
      month: 'long', 
      day: 'numeric',
      timeZone: 'America/New_York'
    });
    
    const message = formatDigestMessage(prioritizedSignals.slice(0, 25), date);
    
    return {
      success: true,
      signalCount: prioritizedSignals.length,
      message,
      signals: prioritizedSignals.slice(0, 25)
    };
  } catch (err) {
    console.error('Error generating daily digest:', err);
    return {
      success: false,
      error: err.message,
      message: `⚠️ *Competitive Intelligence Error*\n\nFailed to generate daily digest: ${err.message}\n\nPlease check the bot logs for details.`
    };
  }
}

async function checkForUrgentSignals() {
  const urgentTags = ['funding', 'acquisition', 'pricing'];
  
  try {
    const signals = await collectAllSignals();
    const urgent = signals.filter(s => 
      urgentTags.includes(s.tag) && 
      isActionable(s)
    );
    
    return urgent;
  } catch (err) {
    console.error('Error checking urgent signals:', err);
    return [];
  }
}

module.exports = {
  collectAllSignals,
  generateDailyDigest,
  checkForUrgentSignals,
  formatSignalForSlack,
  formatDigestMessage,
  filterActionableSignals,
  prioritizeSignals,
  dedupeSignals
};
