A web application that helps users track home energy usage, estimating electricity costs, and monitoring  carbon footprint — powered by real-time data from the EIA and Electricity Maps APIs.

---

## Features

- **Log Usage** — Record any appliance with wattage, hours used, room, and date
- **Live Electricity Pricing** — Fetches real residential rates from the U.S. EIA API
- **Carbon Intensity** — Real-time CO₂ data via Electricity Maps API
- **Interactive Charts** — Daily kWh bar chart, appliance breakdown doughnut, monthly cost trend line
- **Sort / Filter / Search** — Full table with sorting by any column, room filter, consumption level filter
- **CSV Export** — Download all your data as a spreadsheet
- **Personalized Tips** — Energy-saving advice based on your top-consuming appliances
- **Persistent Storage** — All entries saved in browser localStorage
- **Secure API Proxy** — API keys stored server-side in `.env`, never exposed to the browser

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | HTML5, CSS3, Vanilla JavaScript |
| Charts | [Chart.js 4.4](https://www.chartjs.org/) |
| Backend | [Node.js](https://nodejs.org/) + [Express 4](https://expressjs.com/) |
| API Proxy | `node-fetch` |
| Config | `dotenv` |
| Web Server | [Nginx](https://nginx.org/) (reverse proxy) |

---

## APIs Used

| API | Purpose | Documentation |
|---|---|---|
| [EIA Open Data API](https://www.eia.gov/opendata/) | Live US residential electricity prices | https://www.eia.gov/opendata/documentation.php |
| [Electricity Maps API](https://api-portal.electricitymaps.com/) | Real-time carbon intensity by grid zone | https://static.electricitymaps.com/api/docs/index.html |

**Credits:** U.S. Energy Information Administration (EIA) for electricity pricing data. Electricity Maps for carbon intensity data.

---

## Running Locally

### Prerequisites
- Node.js >= 18
- npm

### 1. Clone the repository
```bash
git clone https://github.com/YOUR_USERNAME/energyiq.git
cd energyiq
```

### 2. Install dependencies
```bash
npm install
```

### 3. Set up environment variables
```bash
cp .env.example .env
```
Edit `.env` and add your API keys:
```
EIA_API_KEY=your_eia_key_here
ELECTRICITY_MAPS_API_KEY=your_electricity_maps_key_here
PORT=3000
```

**Getting API keys:**
- **EIA:** Free registration at https://www.eia.gov/opendata/register.php — instant approval
- **Electricity Maps:** Free tier at https://api-portal.electricitymaps.com/ — 1 request/second

### 4. Start the server
```bash
npm start
```
Visit **http://localhost:3000** in your browser.

> **Note:** The app works even without API keys — it falls back to known average values automatically.

---

## Deployment (Web01 + Web02 + Load Balancer)

### Step 1 — Install Node.js on both web servers

SSH into Web01, then repeat on Web02:
```bash
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs
node -v   # should print v20.x.x
```

### Step 2 — Copy the application to both servers

From your local machine:
```bash
scp -r ./energyiq ubuntu@WEB01_IP:/var/www/energyiq
scp -r ./energyiq ubuntu@WEB02_IP:/var/www/energyiq
```

### Step 3 — Set up .env on each server

SSH into Web01:
```bash
cd /var/www/energyiq
cp .env.example .env
nano .env   # paste your real API keys
npm install --production
```
Repeat on Web02.

### Step 4 — Install PM2 (keeps Node running after logout)

On both servers:
```bash
sudo npm install -g pm2
cd /var/www/energyiq
pm2 start server.js --name energyiq
pm2 startup    # follow the printed command to enable on boot
pm2 save
```

### Step 5 — Configure Nginx as a reverse proxy on both web servers

Install Nginx on Web01 and Web02:
```bash
sudo apt install nginx -y
```

Create config file:
```bash
sudo nano /etc/nginx/sites-available/energyiq
```

Paste:
```nginx
server {
    listen 80;
    server_name _;

    location / {
        proxy_pass         http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header   Upgrade $http_upgrade;
        proxy_set_header   Connection 'upgrade';
        proxy_set_header   Host $host;
        proxy_cache_bypass $http_upgrade;
    }

    # Health check endpoint for load balancer
    location /health {
        proxy_pass http://localhost:3000/health;
    }
}
```

Enable and restart:
```bash
sudo ln -s /etc/nginx/sites-available/energyiq /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl restart nginx
```

Test: `curl http://WEB01_IP` — you should see the EnergyIQ app.

### Step 6 — Configure the Load Balancer (Lb01)

SSH into Lb01:
```bash
sudo apt install nginx -y
sudo nano /etc/nginx/sites-available/energyiq-lb
```

Paste (replace IPs with your actual Web01/Web02 private IPs):
```nginx
upstream energyiq_backend {
    server WEB01_PRIVATE_IP:80;
    server WEB02_PRIVATE_IP:80;
}

server {
    listen 80;
    server_name _;

    location / {
        proxy_pass         http://energyiq_backend;
        proxy_set_header   Host $host;
        proxy_set_header   X-Real-IP $remote_addr;
        proxy_set_header   X-Forwarded-For $proxy_add_x_forwarded_for;
    }
}
```

Enable and restart:
```bash
sudo ln -s /etc/nginx/sites-available/energyiq-lb /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl restart nginx
```

### Step 7 — Verify load balancing

Run this multiple times and check the server name changes:
```bash
for i in {1..6}; do curl -s http://LB01_IP/health; echo; done
```

You should see responses alternating between Web01 and Web02.

---

## Testing Checklist

- [ ] App loads at `http://WEB01_IP`
- [ ] App loads at `http://WEB02_IP`
- [ ] App loads at `http://LB01_IP`
- [ ] `/health` endpoint returns `{"status":"ok",...}`
- [ ] Logging a usage entry saves and shows in the table
- [ ] Dashboard charts update after logging entries
- [ ] CSV export downloads correctly
- [ ] Traffic is distributed between Web01 and Web02 (check PM2 logs)

---

## Challenges & Solutions

| Challenge | Solution |
|---|---|
| API keys can't be in frontend JS | Moved all API calls to an Express proxy server — keys live only in `.env` |
| App needs to stay running on server | Used PM2 process manager with `pm2 startup` |
| Load balancer needs to know servers are alive | Added `/health` endpoint; nginx upstream handles failover automatically |
| EIA/Electricity Maps may be unavailable | Implemented graceful fallback values so the app always works |

---

## Project Structure

```
energyiq/
├── .env.example        # Template for environment variables
├── .gitignore          # Excludes .env and node_modules
├── package.json        # Node dependencies
├── server.js           # Express server + API proxy
├── README.md
└── public/
    └── index.html      # Full frontend (HTML + CSS + JS + Chart.js)
```

---

## License

MIT — free to use for educational purposes.
