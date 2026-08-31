const { competitors } = require('../../config/competitors');

function generateWeeklyCheckItems() {
  const items = [];
  const competitorNames = competitors.getCompetitorNames();
  const topCompetitors = competitorNames.slice(0, 10);
  
  // Ad Libraries - Manual checks needed
  items.push({
    company: 'All Competitors',
    type: 'ad',
    title: '🔍 Check Meta Ad Library for competitor ad creative changes',
    url: `https://www.facebook.com/ads/library/?active_status=active&ad_type=all&country=US&q=${encodeURIComponent(topCompetitors[0])}`,
    source: 'Meta Ad Library',
    timestamp: new Date().toISOString(),
    tag: 'ad',
    isActionItem: true
  });
  
  items.push({
    company: 'All Competitors',
    type: 'ad',
    title: '🔍 Check Google Ads Transparency Center for search ad changes',
    url: 'https://adstransparency.google.com/',
    source: 'Google Ads Transparency',
    timestamp: new Date().toISOString(),
    tag: 'ad',
    isActionItem: true
  });
  
  items.push({
    company: 'All Competitors',
    type: 'ad',
    title: '🔍 Check LinkedIn Ad Library for B2B ad creative',
    url: 'https://www.linkedin.com/ad-library/',
    source: 'LinkedIn Ad Library',
    timestamp: new Date().toISOString(),
    tag: 'ad',
    isActionItem: true
  });
  
  // Pricing page monitoring
  const pricingChecks = topCompetitors.slice(0, 5).map(comp => {
    const domain = competitors.getAllCompetitors().find(c => c.name === comp)?.domain || '';
    return {
      company: comp,
      type: 'pricing',
      title: `💵 Check ${comp} pricing page for changes`,
      url: `https://${domain}/pricing`,
      source: 'Pricing Monitor',
      timestamp: new Date().toISOString(),
      tag: 'pricing',
      isActionItem: true
    };
  });
  items.push(...pricingChecks);
  
  // Crunchbase company profiles for funding/hiring
  items.push({
    company: 'Key Competitors',
    type: 'funding',
    title: '💰 Check Crunchbase for funding rounds & acquisitions',
    url: `https://www.crunchbase.com/search/organizations/field/organizations/categories/marketing-automation`,
    source: 'Crunchbase',
    timestamp: new Date().toISOString(),
    tag: 'funding',
    isActionItem: true
  });
  
  // Owler for strategy shifts
  items.push({
    company: 'Key Competitors',
    type: 'content',
    title: '📊 Check Owler for competitor strategy updates',
    url: 'https://www.owler.com/',
    source: 'Owler',
    timestamp: new Date().toISOString(),
    tag: 'content',
    isActionItem: true
  });
  
  // YouTube competitor channels
  items.push({
    company: 'All Competitors',
    type: 'content',
    title: '📺 Check competitor YouTube channels for new product videos',
    url: 'https://www.youtube.com/results?search_query=clickfunnels+2024&sp=CAI%253D',
    source: 'YouTube',
    timestamp: new Date().toISOString(),
    tag: 'content',
    isActionItem: true
  });
  
  // Similarweb for traffic
  items.push({
    company: 'Key Competitors',
    type: 'content',
    title: '📈 Check Similarweb for traffic trend changes',
    url: 'https://www.similarweb.com/',
    source: 'Similarweb',
    timestamp: new Date().toISOString(),
    tag: 'content',
    isActionItem: true
  });
  
  return items;
}

function generateCompetitorBlogLinks() {
  const allComps = competitors.getAllCompetitors();
  return allComps.slice(0, 10).map(comp => ({
    company: comp.name,
    type: 'content',
    title: `📝 Check ${comp.name} blog for updates`,
    url: `https://${comp.domain}/blog`,
    source: 'Competitor Blog',
    timestamp: new Date().toISOString(),
    tag: 'content',
    isActionItem: true
  }));
}

module.exports = { generateWeeklyCheckItems, generateCompetitorBlogLinks };
