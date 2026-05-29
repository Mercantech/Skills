# Mercantec Skills

Forside med årgange + Kryds & Bolle linkbank for 2026. Point (tjekliste +
publikumsstemmer) gemmes nu i en **PostgreSQL-database** via en lille
Node/Express-server, så data deles på tværs af enheder og overlever genstart.

## Struktur

```
public/                 Statiske filer (serveres af serveren)
  index.html            Skills-forside (vælg årgang)
  2026/                 2026-udgaven (grupper, point, publikum, tjekliste, date)
server.js               Express-server + database-API
package.json            Node-afhængigheder (express, pg)
Dockerfile              Bygger app-containeren
docker-compose.yml      App + PostgreSQL (til Dokploy)
.env.example            Skabelon til miljøvariabler
```

## Hvordan data gemmes

- Klienten (`public/2026/shared.js`) henter og gemmer mod `/2026/api/storage`.
- Serveren gemmer hele tilstanden (`groups`, `votes`, `dateItems`) som JSONB i
  tabellen `skills_state`, med årgangen (`2026`) som nøgle.
- Fremtidige årgange (fx `2027`) får automatisk deres egen række i databasen.

| Metode | Endpoint | Handling |
| ------ | -------- | -------- |
| GET    | `/:year/api/storage` | Hent årgangens data |
| POST   | `/:year/api/storage` | Gem årgangens data |
| GET    | `/health` | Healthcheck (tjekker DB-forbindelse) |

## Kør lokalt

```bash
cp .env.example .env        # sæt POSTGRES_PASSWORD
docker compose up --build
```

Åbn derefter http://localhost:3000 (tilføj evt. en host-port under `app` i
compose, fx `ports: ["3000:3000"]`, hvis du ikke bruger en reverse proxy).

## Deploy på Dokploy

1. **Push koden til et Git-repo** (GitHub/GitLab), som Dokploy kan trække fra.
2. I Dokploy: **Create → Compose** og vælg din Git-kilde + branch.
3. Sæt **Compose Path** til `docker-compose.yml`.
4. Under **Environment** tilføjes:
   ```
   POSTGRES_PASSWORD=en-stærk-adgangskode
   ```
5. Tryk **Deploy**. Dokploy bygger `app`-imaget og starter `db` (PostgreSQL).
   Databasens data ligger i Docker-volumet `skills-db` og bevares mellem deploys.
6. Gå til fanen **Domains**, tilføj dit domæne og peg det på service **`app`**
   på **port `3000`**. Dokploy/Traefik håndterer HTTPS automatisk.

Healthchecket på `/health` sørger for, at Dokploy først ruter trafik, når både
app og database er klar.

### Alternativ: Dokploys egen database-service

Vil du hellere bruge en Postgres oprettet via Dokploys **Databases**-menu, så
deploy `app` som en almindelig **Application** (Dockerfile) og sæt i stedet:

```
DATABASE_URL=postgres://bruger:adgangskode@host:5432/skills
```

(brug forbindelsesstrengen fra Dokploys database-side; sæt `DATABASE_SSL=true`
hvis den kræver SSL).
