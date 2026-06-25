import { pool, withTransaction } from "./db.js";
import { runMigration } from "./migrate.js";
import { generateDummyData } from "./simulation.js";

const campaignCount = Number(process.argv[2] || 28);

async function seedDatabase() {
  await runMigration();
  const data = generateDummyData({ campaignCount });

  await withTransaction(async (client) => {
    await client.query("TRUNCATE simulation_events, daily_metrics, campaigns, clients RESTART IDENTITY");

    for (const record of data.clients) {
      await client.query(
        `INSERT INTO clients (id, name, industry, contact_name, tier)
         VALUES ($1, $2, $3, $4, $5)`,
        [record.id, record.name, record.industry, record.contactName, record.tier]
      );
    }

    for (const campaign of data.campaigns) {
      await client.query(
        `INSERT INTO campaigns (
          id, client_id, client_name, market, media_format, channel, objective,
          start_date, end_date, artwork_deadline, copy_status, production_status,
          report_status, budget, behavior_profile, risk_score
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)`,
        [
          campaign.id,
          campaign.clientId,
          campaign.clientName,
          campaign.market,
          campaign.mediaFormat,
          campaign.channel,
          campaign.objective,
          campaign.startDate,
          campaign.endDate,
          campaign.artworkDeadline,
          campaign.copyStatus,
          campaign.productionStatus,
          campaign.reportStatus,
          campaign.budget,
          campaign.behaviorProfile,
          campaign.riskScore
        ]
      );
    }

    for (const metric of data.metrics) {
      await client.query(
        `INSERT INTO daily_metrics (
          campaign_id, metric_date, impressions, clicks, conversions, spend,
          revenue, engagement_rate, sentiment_score
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
        [
          metric.campaignId,
          metric.metricDate,
          metric.impressions,
          metric.clicks,
          metric.conversions,
          metric.spend,
          metric.revenue,
          metric.engagementRate,
          metric.sentimentScore
        ]
      );
    }

    for (const event of data.events) {
      await client.query(
        `INSERT INTO simulation_events (id, campaign_id, event_date, event_type, impact, notes)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [event.id, event.campaignId, event.eventDate, event.eventType, event.impact, event.notes]
      );
    }
  });

  console.log(`Seeded ${data.clients.length} clients, ${data.campaigns.length} campaigns, ${data.metrics.length} metric rows and ${data.events.length} events.`);
}

try {
  await seedDatabase();
} catch (error) {
  console.error("Seed failed.");
  console.error(error.message);
  process.exitCode = 1;
} finally {
  await pool.end();
}
