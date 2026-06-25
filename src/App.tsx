import { FormEvent, ReactNode, useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  ArrowUpDown,
  BarChart3,
  CheckCircle2,
  Clock3,
  Edit3,
  Filter,
  Plus,
  RefreshCcw,
  Save,
  Search,
  Trash2
} from "lucide-react";

type WorkflowStatus = "Pending" | "Approved" | "Complete";
type CampaignStatus = "On Track" | "At Risk" | "Overdue" | "Complete";
type SortKey = "deadline" | "client" | "market" | "status";
type ViewMode = "All" | "Needs Action" | "Complete";

type Campaign = {
  id: string;
  client: string;
  market: string;
  mediaFormat: string;
  channel?: string;
  objective?: string;
  startDate: string;
  endDate: string;
  artworkDeadline: string;
  copyStatus: "Pending" | "Approved";
  productionStatus: "Pending" | "Complete";
  reportStatus: "Pending" | "Complete";
  budget?: number;
  behaviorProfile?: string;
  riskScore?: number;
  analytics?: CampaignAnalytics;
};

type CampaignForm = Omit<Campaign, "id">;
type ApiStatus = "checking" | "connected" | "offline";

type CampaignAnalytics = {
  impressions: number;
  clicks: number;
  conversions: number;
  spend: number;
  revenue: number;
  sentiment: number;
  eventCount: number;
  roas: number;
};

const STORAGE_KEY = "internationalCampaignTrackerTsx";
const API_URL = import.meta.env.VITE_API_URL || "http://127.0.0.1:4000";

const emptyForm: CampaignForm = {
  client: "",
  market: "",
  mediaFormat: "",
  objective: "Awareness",
  startDate: "",
  endDate: "",
  artworkDeadline: "",
  copyStatus: "Pending",
  productionStatus: "Pending",
  reportStatus: "Pending",
  budget: 32000,
  behaviorProfile: "Steady",
  riskScore: 35
};

const sampleCampaigns: Campaign[] = [
  {
    id: "sample-1",
    client: "Nike",
    market: "UK",
    mediaFormat: "Digital Roadside",
    channel: "Digital OOH",
    objective: "Awareness",
    startDate: "2026-07-01",
    endDate: "2026-07-21",
    artworkDeadline: "2026-06-28",
    copyStatus: "Approved",
    productionStatus: "Complete",
    reportStatus: "Pending",
    budget: 82000,
    behaviorProfile: "Premium",
    riskScore: 18,
    analytics: makeFallbackAnalytics(450000, 7100, 430, 42800, 97000, 82, 2)
  },
  {
    id: "sample-2",
    client: "Spotify",
    market: "Ireland",
    mediaFormat: "Bus Advertising",
    channel: "Classic OOH",
    objective: "Launch",
    startDate: "2026-07-05",
    endDate: "2026-07-28",
    artworkDeadline: "2026-06-27",
    copyStatus: "Pending",
    productionStatus: "Pending",
    reportStatus: "Pending",
    budget: 46000,
    behaviorProfile: "Volatile",
    riskScore: 71,
    analytics: makeFallbackAnalytics(210000, 2400, 126, 21500, 31800, 66, 4)
  },
  {
    id: "sample-3",
    client: "Turkish Airlines",
    market: "UK Airports",
    mediaFormat: "Airport Digital Screens",
    channel: "Digital OOH",
    objective: "Consideration",
    startDate: "2026-06-12",
    endDate: "2026-06-25",
    artworkDeadline: "2026-06-07",
    copyStatus: "Approved",
    productionStatus: "Complete",
    reportStatus: "Complete",
    budget: 116000,
    behaviorProfile: "Seasonal",
    riskScore: 22,
    analytics: makeFallbackAnalytics(760000, 9800, 640, 69000, 142000, 79, 1)
  },
  {
    id: "sample-4",
    client: "Netflix",
    market: "Italy",
    mediaFormat: "Rail and Metro",
    channel: "Classic OOH",
    objective: "Footfall",
    startDate: "2026-07-10",
    endDate: "2026-08-01",
    artworkDeadline: "2026-07-03",
    copyStatus: "Pending",
    productionStatus: "Pending",
    reportStatus: "Pending",
    budget: 58000,
    behaviorProfile: "Steady",
    riskScore: 44,
    analytics: makeFallbackAnalytics(330000, 3900, 190, 30200, 48600, 72, 3)
  }
];

function App() {
  const [campaigns, setCampaigns] = useState<Campaign[]>(() => loadCampaigns());
  const [form, setForm] = useState<CampaignForm>(emptyForm);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [marketFilter, setMarketFilter] = useState("All");
  const [statusFilter, setStatusFilter] = useState<CampaignStatus | "All">("All");
  const [viewMode, setViewMode] = useState<ViewMode>("All");
  const [sortKey, setSortKey] = useState<SortKey>("deadline");
  const [selectedId, setSelectedId] = useState(sampleCampaigns[0]?.id ?? "");
  const [apiStatus, setApiStatus] = useState<ApiStatus>("checking");
  const [isSimulating, setIsSimulating] = useState(false);

  useEffect(() => {
    void loadFromApi();
  }, []);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(campaigns));
  }, [campaigns]);

  useEffect(() => {
    if (!campaigns.some((campaign) => campaign.id === selectedId)) {
      setSelectedId(campaigns[0]?.id ?? "");
    }
  }, [campaigns, selectedId]);

  const enrichedCampaigns = useMemo(
    () =>
      campaigns.map((campaign) => ({
        ...campaign,
        status: getCampaignStatus(campaign),
        daysUntilDeadline: getDaysUntil(campaign.artworkDeadline)
      })),
    [campaigns]
  );

  const markets = useMemo(
    () => ["All", ...Array.from(new Set(campaigns.map((campaign) => campaign.market))).sort()],
    [campaigns]
  );

  const dashboard = useMemo(() => {
    const counts = enrichedCampaigns.reduce(
      (summary, campaign) => {
        summary.total += 1;
        summary[campaign.status] += 1;
        summary.impressions += campaign.analytics?.impressions ?? 0;
        summary.conversions += campaign.analytics?.conversions ?? 0;
        summary.spend += campaign.analytics?.spend ?? 0;
        summary.revenue += campaign.analytics?.revenue ?? 0;
        summary.sentiment += campaign.analytics?.sentiment ?? 0;
        return summary;
      },
      {
        total: 0,
        "On Track": 0,
        "At Risk": 0,
        Overdue: 0,
        Complete: 0,
        impressions: 0,
        conversions: 0,
        spend: 0,
        revenue: 0,
        sentiment: 0
      }
    );

    const health =
      counts.total === 0
        ? 0
        : Math.round(((counts["On Track"] + counts.Complete) / counts.total) * 100);
    const roas = counts.spend === 0 ? 0 : Number((counts.revenue / counts.spend).toFixed(2));
    const sentiment = counts.total === 0 ? 0 : Number((counts.sentiment / counts.total).toFixed(1));

    return { ...counts, health, roas, sentiment };
  }, [enrichedCampaigns]);

  const visibleCampaigns = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();

    return enrichedCampaigns
      .filter((campaign) => {
        const matchesQuery =
          campaign.client.toLowerCase().includes(normalizedQuery) ||
          campaign.mediaFormat.toLowerCase().includes(normalizedQuery);
        const matchesMarket = marketFilter === "All" || campaign.market === marketFilter;
        const matchesStatus = statusFilter === "All" || campaign.status === statusFilter;
        const matchesMode =
          viewMode === "All" ||
          (viewMode === "Needs Action" && campaign.status !== "Complete") ||
          (viewMode === "Complete" && campaign.status === "Complete");

        return matchesQuery && matchesMarket && matchesStatus && matchesMode;
      })
      .sort((a, b) => {
        if (sortKey === "deadline") {
          return new Date(a.artworkDeadline).getTime() - new Date(b.artworkDeadline).getTime();
        }

        if (sortKey === "status") {
          return statusRank(a.status) - statusRank(b.status);
        }

        return a[sortKey].localeCompare(b[sortKey]);
      });
  }, [enrichedCampaigns, marketFilter, query, sortKey, statusFilter, viewMode]);

  const selectedCampaign =
    enrichedCampaigns.find((campaign) => campaign.id === selectedId) ?? enrichedCampaigns[0];

  async function loadFromApi() {
    try {
      const response = await fetch(`${API_URL}/api/campaigns`);

      if (!response.ok) {
        throw new Error("API unavailable");
      }

      const nextCampaigns = (await response.json()) as Campaign[];
      setCampaigns(nextCampaigns.length ? nextCampaigns : sampleCampaigns);
      setApiStatus("connected");
    } catch {
      setApiStatus("offline");
    }
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (editingId) {
      const updatedCampaign = { ...form, id: editingId };

      if (apiStatus === "connected") {
        await apiRequest(`/api/campaigns/${editingId}`, {
          method: "PUT",
          body: JSON.stringify(updatedCampaign)
        });
        await loadFromApi();
      } else {
        setCampaigns((current) =>
          current.map((campaign) => (campaign.id === editingId ? updatedCampaign : campaign))
        );
      }

      setEditingId(null);
    } else {
      const campaign = { ...form, id: crypto.randomUUID() };

      if (apiStatus === "connected") {
        const createdCampaign = await apiRequest<Campaign>("/api/campaigns", {
          method: "POST",
          body: JSON.stringify(campaign)
        });
        await loadFromApi();
        setSelectedId(createdCampaign.id);
      } else {
        setCampaigns((current) => [campaign, ...current]);
        setSelectedId(campaign.id);
      }
    }

    setForm(emptyForm);
  }

  function startEditing(campaign: Campaign) {
    const { id: _id, ...editableCampaign } = campaign;
    setEditingId(campaign.id);
    setForm(editableCampaign);
    window.location.hash = "tracker";
  }

  function cancelEditing() {
    setEditingId(null);
    setForm(emptyForm);
  }

  async function markComplete(id: string) {
    if (apiStatus === "connected") {
      await apiRequest(`/api/campaigns/${id}/complete`, { method: "POST" });
      await loadFromApi();
      return;
    }

    setCampaigns((current) =>
      current.map((campaign) =>
        campaign.id === id
          ? {
              ...campaign,
              copyStatus: "Approved",
              productionStatus: "Complete",
              reportStatus: "Complete"
            }
          : campaign
      )
    );
  }

  async function deleteCampaign(id: string) {
    if (apiStatus === "connected") {
      await apiRequest(`/api/campaigns/${id}`, { method: "DELETE" });
      await loadFromApi();
      return;
    }

    setCampaigns((current) => current.filter((campaign) => campaign.id !== id));
  }

  async function resetSamples() {
    if (apiStatus === "connected") {
      setIsSimulating(true);
      try {
        await apiRequest("/api/simulation/regenerate", {
          method: "POST",
          body: JSON.stringify({ campaignCount: 32 })
        });
        await loadFromApi();
      } finally {
        setIsSimulating(false);
      }
    } else {
      setCampaigns(sampleCampaigns);
    }

    setForm(emptyForm);
    setEditingId(null);
    setQuery("");
    setMarketFilter("All");
    setStatusFilter("All");
    setViewMode("All");
    setSortKey("deadline");
    setSelectedId(campaigns[0]?.id ?? sampleCampaigns[0].id);
  }

  function updateForm<Field extends keyof CampaignForm>(field: Field, value: CampaignForm[Field]) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  return (
    <main className="app-shell">
      <header className="site-header">
        <a className="brand" href="#top" aria-label="CampaignSync home">
          CampaignSync
        </a>

        <nav className="main-nav" aria-label="Main navigation">
          <a href="#features">Features</a>
          <a href="#tracker">Tracker</a>
          <a href="#simulation">Simulation</a>
          <a href="#portfolio">CV</a>
        </nav>

        <a className="nav-cta" href="#tracker">
          Open tracker
        </a>
      </header>

      <section className="hero" id="top">
        <div className="hero-copy">
          <p className="eyebrow">International campaign operations</p>
          <h1>Manage media campaign deadlines across every market.</h1>
          <p className="intro">
            A React, Node.js and PostgreSQL MVP with a self-contained behavior-based campaign
            simulation engine.
          </p>
          <div className="hero-actions">
            <a className="primary-cta" href="#tracker">
              Get started
            </a>
            <a className="secondary-link" href="#portfolio">
              View CV summary
            </a>
          </div>
        </div>

        <section className="hero-product" aria-label="Campaign dashboard">
          <div className="product-header">
            <div>
              <span className="preview-label">Live campaign overview</span>
              <strong>Simulated workflow health</strong>
            </div>
            <span className={`sync-pill api-${apiStatus}`}>
              {apiStatus === "connected"
                ? "PostgreSQL live"
                : apiStatus === "checking"
                  ? "Checking API"
                  : "Demo mode"}
            </span>
          </div>

          <div className="health-card">
            <div>
              <span>Campaign health</span>
              <strong>{dashboard.health}%</strong>
            </div>
            <div className="health-track" aria-label={`${dashboard.health}% healthy`}>
              <span style={{ width: `${dashboard.health}%` }} />
            </div>
          </div>

          <div className="dashboard">
            <Metric label="Total" value={dashboard.total} />
            <Metric label="On Track" value={dashboard["On Track"]} />
            <Metric label="At Risk" value={dashboard["At Risk"]} />
            <Metric label="Overdue" value={dashboard.Overdue} />
            <Metric label="Complete" value={dashboard.Complete} />
            <Metric label="Impressions" value={formatCompact(dashboard.impressions)} />
            <Metric label="Revenue" value={formatCurrency(dashboard.revenue)} />
            <Metric label="ROAS" value={`${dashboard.roas}x`} />
          </div>
        </section>
      </section>

      <section className="feature-strip" id="features" aria-label="Tracker features">
        <FeatureCard
          icon={<Clock3 size={22} />}
          number="01"
          title="Behavior simulation"
          copy="Each dummy campaign has a profile that affects risk, spend, engagement and events."
        />
        <FeatureCard
          icon={<AlertTriangle size={22} />}
          number="02"
          title="PostgreSQL backend"
          copy="Campaigns, clients, events and daily metrics are structured as database tables."
        />
        <FeatureCard
          icon={<BarChart3 size={22} />}
          number="03"
          title="Analytics product"
          copy="Search, sort, edit, regenerate dummy data and inspect simulated performance."
        />
      </section>

      <section className="simulation-panel" id="simulation">
        <div>
          <p className="eyebrow">Simulation engine</p>
          <h2>Generate realistic dummy campaign analytics without external APIs.</h2>
          <p>
            The backend creates clients, campaigns, lifecycle events and daily performance rows
            using behavior profiles such as Steady, Seasonal, Volatile and Premium.
          </p>
        </div>
        <div className="simulation-stats">
          <span>{apiStatus === "connected" ? "Node API connected" : "Frontend demo mode"}</span>
          <strong>{formatCompact(dashboard.impressions)}</strong>
          <small>Total simulated impressions</small>
          <button type="button" onClick={resetSamples} disabled={isSimulating}>
            <RefreshCcw size={17} />
            {apiStatus === "connected" ? "Regenerate dataset" : "Reset demo data"}
          </button>
        </div>
      </section>

      <section className="workspace" id="tracker">
        <form className="panel campaign-form" onSubmit={handleSubmit}>
          <div className="section-heading">
            <span className="mini-label">{editingId ? "Editing campaign" : "New campaign"}</span>
            <h2>{editingId ? "Update Campaign" : "Add Campaign"}</h2>
            <p>Keep the key campaign details organised and status-ready.</p>
          </div>

          <label>
            Client
            <input
              value={form.client}
              onChange={(event) => updateForm("client", event.target.value)}
              type="text"
              placeholder="e.g. Nike"
              required
            />
          </label>

          <label>
            Market
            <input
              value={form.market}
              onChange={(event) => updateForm("market", event.target.value)}
              type="text"
              placeholder="e.g. UK"
              required
            />
          </label>

          <label>
            Media Format
            <input
              value={form.mediaFormat}
              onChange={(event) => updateForm("mediaFormat", event.target.value)}
              type="text"
              placeholder="e.g. Digital Roadside"
              required
            />
          </label>

          <div className="field-grid">
            <label>
              Objective
              <select
                value={form.objective}
                onChange={(event) => updateForm("objective", event.target.value)}
              >
                <option value="Awareness">Awareness</option>
                <option value="Launch">Launch</option>
                <option value="Footfall">Footfall</option>
                <option value="Consideration">Consideration</option>
                <option value="Conversion">Conversion</option>
              </select>
            </label>

            <label>
              Budget
              <input
                value={form.budget}
                onChange={(event) => updateForm("budget", Number(event.target.value))}
                type="number"
                min="1000"
                step="500"
              />
            </label>
          </div>

          <div className="field-grid">
            <label>
              Start
              <input
                value={form.startDate}
                onChange={(event) => updateForm("startDate", event.target.value)}
                type="date"
                required
              />
            </label>

            <label>
              End
              <input
                value={form.endDate}
                onChange={(event) => updateForm("endDate", event.target.value)}
                type="date"
                required
              />
            </label>
          </div>

          <label>
            Artwork Deadline
            <input
              value={form.artworkDeadline}
              onChange={(event) => updateForm("artworkDeadline", event.target.value)}
              type="date"
              required
            />
          </label>

          <div className="field-grid">
            <label>
              Copy
              <select
                value={form.copyStatus}
                onChange={(event) =>
                  updateForm("copyStatus", event.target.value as CampaignForm["copyStatus"])
                }
              >
                <option value="Pending">Pending</option>
                <option value="Approved">Approved</option>
              </select>
            </label>

            <label>
              Production
              <select
                value={form.productionStatus}
                onChange={(event) =>
                  updateForm(
                    "productionStatus",
                    event.target.value as CampaignForm["productionStatus"]
                  )
                }
              >
                <option value="Pending">Pending</option>
                <option value="Complete">Complete</option>
              </select>
            </label>
          </div>

          <label>
            Report
            <select
              value={form.reportStatus}
              onChange={(event) =>
                updateForm("reportStatus", event.target.value as CampaignForm["reportStatus"])
              }
            >
              <option value="Pending">Pending</option>
              <option value="Complete">Complete</option>
            </select>
          </label>

          <div className="form-actions">
            <button type="submit">
              {editingId ? <Save size={18} /> : <Plus size={18} />}
              {editingId ? "Save changes" : "Add campaign"}
            </button>
            {editingId && (
              <button className="ghost-button" type="button" onClick={cancelEditing}>
                Cancel
              </button>
            )}
          </div>
        </form>

        <section className="panel tracker-panel">
          <div className="section-heading table-heading">
            <div>
              <span className="mini-label">Interactive tracker</span>
              <h2>Campaign List</h2>
              <p>Search, sort, edit, delete or mark campaigns complete.</p>
            </div>
            <button
              className="secondary-button"
              type="button"
              onClick={resetSamples}
              disabled={isSimulating}
            >
              <RefreshCcw size={17} />
              {apiStatus === "connected"
                ? isSimulating
                  ? "Generating..."
                  : "Generate dummy data"
                : "Reset Samples"}
            </button>
          </div>

          <div className="view-tabs" role="tablist" aria-label="Campaign view">
            {(["All", "Needs Action", "Complete"] as ViewMode[]).map((mode) => (
              <button
                className={viewMode === mode ? "active" : ""}
                key={mode}
                type="button"
                onClick={() => setViewMode(mode)}
              >
                {mode}
              </button>
            ))}
          </div>

          <div className="filters">
            <label>
              <Search size={17} />
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                type="search"
                placeholder="Search client or format"
              />
            </label>

            <label>
              <Filter size={17} />
              <select value={marketFilter} onChange={(event) => setMarketFilter(event.target.value)}>
                {markets.map((market) => (
                  <option key={market} value={market}>
                    {market}
                  </option>
                ))}
              </select>
            </label>

            <label>
              <CheckCircle2 size={17} />
              <select
                value={statusFilter}
                onChange={(event) =>
                  setStatusFilter(event.target.value as CampaignStatus | "All")
                }
              >
                <option value="All">All statuses</option>
                <option value="On Track">On Track</option>
                <option value="At Risk">At Risk</option>
                <option value="Overdue">Overdue</option>
                <option value="Complete">Complete</option>
              </select>
            </label>

            <label>
              <ArrowUpDown size={17} />
              <select value={sortKey} onChange={(event) => setSortKey(event.target.value as SortKey)}>
                <option value="deadline">Sort by deadline</option>
                <option value="status">Sort by status</option>
                <option value="client">Sort by client</option>
                <option value="market">Sort by market</option>
              </select>
            </label>
          </div>

          {selectedCampaign && (
            <aside className={`focus-card ${statusClass(selectedCampaign.status)}`}>
              <div>
                <span className="mini-label">Selected campaign</span>
                <strong>
                  {selectedCampaign.client} - {selectedCampaign.market}
                </strong>
                <p>
                  Artwork deadline {formatDate(selectedCampaign.artworkDeadline)} ·{" "}
                  {deadlineText(selectedCampaign.daysUntilDeadline)}
                </p>
                <div className="analytics-strip">
                  <span>Risk {selectedCampaign.riskScore ?? 0}%</span>
                  <span>ROAS {selectedCampaign.analytics?.roas ?? 0}x</span>
                  <span>{formatCompact(selectedCampaign.analytics?.impressions ?? 0)} impressions</span>
                </div>
              </div>
              <StatusBadge status={selectedCampaign.status} />
            </aside>
          )}

          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Client</th>
                  <th>Market</th>
                  <th>Format</th>
                  <th>Artwork</th>
                  <th>Simulated Analytics</th>
                  <th>Workflow</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {visibleCampaigns.map((campaign) => (
                  <tr
                    className={selectedId === campaign.id ? "selected-row" : ""}
                    key={campaign.id}
                    onClick={() => setSelectedId(campaign.id)}
                  >
                    <td>
                      <strong>{campaign.client}</strong>
                      <span className="muted">
                        {formatDate(campaign.startDate)} to {formatDate(campaign.endDate)}
                      </span>
                    </td>
                    <td>{campaign.market}</td>
                    <td>
                      {campaign.mediaFormat}
                      <span className="muted">{campaign.behaviorProfile ?? "Steady"} profile</span>
                    </td>
                    <td>
                      {formatDate(campaign.artworkDeadline)}
                      <span className="muted">{deadlineText(campaign.daysUntilDeadline)}</span>
                    </td>
                    <td>
                      <div className="workflow-stack">
                        <span>{formatCompact(campaign.analytics?.impressions ?? 0)} impressions</span>
                        <span>{campaign.analytics?.conversions ?? 0} conversions</span>
                        <span>{formatCurrency(campaign.analytics?.revenue ?? 0)} revenue</span>
                      </div>
                    </td>
                    <td>
                      <div className="workflow-stack">
                        <span>Copy: {campaign.copyStatus}</span>
                        <span>Production: {campaign.productionStatus}</span>
                        <span>Report: {campaign.reportStatus}</span>
                      </div>
                    </td>
                    <td>
                      <StatusBadge status={campaign.status} />
                    </td>
                    <td>
                      <div className="row-actions">
                        <button
                          className="icon-button complete-button"
                          type="button"
                          title="Mark complete"
                          aria-label={`Mark ${campaign.client} complete`}
                          onClick={(event) => {
                            event.stopPropagation();
                            markComplete(campaign.id);
                          }}
                        >
                          <CheckCircle2 size={16} />
                        </button>
                        <button
                          className="icon-button edit-button"
                          type="button"
                          title="Edit campaign"
                          aria-label={`Edit ${campaign.client}`}
                          onClick={(event) => {
                            event.stopPropagation();
                            startEditing(campaign);
                          }}
                        >
                          <Edit3 size={16} />
                        </button>
                        <button
                          className="icon-button delete-button"
                          type="button"
                          title="Delete campaign"
                          aria-label={`Delete ${campaign.client}`}
                          onClick={(event) => {
                            event.stopPropagation();
                            deleteCampaign(campaign.id);
                          }}
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {visibleCampaigns.length === 0 && (
            <p className="empty-state">No campaigns match the current filters.</p>
          )}
        </section>
      </section>

      <section className="portfolio-note" id="portfolio">
        <p className="eyebrow">Portfolio summary</p>
        <h2>Built to demonstrate campaign coordination, admin accuracy and workflow visibility.</h2>
        <p>
          Created an International Media Campaign Tracker using React, TypeScript, HTML and CSS to
          manage mock campaign workflows across markets, including deadline tracking, approval
          status, production requirements and post-campaign reporting.
        </p>
      </section>
    </main>
  );
}

function Metric({ label, value }: { label: string; value: number | string }) {
  return (
    <article className="metric">
      <span>{label}</span>
      <strong>{value}</strong>
    </article>
  );
}

function FeatureCard({
  icon,
  number,
  title,
  copy
}: {
  icon: ReactNode;
  number: string;
  title: string;
  copy: string;
}) {
  return (
    <article>
      <div className="feature-top">
        {icon}
        <span>{number}</span>
      </div>
      <strong>{title}</strong>
      <p>{copy}</p>
    </article>
  );
}

function StatusBadge({ status }: { status: CampaignStatus }) {
  return <span className={`status-pill ${statusClass(status)}`}>{status}</span>;
}

async function apiRequest<ResponseBody = unknown>(path: string, options: RequestInit = {}) {
  const response = await fetch(`${API_URL}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...options.headers
    }
  });

  if (!response.ok) {
    throw new Error(`API request failed: ${response.status}`);
  }

  if (response.status === 204) {
    return undefined as ResponseBody;
  }

  return (await response.json()) as ResponseBody;
}

function makeFallbackAnalytics(
  impressions: number,
  clicks: number,
  conversions: number,
  spend: number,
  revenue: number,
  sentiment: number,
  eventCount: number
): CampaignAnalytics {
  return {
    impressions,
    clicks,
    conversions,
    spend,
    revenue,
    sentiment,
    eventCount,
    roas: spend === 0 ? 0 : Number((revenue / spend).toFixed(2))
  };
}

function loadCampaigns() {
  const saved = localStorage.getItem(STORAGE_KEY);

  if (!saved) {
    return sampleCampaigns;
  }

  try {
    return JSON.parse(saved) as Campaign[];
  } catch {
    return sampleCampaigns;
  }
}

function formatCompact(value: number | string) {
  const numericValue = typeof value === "string" ? Number(value) : value;
  return new Intl.NumberFormat("en-GB", {
    notation: "compact",
    maximumFractionDigits: 1
  }).format(numericValue || 0);
}

function formatCurrency(value: number | string) {
  const numericValue = typeof value === "string" ? Number(value) : value;
  return new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency: "GBP",
    notation: "compact",
    maximumFractionDigits: 1
  }).format(numericValue || 0);
}

function getCampaignStatus(campaign: Campaign): CampaignStatus {
  const copyApproved = campaign.copyStatus === "Approved";
  const productionComplete = campaign.productionStatus === "Complete";
  const reportComplete = campaign.reportStatus === "Complete";

  if (copyApproved && productionComplete && reportComplete) {
    return "Complete";
  }

  const daysUntilDeadline = getDaysUntil(campaign.artworkDeadline);

  if (!copyApproved && daysUntilDeadline < 0) {
    return "Overdue";
  }

  if (!copyApproved && daysUntilDeadline <= 3) {
    return "At Risk";
  }

  return "On Track";
}

function getDaysUntil(dateValue: string) {
  if (!dateValue) {
    return Number.POSITIVE_INFINITY;
  }

  const today = startOfDay(new Date());
  const target = startOfDay(new Date(dateValue));

  if (Number.isNaN(target.getTime())) {
    return Number.POSITIVE_INFINITY;
  }

  return Math.ceil((target.getTime() - today.getTime()) / 86400000);
}

function startOfDay(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function statusRank(status: CampaignStatus) {
  return {
    Overdue: 0,
    "At Risk": 1,
    "On Track": 2,
    Complete: 3
  }[status];
}

function statusClass(status: CampaignStatus) {
  return `status-${status.toLowerCase().replaceAll(" ", "-")}`;
}

function deadlineText(days: number) {
  if (!Number.isFinite(days)) {
    return "No deadline";
  }

  if (days === 0) {
    return "Due today";
  }

  if (days < 0) {
    return `${Math.abs(days)} days overdue`;
  }

  return `${days} days left`;
}

function formatDate(dateValue: string) {
  if (!dateValue) {
    return "No date";
  }

  const date = new Date(dateValue);

  if (Number.isNaN(date.getTime())) {
    return "No date";
  }

  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric"
  }).format(date);
}

export default App;
