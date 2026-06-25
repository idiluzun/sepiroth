import crypto from "node:crypto";

const clients = [
  ["Nike", "Sportswear", "Amelia Carter", "Enterprise"],
  ["Spotify", "Entertainment", "Daniel Murphy", "Growth"],
  ["Turkish Airlines", "Travel", "Mina Arslan", "Enterprise"],
  ["Netflix", "Entertainment", "Rosa Marino", "Enterprise"],
  ["Sephora", "Beauty", "Layla Khan", "Growth"],
  ["Samsung", "Technology", "Jonas Weber", "Enterprise"],
  ["Adidas", "Sportswear", "Leonie Bauer", "Growth"],
  ["Booking.com", "Travel", "Eva Novak", "Enterprise"],
  ["Uber", "Mobility", "Nadia Brooks", "Growth"],
  ["Apple Music", "Entertainment", "Theo Clarke", "Growth"]
];

const markets = [
  "UK",
  "Ireland",
  "France",
  "Germany",
  "Italy",
  "Spain",
  "Middle East",
  "Netherlands",
  "Nordics",
  "UK Airports"
];

const formats = [
  "Digital Roadside",
  "Airport Digital Screens",
  "Bus Advertising",
  "Rail and Metro",
  "Premium Mall Screens",
  "Programmatic OOH",
  "Retail Digital Screens"
];

const objectives = ["Awareness", "Launch", "Footfall", "Consideration", "Conversion"];

const profiles = {
  Steady: {
    volume: 1,
    ctr: 0.012,
    conversionRate: 0.055,
    volatility: 0.12,
    approvalRisk: 0.12
  },
  Seasonal: {
    volume: 1.22,
    ctr: 0.016,
    conversionRate: 0.06,
    volatility: 0.24,
    approvalRisk: 0.18
  },
  Volatile: {
    volume: 0.92,
    ctr: 0.011,
    conversionRate: 0.042,
    volatility: 0.36,
    approvalRisk: 0.34
  },
  Premium: {
    volume: 1.1,
    ctr: 0.019,
    conversionRate: 0.075,
    volatility: 0.14,
    approvalRisk: 0.1
  }
};

const eventTypes = [
  ["Creative Revision", "Copy changed after market feedback"],
  ["Production Delay", "Production asset package arrived late"],
  ["Market Spike", "Audience activity lifted after local event"],
  ["Proof Approved", "Proof image approved by client"],
  ["Invoice Query", "Invoice requires reconciliation with booking details"]
];

function randomItem(items) {
  return items[Math.floor(Math.random() * items.length)];
}

function randomInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function randomFloat(min, max) {
  return Math.random() * (max - min) + min;
}

function addDays(date, days) {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

function isoDate(date) {
  return date.toISOString().slice(0, 10);
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function weightedStatus(profileName, deadline) {
  const profile = profiles[profileName];
  const daysUntilDeadline = Math.ceil((deadline.getTime() - Date.now()) / 86400000);
  const latePressure = daysUntilDeadline < 4 ? 0.22 : 0;
  const approvalRisk = profile.approvalRisk + latePressure;
  const copyApproved = Math.random() > approvalRisk;
  const productionDone = copyApproved && Math.random() > profile.approvalRisk * 0.8;
  const reportDone = productionDone && Math.random() > 0.68;

  return {
    copyStatus: copyApproved ? "Approved" : "Pending",
    productionStatus: productionDone ? "Complete" : "Pending",
    reportStatus: reportDone ? "Complete" : "Pending"
  };
}

function makeMetrics(campaign, profileName) {
  const profile = profiles[profileName];
  const start = new Date(campaign.startDate);
  const end = new Date(campaign.endDate);
  const days = Math.max(1, Math.ceil((end.getTime() - start.getTime()) / 86400000) + 1);
  const baseDailySpend = campaign.budget / days;
  const metrics = [];

  for (let index = 0; index < days; index += 1) {
    const date = addDays(start, index);
    const weekCurve = 1 + Math.sin((index / Math.max(days, 1)) * Math.PI) * 0.22;
    const noise = randomFloat(1 - profile.volatility, 1 + profile.volatility);
    const spend = Math.max(80, baseDailySpend * weekCurve * noise);
    const impressions = Math.round((spend / randomFloat(7.5, 13.5)) * 1000 * profile.volume);
    const clicks = Math.round(impressions * profile.ctr * randomFloat(0.82, 1.28));
    const conversions = Math.round(clicks * profile.conversionRate * randomFloat(0.75, 1.35));
    const revenue = conversions * randomFloat(38, 115);
    const engagementRate = impressions === 0 ? 0 : clicks / impressions;
    const sentimentScore = clamp(randomFloat(62, 88) + (profile.ctr - 0.012) * 500, 35, 98);

    metrics.push({
      id: crypto.randomUUID(),
      campaignId: campaign.id,
      metricDate: isoDate(date),
      impressions,
      clicks,
      conversions,
      spend: Number(spend.toFixed(2)),
      revenue: Number(revenue.toFixed(2)),
      engagementRate: Number(engagementRate.toFixed(4)),
      sentimentScore: Number(sentimentScore.toFixed(2))
    });
  }

  return metrics;
}

function makeEvents(campaign, profileName) {
  const profile = profiles[profileName];
  const eventCount = randomInt(1, profileName === "Volatile" ? 5 : 3);
  const start = new Date(campaign.startDate);
  const end = new Date(campaign.endDate);
  const duration = Math.max(1, Math.ceil((end.getTime() - start.getTime()) / 86400000));

  return Array.from({ length: eventCount }, () => {
    const [eventType, notes] = randomItem(eventTypes);
    const impact =
      eventType.includes("Delay") || eventType.includes("Query")
        ? "Negative"
        : eventType.includes("Spike")
          ? "Positive"
          : "Neutral";

    return {
      id: crypto.randomUUID(),
      campaignId: campaign.id,
      eventDate: isoDate(addDays(start, randomInt(0, duration))),
      eventType,
      impact,
      notes
    };
  });
}

export function calculateLifecycleStatus(campaign) {
  if (
    campaign.copyStatus === "Approved" &&
    campaign.productionStatus === "Complete" &&
    campaign.reportStatus === "Complete"
  ) {
    return "Complete";
  }

  const deadline = new Date(campaign.artworkDeadline);
  const daysUntilDeadline = Math.ceil((deadline.getTime() - Date.now()) / 86400000);

  if (campaign.copyStatus !== "Approved" && daysUntilDeadline < 0) {
    return "Overdue";
  }

  if (campaign.copyStatus !== "Approved" && daysUntilDeadline <= 3) {
    return "At Risk";
  }

  return "On Track";
}

export function summarizeMetrics(metrics = []) {
  const summary = metrics.reduce(
    (total, metric) => {
      total.impressions += Number(metric.impressions);
      total.clicks += Number(metric.clicks);
      total.conversions += Number(metric.conversions);
      total.spend += Number(metric.spend);
      total.revenue += Number(metric.revenue);
      total.sentiment += Number(metric.sentimentScore ?? metric.sentiment_score ?? 0);
      return total;
    },
    { impressions: 0, clicks: 0, conversions: 0, spend: 0, revenue: 0, sentiment: 0 }
  );

  const count = metrics.length || 1;
  const ctr = summary.impressions === 0 ? 0 : summary.clicks / summary.impressions;
  const roas = summary.spend === 0 ? 0 : summary.revenue / summary.spend;

  return {
    impressions: Math.round(summary.impressions),
    clicks: Math.round(summary.clicks),
    conversions: Math.round(summary.conversions),
    spend: Number(summary.spend.toFixed(2)),
    revenue: Number(summary.revenue.toFixed(2)),
    ctr: Number(ctr.toFixed(4)),
    roas: Number(roas.toFixed(2)),
    sentiment: Number((summary.sentiment / count).toFixed(1))
  };
}

export function generateDummyData({ campaignCount = 28 } = {}) {
  const clientRecords = clients.map(([name, industry, contactName, tier]) => ({
    id: crypto.randomUUID(),
    name,
    industry,
    contactName,
    tier
  }));

  const campaigns = [];
  const metrics = [];
  const events = [];
  const now = new Date();

  for (let index = 0; index < campaignCount; index += 1) {
    const client = randomItem(clientRecords);
    const profileName = randomItem(Object.keys(profiles));
    const market = randomItem(markets);
    const mediaFormat = randomItem(formats);
    const duration = randomInt(12, 42);
    const start = addDays(now, randomInt(-24, 28));
    const end = addDays(start, duration);
    const artworkDeadline = addDays(start, randomInt(-12, -3));
    const workflow = weightedStatus(profileName, artworkDeadline);
    const budget = randomInt(18000, 140000);
    const riskScore = clamp(
      Math.round(profiles[profileName].approvalRisk * 100 + randomInt(4, 36)),
      5,
      98
    );

    const campaign = {
      id: crypto.randomUUID(),
      clientId: client.id,
      clientName: client.name,
      market,
      mediaFormat,
      channel: mediaFormat.includes("Digital") ? "Digital OOH" : "Classic OOH",
      objective: randomItem(objectives),
      startDate: isoDate(start),
      endDate: isoDate(end),
      artworkDeadline: isoDate(artworkDeadline),
      copyStatus: workflow.copyStatus,
      productionStatus: workflow.productionStatus,
      reportStatus: workflow.reportStatus,
      budget,
      behaviorProfile: profileName,
      riskScore
    };

    campaigns.push(campaign);
    metrics.push(...makeMetrics(campaign, profileName));
    events.push(...makeEvents(campaign, profileName));
  }

  return { clients: clientRecords, campaigns, metrics, events };
}
