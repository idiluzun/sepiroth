import crypto from "node:crypto";
import cors from "cors";
import dotenv from "dotenv";
import express from "express";
import { pool, query, withTransaction } from "./db.js";
import { calculateLifecycleStatus, generateDummyData, summarizeMetrics } from "./simulation.js";

dotenv.config();

const app = express();
const port = Number(process.env.PORT || 4000);
const allowedOrigins = (process.env.CLIENT_ORIGIN || "http://127.0.0.1:5173,http://127.0.0.1:5174")
  .split(",")
  .map((origin) => origin.trim());

app.use(
  cors({
    origin(origin, callback) {
      if (!origin || allowedOrigins.includes(origin)) {
        callback(null, true);
        return;
      }

      callback(new Error(`Origin ${origin} is not allowed by CORS`));
    }
  })
);
app.use(express.json({ limit: "1mb" }));

app.get("/api/health", async (_request, response) => {
  try {
    await query("SELECT 1");
    response.json({ ok: true, database: "connected" });
  } catch (error) {
    response.status(503).json({ ok: false, database: "unavailable", error: error.message });
  }
});

app.get("/api/campaigns", async (_request, response, next) => {
  try {
    const result = await query(campaignListSql());
    response.json(result.rows.map(mapCampaignRow));
  } catch (error) {
    next(error);
  }
});

app.post("/api/campaigns", async (request, response, next) => {
  try {
    const campaign = await withTransaction(async (client) => {
      const clientRecord = await findOrCreateClient(client, request.body.client);
      const campaignRecord = buildCampaignPayload(request.body, clientRecord);

      const insert = await client.query(
        `INSERT INTO campaigns (
          id, client_id, client_name, market, media_format, channel, objective,
          start_date, end_date, artwork_deadline, copy_status, production_status,
          report_status, budget, behavior_profile, risk_score
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)
        RETURNING *`,
        [
          campaignRecord.id,
          campaignRecord.clientId,
          campaignRecord.clientName,
          campaignRecord.market,
          campaignRecord.mediaFormat,
          campaignRecord.channel,
          campaignRecord.objective,
          campaignRecord.startDate,
          campaignRecord.endDate,
          campaignRecord.artworkDeadline,
          campaignRecord.copyStatus,
          campaignRecord.productionStatus,
          campaignRecord.reportStatus,
          campaignRecord.budget,
          campaignRecord.behaviorProfile,
          campaignRecord.riskScore
        ]
      );

      return insert.rows[0];
    });

    response.status(201).json(mapCampaignRow({ ...campaign, ...emptyAnalytics() }));
  } catch (error) {
    next(error);
  }
});

app.put("/api/campaigns/:id", async (request, response, next) => {
  try {
    const campaign = await withTransaction(async (client) => {
      const clientRecord = await findOrCreateClient(client, request.body.client);

      const result = await client.query(
        `UPDATE campaigns
         SET client_id = $1,
             client_name = $2,
             market = $3,
             media_format = $4,
             start_date = $5,
             end_date = $6,
             artwork_deadline = $7,
             copy_status = $8,
             production_status = $9,
             report_status = $10
         WHERE id = $11
         RETURNING *`,
        [
          clientRecord.id,
          clientRecord.name,
          request.body.market,
          request.body.mediaFormat,
          request.body.startDate,
          request.body.endDate,
          request.body.artworkDeadline,
          request.body.copyStatus,
          request.body.productionStatus,
          request.body.reportStatus,
          request.params.id
        ]
      );

      return result.rows[0];
    });

    if (!campaign) {
      response.status(404).json({ error: "Campaign not found" });
      return;
    }

    response.json(mapCampaignRow({ ...campaign, ...emptyAnalytics() }));
  } catch (error) {
    next(error);
  }
});

app.post("/api/campaigns/:id/complete", async (request, response, next) => {
  try {
    const result = await query(
      `UPDATE campaigns
       SET copy_status = 'Approved',
           production_status = 'Complete',
           report_status = 'Complete'
       WHERE id = $1
       RETURNING *`,
      [request.params.id]
    );

    if (!result.rows[0]) {
      response.status(404).json({ error: "Campaign not found" });
      return;
    }

    response.json(mapCampaignRow({ ...result.rows[0], ...emptyAnalytics() }));
  } catch (error) {
    next(error);
  }
});

app.delete("/api/campaigns/:id", async (request, response, next) => {
  try {
    const result = await query("DELETE FROM campaigns WHERE id = $1 RETURNING id", [request.params.id]);

    if (!result.rows[0]) {
      response.status(404).json({ error: "Campaign not found" });
      return;
    }

    response.status(204).send();
  } catch (error) {
    next(error);
  }
});

app.get("/api/analytics/summary", async (_request, response, next) => {
  try {
    const result = await query(campaignListSql());
    const campaigns = result.rows.map(mapCampaignRow);
    const analytics = summarizeMetrics(
      campaigns.map((campaign) => ({
        impressions: campaign.analytics.impressions,
        clicks: campaign.analytics.clicks,
        conversions: campaign.analytics.conversions,
        spend: campaign.analytics.spend,
        revenue: campaign.analytics.revenue,
        sentimentScore: campaign.analytics.sentiment
      }))
    );

    const statusCounts = campaigns.reduce(
      (summary, campaign) => {
        summary[campaign.status] += 1;
        return summary;
      },
      { "On Track": 0, "At Risk": 0, Overdue: 0, Complete: 0 }
    );

    response.json({ campaignCount: campaigns.length, statusCounts, analytics });
  } catch (error) {
    next(error);
  }
});

app.post("/api/simulation/regenerate", async (request, response, next) => {
  try {
    const campaignCount = Number(request.body?.campaignCount || 28);
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

    response.json({
      ok: true,
      generated: {
        clients: data.clients.length,
        campaigns: data.campaigns.length,
        metrics: data.metrics.length,
        events: data.events.length
      }
    });
  } catch (error) {
    next(error);
  }
});

app.use((error, _request, response, _next) => {
  console.error(error);
  response.status(500).json({ error: error.message || "Internal server error" });
});

app.listen(port, () => {
  console.log(`Campaign tracker API running on http://127.0.0.1:${port}`);
});

process.on("SIGINT", async () => {
  await pool.end();
  process.exit(0);
});

function campaignListSql() {
  return `
    WITH metric_totals AS (
      SELECT
        campaign_id,
        COALESCE(SUM(impressions), 0)::integer AS impressions,
        COALESCE(SUM(clicks), 0)::integer AS clicks,
        COALESCE(SUM(conversions), 0)::integer AS conversions,
        COALESCE(SUM(spend), 0)::numeric AS spend,
        COALESCE(SUM(revenue), 0)::numeric AS revenue,
        COALESCE(AVG(sentiment_score), 0)::numeric AS sentiment
      FROM daily_metrics
      GROUP BY campaign_id
    ),
    event_totals AS (
      SELECT campaign_id, COUNT(*)::integer AS event_count
      FROM simulation_events
      GROUP BY campaign_id
    )
    SELECT
      c.*,
      COALESCE(m.impressions, 0)::integer AS impressions,
      COALESCE(m.clicks, 0)::integer AS clicks,
      COALESCE(m.conversions, 0)::integer AS conversions,
      COALESCE(m.spend, 0)::numeric AS spend,
      COALESCE(m.revenue, 0)::numeric AS revenue,
      COALESCE(m.sentiment, 0)::numeric AS sentiment,
      COALESCE(e.event_count, 0)::integer AS event_count
    FROM campaigns c
    LEFT JOIN metric_totals m ON m.campaign_id = c.id
    LEFT JOIN event_totals e ON e.campaign_id = c.id
    ORDER BY c.artwork_deadline ASC
  `;
}

function mapCampaignRow(row) {
  const campaign = {
    id: row.id,
    client: row.client_name,
    market: row.market,
    mediaFormat: row.media_format,
    channel: row.channel,
    objective: row.objective,
    startDate: toDateString(row.start_date),
    endDate: toDateString(row.end_date),
    artworkDeadline: toDateString(row.artwork_deadline),
    copyStatus: row.copy_status,
    productionStatus: row.production_status,
    reportStatus: row.report_status,
    budget: Number(row.budget || 0),
    behaviorProfile: row.behavior_profile,
    riskScore: Number(row.risk_score || 0)
  };

  return {
    ...campaign,
    status: calculateLifecycleStatus(campaign),
    analytics: {
      impressions: Number(row.impressions || 0),
      clicks: Number(row.clicks || 0),
      conversions: Number(row.conversions || 0),
      spend: Number(row.spend || 0),
      revenue: Number(row.revenue || 0),
      sentiment: Number(row.sentiment || 0),
      eventCount: Number(row.event_count || 0),
      roas: Number(row.spend || 0) === 0 ? 0 : Number((Number(row.revenue) / Number(row.spend)).toFixed(2))
    }
  };
}

function buildCampaignPayload(body, clientRecord) {
  return {
    id: crypto.randomUUID(),
    clientId: clientRecord.id,
    clientName: clientRecord.name,
    market: body.market,
    mediaFormat: body.mediaFormat,
    channel: body.mediaFormat?.includes("Digital") ? "Digital OOH" : "Classic OOH",
    objective: body.objective || "Awareness",
    startDate: body.startDate,
    endDate: body.endDate,
    artworkDeadline: body.artworkDeadline,
    copyStatus: body.copyStatus || "Pending",
    productionStatus: body.productionStatus || "Pending",
    reportStatus: body.reportStatus || "Pending",
    budget: Number(body.budget || 32000),
    behaviorProfile: body.behaviorProfile || "Steady",
    riskScore: Number(body.riskScore || 35)
  };
}

async function findOrCreateClient(client, name) {
  const clientName = String(name || "New Client").trim();
  const existing = await client.query("SELECT * FROM clients WHERE lower(name) = lower($1) LIMIT 1", [
    clientName
  ]);

  if (existing.rows[0]) {
    return existing.rows[0];
  }

  const inserted = await client.query(
    `INSERT INTO clients (id, name, industry, contact_name, tier)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING *`,
    [crypto.randomUUID(), clientName, "Media", "Campaign Contact", "Growth"]
  );

  return inserted.rows[0];
}

function emptyAnalytics() {
  return {
    impressions: 0,
    clicks: 0,
    conversions: 0,
    spend: 0,
    revenue: 0,
    sentiment: 0,
    event_count: 0
  };
}

function toDateString(value) {
  if (!value) {
    return "";
  }

  if (typeof value === "string") {
    return value.slice(0, 10);
  }

  return value.toISOString().slice(0, 10);
}
