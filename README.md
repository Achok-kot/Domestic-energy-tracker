# EnergyIQ — Domestic Energy Tracker

A web application that helps users track home energy usage, it help households take control of their energy consumption by 
 tracking their usage. With the growing electricity prices, if one knows exactly how much they consume, then it will empower them to make 
smart decisions in order to reduce bills and this will contribute to a more sustainable future.
The app is powered by real-time data from the EIA and Electricity Maps APIs.

**Live Demo:** https://achok-kot.tech

---

## Features

- **Log Usage** — Record any appliance with wattage, hours used, room, and date
- **Live Electricity Pricing** — Fetches real residential rates from the U.S. EIA API
- **Carbon Intensity** — Real-time CO₂ data via Electricity Maps API
- **Interactive Charts** — Daily kWh bar chart, category breakdown doughnut, monthly cost trend line
- **Sort / Filter / Search** — Full table with sorting by any column, room filter, consumption level filter
- **CSV Export** — Download all your data as a spreadsheet
- **Personalized Tips** — Energy-saving advice based on your top-consuming categories
- **User Authentication** — Secure register/login with JWT tokens and bcrypt password hashing
- **Per-User Data** — Each user has their own private energy data
- **Secure API Proxy** — API keys stored server-side in `.env`, never exposed to the browser

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | HTML5, CSS3, Vanilla JavaScript |
| Charts | [Chart.js 4.4](https://www.chartjs.org/) |
| Backend | [Node.js](https://nodejs.org/) + [Express 4](https://expressjs.com/) |
| Authentication | JWT + bcryptjs |
| Caching | In-memory cache middleware |
| Process Manager | PM2 |
| Web Server | [Nginx](https://nginx.org/) (reverse proxy + load balancer) |
| Config | dotenv |

---

## APIs Used

| API | Purpose | Documentation |
|---|---|---|
| [EIA Open Data API](https://www.eia.gov/opendata/) | Live US residential electricity prices | https://www.eia.gov/opendata/documentation.php |
| [Electricity Maps API](https://api-portal.electricitymaps.com/) | Real-time carbon intensity by grid zone | https://static.electricitymaps.com/api/docs/index.html |

**Credits:** U.S. Energy Information Administration (EIA) for electricity pricing data. Electricity Maps for carbon intensity data.

---

## Servers

| Server | IP Address | Role |
|--------|-----------|------|
| Web01 | 44.201.182.188 | Web Server 1 |
| Web02 | 54.174.109.89 | Web Server 2 |
| Lb01 | 52.23.253.48 | Load Balancer |

---

## Running Locally

### Prerequisites
- Node.js >= 18
- npm

### 1. Clone the repository
```bash
git clone https://github.com/Achok-kot/Domestic-energy-tracker.git
cd Domestic-energy-tracker
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
JWT_SECRET=your_long_random_secret_here
PORT=3000
SERVER_NAME=local
```

**Getting API keys:**
- **EIA:** Free registration at https://www.eia.gov/opendata/register.php — instant approval
- **Electricity Maps:** Free tier at https://api-portal.electricitymaps.com/ — 1 request/second

### 4. Start the server
```bash
node server.js
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
node -v
```

### Step 2 — Clone the repository on both servers

```bash
git clone https://github.com/Achok-kot/Domestic-energy-tracker.git
cd Domestic-energy-tracker
npm install
```

### Step 3 — Set up .env on each server

```bash
cp .env.example .env
nano .env
```

Fill in your API keys. Make sure **JWT_SECRET is identical on both servers!**

```
EIA_API_KEY=your_key_here
ELECTRICITY_MAPS_API_KEY=your_key_here
JWT_SECRET=EnergyIQ2025SuperSecretKey123ABC
PORT=3000
SERVER_NAME=web01   # change to web02 on second server
```

### Step 4 — Install PM2 and start the app

```bash
sudo npm install -g pm2
pm2 start server.js --name energyiq
pm2 save
pm2 startup
# Run the command it prints
```

### Step 5 — Configure Nginx as reverse proxy on both web servers

```bash
sudo apt install nginx -y

sudo bash -c 'cat > /etc/nginx/sites-available/energyiq << EOF
server {
    listen 80;
    server_name _;

    location / {
        proxy_pass         http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header   Upgrade \$http_upgrade;
        proxy_set_header   Connection "upgrade";
        proxy_set_header   Host \$host;
        proxy_set_header   X-Real-IP \$remote_addr;
        proxy_cache_bypass \$http_upgrade;
    }

    location /health {
        proxy_pass http://localhost:3000/health;
    }
}
EOF'

sudo ln -sf /etc/nginx/sites-available/energyiq /etc/nginx/sites-enabled/energyiq
sudo rm /etc/nginx/sites-enabled/default
sudo nginx -t
sudo systemctl restart nginx
```

### Step 6 — Configure the Load Balancer (Lb01)

```bash
sudo apt install nginx -y

sudo bash -c 'cat > /etc/nginx/sites-available/energyiq-lb << EOF
upstream energyiq_backend {
    server 44.201.182.188:80;
    server 54.174.109.89:80;
}

server {
    listen 80;
    server_name _;

    location / {
        proxy_pass         http://energyiq_backend;
        proxy_set_header   Host \$host;
        proxy_set_header   X-Real-IP \$remote_addr;
        proxy_set_header   X-Forwarded-For \$proxy_add_x_forwarded_for;
    }

    location /health {
        proxy_pass http://energyiq_backend/health;
    }
}
EOF'

sudo ln -sf /etc/nginx/sites-available/energyiq-lb /etc/nginx/sites-enabled/energyiq-lb
sudo rm /etc/nginx/sites-enabled/default
sudo nginx -t
sudo systemctl restart nginx
```

### Step 7 — Verify load balancing

```bash
for i in {1..6}; do curl -s http://52.23.253.48/health; echo; done
```

You should see responses alternating between web01 and web02.

---

## Testing Checklist

- [x] App loads at `http://44.201.182.188`
- [x] App loads at `http://54.174.109.89`
- [x] App loads at `http://52.23.253.48`
- [x] `/health` endpoint returns `{"status":"ok",...}`
- [x] Register and login works
- [x] Logging a usage entry saves and shows in the table
- [x] Dashboard charts update after logging entries
- [x] CSV export downloads correctly
- [x] Traffic is distributed between Web01 and Web02

---

## Bonus Features Implemented

- **User Authentication** — JWT tokens + bcrypt password hashing
- **Caching** — In-memory API response caching (1 hour for electricity rates)
- **Docker** — Dockerfile + docker-compose.yml for containerization
- **CI/CD Pipeline** — GitHub Actions workflow for automated deployment
- **Security** — XSS protection, SQL injection prevention, rate limiting, input sanitization
- **Performance** — API response caching reduces external API calls

---

## Challenges & Solutions

| Challenge | Solution |
|---|---|
| API keys exposed in terminal logs | Removed key from error messages, stored only in `.env` |
| Users lost after server restart | Switched from in-memory to file-based user storage |
| Different users sharing same data | Used per-user localStorage keys |
| JWT tokens rejected across servers | Set identical JWT_SECRET on both servers |
| Port 80 conflict on load balancer | Stopped HAProxy, started Nginx |
| Node.js version conflict on Windows/WSL | Used `/usr/bin/node` directly |

---

## Project Structure

```
Domestic-energy-tracker/
├── .env.example            # Template for environment variables
├── .gitignore              # Excludes .env, node_modules, users.json
├── package.json            # Node dependencies
├── server.js               # Express server + API proxy
├── Dockerfile              # Docker container config
├── docker-compose.yml      # Multi-container setup
├── nginx.conf              # Nginx load balancer config
├── README.md
├── .github/
│   └── workflows/
│       └── deploy.yml      # CI/CD pipeline
├── middleware/
│   ├── auth.js             # JWT authentication
│   ├── cache.js            # API response caching
│   └── sanitize.js         # Input validation & XSS protection
├── routes/
│   ├── apiRoutes.js        # EIA + Electricity Maps API proxy
│   └── authRoutes.js       # Register + Login endpoints
└── public/
    └── index.html          # Full frontend (HTML + CSS + JS + Chart.js)
```

---

## License

MIT — free to use for educational purposes.
