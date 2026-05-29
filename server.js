const path = require("path");
const express = require("express");
const { Pool } = require("pg");

const PORT = Number(process.env.PORT) || 3000;
const PUBLIC_DIR = path.join(__dirname, "public");

const DEFAULT_STATE = {
  groups: [],
  votes: { totals: {}, voters: {} },
  dateItems: []
};

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_SSL === "true" ? { rejectUnauthorized: false } : undefined
});

async function initDatabase() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS skills_state (
      year TEXT PRIMARY KEY,
      data JSONB NOT NULL DEFAULT '{}'::jsonb,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );
  `);
}

function isValidYear(year) {
  return /^[0-9]{4}$/.test(year);
}

function sanitizeState(input) {
  const data = input && typeof input === "object" ? input : {};
  const votes = data.votes && typeof data.votes === "object" ? data.votes : {};
  return {
    groups: Array.isArray(data.groups) ? data.groups : [],
    votes: {
      totals: votes.totals && typeof votes.totals === "object" ? votes.totals : {},
      voters: votes.voters && typeof votes.voters === "object" ? votes.voters : {}
    },
    dateItems: Array.isArray(data.dateItems) ? data.dateItems : []
  };
}

const app = express();
app.disable("x-powered-by");
app.use(express.json({ limit: "48mb" }));

app.get("/health", async (_req, res) => {
  try {
    await pool.query("SELECT 1");
    res.json({ ok: true });
  } catch (error) {
    res.status(503).json({ ok: false });
  }
});

app.get("/:year/api/storage", async (req, res) => {
  const { year } = req.params;
  if (!isValidYear(year)) return res.status(404).json({ error: "Ukendt \u00e5rgang" });

  try {
    const result = await pool.query("SELECT data FROM skills_state WHERE year = $1", [year]);
    res.json(result.rows[0]?.data || DEFAULT_STATE);
  } catch (error) {
    console.error("Kunne ikke hente data:", error);
    res.status(500).json({ error: "Databasefejl" });
  }
});

app.post("/:year/api/storage", async (req, res) => {
  const { year } = req.params;
  if (!isValidYear(year)) return res.status(404).json({ error: "Ukendt \u00e5rgang" });

  const payload = sanitizeState(req.body);

  try {
    await pool.query(
      `INSERT INTO skills_state (year, data, updated_at)
       VALUES ($1, $2::jsonb, now())
       ON CONFLICT (year) DO UPDATE SET data = EXCLUDED.data, updated_at = now()`,
      [year, JSON.stringify(payload)]
    );
    res.json({ ok: true, data: payload });
  } catch (error) {
    console.error("Kunne ikke gemme data:", error);
    res.status(500).json({ error: "Databasefejl" });
  }
});

app.use(express.static(PUBLIC_DIR, { extensions: ["html"] }));

initDatabase()
  .then(() => {
    app.listen(PORT, () => {
      console.log(`Skills-server k\u00f8rer p\u00e5 port ${PORT}`);
    });
  })
  .catch((error) => {
    console.error("Kunne ikke initialisere databasen:", error);
    process.exit(1);
  });
