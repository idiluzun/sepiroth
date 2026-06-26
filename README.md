# Lockhart - International Media Campaign Tracker

A full-stack MVP for tracking mock international media campaigns across markets.

The product is fully self-contained: it uses a local behavior-based simulation engine to generate
clients, campaigns, lifecycle events and daily analytics data. It does not use external APIs.

## Screenshot

![CampaignSync website screenshot](./assets/campaignsync-screenshot.png)

## What It Does

- Adds campaign records with client, market, media format, dates and approval status
- Calculates automatic status labels: On Track, At Risk, Overdue or Complete
- Filters campaigns by client, market and status
- Sorts campaigns by deadline, status, client or market
- Lets users edit, delete and mark campaigns complete
- Shows dashboard totals, campaign health and simulated analytics
- Generates dummy campaign data through a Node.js backend
- Stores campaign, client, event and metrics data in PostgreSQL
- Falls back to local demo data if the backend is not running

## Simulation Engine

The dummy data generator creates:

- Clients across industries such as sportswear, travel, technology and entertainment
- Campaigns across international markets
- Media formats such as Digital Roadside, Airport Screens, Bus Advertising and Rail/Metro
- Behavior profiles: Steady, Seasonal, Volatile and Premium
- Daily metrics: impressions, clicks, conversions, spend, revenue, engagement rate and sentiment
- Lifecycle events: creative revisions, production delays, proof approval, market spikes and invoice queries

## Tech Used

- React
- TypeScript / TSX
- CSS
- Vite
- Node.js
- Express
- PostgreSQL
- `pg`

## CV Bullet

Created a full-stack International Media Campaign Tracker using React, TypeScript, Node.js and PostgreSQL, with a self-contained simulation engine generating mock campaign workflows, market data, performance metrics and lifecycle events.

## How To Run

Install dependencies:

```bash
npm install
```

Start the local app:

```bash
npm run dev
```

Start the backend API in another terminal:

```bash
npm run api
```

Build for production:

```bash
npm run build
```

## PostgreSQL Setup

Create a local PostgreSQL database called `campaign_tracker`, then copy `.env.example` to `.env`.

Default connection string:

```bash
DATABASE_URL=postgres://postgres:postgres@localhost:5432/campaign_tracker
```

Run the database schema:

```bash
npm run db:migrate
```

Generate simulated dummy data:

```bash
npm run db:seed
```

You can also regenerate dummy data from the app when the backend is connected.
