const competitors = {
  tiers: {
    'Direct (Education + Community)': [
      { name: 'HubSpot Academy', domain: 'academy.hubspot.com', why: 'Free inbound training, same SMB audience' },
      { name: 'DigitalMarketer', domain: 'digitalmarketer.com', why: 'Certification-based, acquired by Spectrum Equity' },
      { name: 'CXL', domain: 'cxl.com', why: 'Advanced practitioner-led programs ($249/mo)' },
      { name: 'HubSpot Certifications', domain: 'hubspot.com/certifications', why: 'Sales & marketing certifications' },
      { name: 'MarketingProfs', domain: 'marketingprofs.com', why: 'Industry-expert training & certification' },
      { name: 'SCORE', domain: 'score.org', why: 'US-specific SMB training, $49/mo' }
    ],
    'Funnel / SaaS (Same Buyer)': [
      { name: 'ClickFunnels', domain: 'clickfunnels.com', why: 'Russell Brunson, $147/mo, overlapping audience' },
      { name: 'GoHighLevel', domain: 'gohighlevel.com', why: 'All-in-one marketing, $99/mo' },
      { name: 'Systeme.io', domain: 'systeme.io', why: 'Budget all-in-one, free tier' },
      { name: 'MailerLite', domain: 'mailerlite.com', why: 'Email + funnels, $19/mo' },
      { name: 'Unbounce', domain: 'unbounce.com', why: 'Landing pages + A/B testing, $99/mo' },
      { name: 'Leadpages', domain: 'leadpages.com', why: 'Lead gen, $37/mo' },
      { name: 'Instapage', domain: 'instapage.com', why: 'Paid-traffic post-click, $79/mo' },
      { name: 'HighLevel', domain: 'highlevel.com', why: 'Agency CRM + funnels + automation' }
    ],
    'SEO / Marketing Tools': [
      { name: 'SpyFu', domain: 'spyfu.com', why: 'SEO intelligence, $129/mo' },
      { name: 'Semrush', domain: 'semrush.com', why: 'All-in-one SEO + PPC, $299/mo' },
      { name: 'iSpionage', domain: 'ispionage.com', why: 'PPC competitor research, $39/mo' },
      { name: 'SE Ranking', domain: 'seranking.com', why: 'SEO + PPC, $15/mo' },
      { name: 'Conductor', domain: 'conductor.com', why: 'Enterprise SEO, $91.7M revenue' }
    ],
    'Automation / Email': [
      { name: 'ActiveCampaign', domain: 'activecampaign.com', why: 'Marketing automation + CRM' },
      { name: 'HubSpot', domain: 'hubspot.com', why: 'All-in-one marketing + sales' },
      { name: 'ConvertKit', domain: 'convertkit.com', why: 'Creator email marketing' },
      { name: 'Kajabi', domain: 'kajabi.com', why: 'Courses + funnels + membership' }
    ]
  },

  getAllCompetitors() {
    const all = [];
    for (const tier of Object.values(this.tiers)) {
      all.push(...tier);
    }
    return all;
  },

  getCompetitorNames() {
    return this.getAllCompetitors().map(c => c.name);
  },

  getDomains() {
    return this.getAllCompetitors().map(c => c.domain);
  }
};

const sources = {
  googleAlerts: {
    enabled: true,
    description: 'RSS feeds for each competitor name'
  },
  metaAdLibrary: {
    enabled: true,
    url: 'https://www.facebook.com/ads/library/',
    description: 'Active ad creative, spend signals'
  },
  googleAdsTransparency: {
    enabled: true,
    url: 'https://adstransparency.google.com/',
    description: 'Search + YouTube ad changes'
  },
  linkedInAdLibrary: {
    enabled: true,
    description: 'B2B ad creative & targeting'
  },
  owler: {
    enabled: true,
    url: 'https://www.owler.com/',
    description: 'Funding rounds, exec changes, strategy shifts'
  },
  brand24: {
    enabled: true,
    description: 'Brand mentions, sentiment, AI visibility'
  },
  similarweb: {
    enabled: true,
    description: 'Traffic shifts, channel mix changes'
  },
  seoTools: {
    enabled: true,
    tools: ['Ahrefs', 'Semrush'],
    description: 'SEO ranking changes, new content, backlink moves'
  },
  visualping: {
    enabled: true,
    description: 'Website/pricing page change detection'
  },
  crunchbase: {
    enabled: true,
    url: 'https://www.crunchbase.com/',
    description: 'Funding, acquisitions, new hires'
  },
  reviews: {
    enabled: true,
    platforms: ['G2', 'Capterra'],
    description: 'New reviews = product changes, churn signals'
  },
  reddit: {
    enabled: true,
    subreddits: ['Entrepreneur', 'ClickFunnels', 'SEO', 'digitalmarketing'],
    description: 'Community sentiment, complaints, feature requests'
  },
  youtube: {
    enabled: true,
    description: 'New launches, webinars, product demos'
  },
  blogs: {
    enabled: true,
    description: 'Product updates, case studies, pricing changes'
  },
  techStack: {
    enabled: true,
    tools: ['BuiltWith', 'Wappalyzer'],
    description: 'Tech stack changes (new tools adopted)'
  }
};

const schedule = {
  frequency: 'daily',
  time: '08:00',
  timezone: 'America/New_York',
  channel: 'competitive-intel'
};

const signalTags = [
  'funding',
  'product',
  'pricing',
  'content',
  'hiring',
  'ad',
  'review',
  'sentiment',
  'partnership',
  'acquisition'
];

module.exports = {
  competitors,
  sources,
  schedule,
  signalTags
};
