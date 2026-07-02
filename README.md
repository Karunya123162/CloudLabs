# CloudLabs

A local AWS console simulator built with React + Node.js, backed by a LocalStack-compatible mock (Floci) and PostgreSQL. It lets you practise AWS services — S3, EC2, Lambda, IAM, CloudWatch — entirely on your own machine without an AWS account.

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React 18, Vite, CSS Modules |
| Backend | Node.js, Express |
| Auth | JWT + bcrypt, PostgreSQL |
| AWS mock | Floci (LocalStack-compatible) on port 4566 |
| AWS SDK | `@aws-sdk` v3 (S3, EC2, Lambda, IAM, CloudWatch) |
| Database | PostgreSQL 16 |

---

## Project Structure

```
CloudLabs/
├── frontend/               # React app (Vite, port 3000)
│   └── src/
│       ├── components/
│       │   ├── ec2/        # EC2 console + launch page
│       │   ├── s3/         # S3 console + bucket triggers
│       │   ├── lambda/     # Lambda console
│       │   ├── iam/        # IAM console
│       │   ├── cloudwatch/ # CloudWatch console
│       │   └── CloudShell/ # In-browser AWS CLI
│       ├── pages/          # Login, Dashboard, AWSPortal
│       ├── context/        # Auth context
│       └── services/       # Axios API client
│
├── backend/                # Express API (port 5000)
│   └── src/
│       ├── controllers/    # awsController.js, authController.js
│       ├── routes/         # awsRoutes.js, authRoutes.js
│       ├── config/         # awsClients.js (SDK clients)
│       ├── models/         # User model
│       ├── middleware/      # JWT auth middleware
│       └── db/             # PostgreSQL connection
│
└── docker-compose.yml      # PostgreSQL + Floci (LocalStack mock)
```

---

## Prerequisites

- [Node.js](https://nodejs.org/) v18+
- [Docker Desktop](https://www.docker.com/products/docker-desktop/) (for PostgreSQL + Floci)
- npm v9+

---

## Setup

### 1. Clone the repository

```bash
git clone https://github.com/Karunya123162/CloudLabs.git
cd CloudLabs
```

### 2. Start infrastructure (PostgreSQL + Floci)

```bash
docker-compose up -d
```

This starts:
- **PostgreSQL** on `localhost:5432`
- **Floci** (AWS mock) on `localhost:4566`

### 3. Configure the backend

```bash
cd backend
cp .env.example .env
```

Edit `.env` if needed (defaults work out of the box with the docker-compose setup):

```env
PORT=5000
DB_HOST=localhost
DB_PORT=5432
DB_NAME=myapp
DB_USER=postgres
DB_PASSWORD=yourpassword
JWT_SECRET=your_jwt_secret_here
AWS_ENDPOINT_URL=http://localhost:4566
```

### 4. Install dependencies

```bash
# Backend
cd backend
npm install

# Frontend
cd ../frontend
npm install
```

### 5. Run the app

Open two terminals:

```bash
# Terminal 1 — backend
cd backend
npm run dev
```

```bash
# Terminal 2 — frontend
cd frontend
npm run dev
```

The app will be available at **http://localhost:3000**

---

## Services Simulated

| Service | Features |
|---|---|
| **S3** | Buckets, objects, versioning, lifecycle, encryption, static website hosting, bucket policy, tags, object lock, EC2 integration |
| **EC2** | Launch instances (AMI selector, instance types, network settings, key pairs, security groups, tags), start/stop/reboot/terminate, Elastic IPs, VPCs, subnets, volumes |
| **Lambda** | Create/delete/invoke functions, event source mappings, S3 bucket triggers |
| **IAM** | Users, groups, roles, policies |
| **CloudWatch** | Metrics, alarms |
| **CloudShell** | In-browser AWS CLI (`aws s3`, `aws ec2`, `aws lambda`, `aws iam`, `aws cloudwatch`) |

---

## How it works

```
Browser (React)
    │
    │  /api/*  (Vite proxy → localhost:5000)
    ▼
Express Backend
    │
    │  AWS SDK v3 → http://localhost:4566
    ▼
Floci (LocalStack-compatible AWS mock)
```

The Vite dev server proxies all `/api` requests to the Express backend. The backend uses the AWS SDK v3 pointed at the Floci endpoint (`http://localhost:4566`) instead of real AWS.

---

## Environment Variables

| Variable | Default | Description |
|---|---|---|
| `PORT` | `5000` | Express server port |
| `DB_HOST` | `localhost` | PostgreSQL host |
| `DB_PORT` | `5432` | PostgreSQL port |
| `DB_NAME` | `myapp` | Database name |
| `DB_USER` | `postgres` | Database user |
| `DB_PASSWORD` | `yourpassword` | Database password |
| `JWT_SECRET` | — | Secret for signing JWTs |
| `AWS_ENDPOINT_URL` | `http://localhost:4566` | Floci/LocalStack endpoint |

---

## Scripts

### Backend
```bash
npm start      # production
npm run dev    # development (nodemon)
```

### Frontend
```bash
npm run dev      # development server (port 3000)
npm run build    # production build → dist/
npm run preview  # preview production build
```
