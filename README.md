# LOIS Terminal

A trading-terminal style dashboard for EUR money markets. It covers:

- Spot LOIS at the EURIBOR fix (10:00 London) and now.
- Live quotes.
- LOIS history by tenor.
- EURIBOR and €STR OIS curves.
- Sovereign spreads, FX, the cross-currency swap and CDS.
- Equity and energy candles.
- ECB excess liquidity.

It replaces the Streamlit prototype in `LOIS Dashboard/`. Both read the same LSEG RICs and ECB series, so they show the same numbers.

```
backend/   Python (FastAPI): LSEG Workspace + ECB Data Portal → JSON under /api
frontend/  React + Vite + Tailwind; lightweight-charts for time series, Plotly for the heatmap
```

## Run it

Requirements: LSEG Workspace open and signed in on this PC, the project `.venv` and Node.js 18 or later.

```powershell
# one-off: install the backend dependencies into the project venv
.\.venv\Scripts\python.exe -m pip install -r "LOIS Terminal\backend\requirements.txt"

# build the frontend if needed and start everything on port 8600
powershell -ExecutionPolicy Bypass -File "LOIS Terminal\start.ps1"
```

Open `http://localhost:8600`. Colleagues use `http://<this PC's IPv4>:8600`. An administrator must allow the port once:

```powershell
New-NetFirewallRule -DisplayName "LOIS Terminal LAN" -Direction Inbound -Action Allow -Protocol TCP -LocalPort 8600 -RemoteAddress LocalSubnet -Profile Domain,Private
```

After changing frontend code, run `start.ps1 -Rebuild`. The chart style gallery is at `#/gallery`.

### Development

Hot reload: run the API and the Vite dev server side by side. Vite proxies `/api` to port 8600.

```powershell
.\.venv\Scripts\python.exe "LOIS Terminal\backend\run.py"
cd "LOIS Terminal\frontend"; npm run dev      # http://localhost:5173
```

## API


| Endpoint                               | Content                                                                        | Backend cache                                      |
| -------------------------------------- | ------------------------------------------------------------------------------ | -------------------------------------------------- |
| `/api/status`                          | LSEG and ECB health, server time                                               | none                                               |
| `/api/snapshot`                        | Live quotes in groups, plus spot LOIS                                          | 10 s                                               |
| `/api/lois/fix`                        | Fixing, OIS at 10:00 London, LOIS at the fix and now                           | 60 s                                               |
| `/api/lois/history?days=365`           | Daily LOIS for 3M, 6M and 12M, with stats (`days=0` returns all)               | 15 min                                             |
| `/api/rates/history?days=`             | EURIBOR fixings and €STR OIS mids                                              | 15 min                                             |
| `/api/series/{key}?days=`              | Daily line for one instrument                                                  | 15 min                                             |
| `/api/ohlc/{key}?days=`                | Daily OHLC and volume for equities and energy                                  | 15 min                                             |
| `/api/news?topic=` or `/api/news?q=`   | Latest 100 Reuters headlines for a preset topic or a search, one row per story | 20 s                                               |
| `/api/news/story?id=`                  | One story's HTML                                                               | 1 h                                                |
| `/api/liquidity`, `/api/liquidity.csv` | ECB excess liquidity heatmap and daily table, in EUR bn                        | 1 min from 10:25 to 11:30 London, otherwise 15 min |


Instrument keys, RICs and units are in `backend/lois_api/config.py`. Each RIC's full daily history is fetched once and sliced per request, so changing the timeframe makes no extra LSEG calls. One shared LSEG session serves every viewer.

## Style

All colours, fonts and the chart defaults for both libraries live in `frontend/src/theme.ts`, and `tailwind.config.js` mirrors them as the `terminal` colour set. Charts never hard-code hex values.

## Known limits

- The S&P 500 (`.SPX`) and NASDAQ Composite (`.IXIC`) cash indices are not entitled on this login, so their slots show the front-month E-mini futures (`ESc1`, `NQc1`). They are marked "PROXY". `NQc1` tracks the Nasdaq-100, not the Composite.
- Before 27 Sep 2024 the ECB publishes no daily excess liquidity series, so it is rebuilt from its components, with reserve requirements held constant. Monthly changes are within about 3 bn of the reference figures.

