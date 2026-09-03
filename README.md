# Hotel Rate Comparator using Temporal Workflows

A resilient, full-stack hotel rate comparator application that queries multiple mock hotel suppliers concurrently, orchestrates retries, timeouts, and cancellations through **Temporal.io workflows**, and selects the cheapest hotel rate with deterministic tie-breaking.

---

## Architecture

```text
                   Next.js Frontend (Port 5001)
                                |
                                v
                   Express REST API (Port 8003)
                                |
                                v
                         Temporal Client
                                |
                                v
                      Hotel Search Workflow
                         /            \
                        /              \
                       v                v
                Supplier A Activity  Supplier B Activity
                       |                |
                       v                v
                Mock Supplier A   Mock Supplier B
                 (Port 8003)       (Port 8003)
                         \            /
                          \          /
                           v        v
                        Deterministic Comparison
                           (Cheapest Rate;
                        Tie-breaker: A > B)
                                |
                                v
                            Best Rate
```

### Key Architectural Characteristics
- **Decoupled Orchestration**: The Express API never calls suppliers directly; it exclusively initiates and manages execution through the Temporal TypeScript SDK.
- **Resilience & Fault Isolation**: Supplier A and Supplier B run concurrently. A failure, timeout, or delay in one supplier does not abort or block the other supplier.
- **Deterministic Workflows**: All business logic evaluation is pure and deterministic. Tie-breakers default to Supplier A.
- **Graceful Cancellation**: Workflow handles cancellation signals and aborts in-flight fetch requests via `AbortSignal`.

---

## Tech Stack

- **Frontend**: Next.js 14 (App Router), React 18, TypeScript, Vanilla CSS (Glassmorphism & Responsive Design)
- **Backend**: Node.js, Express.js, TypeScript, CORS
- **Workflow Engine**: Temporal.io, Temporal TypeScript SDK (`@temporalio/workflow`, `@temporalio/activity`, `@temporalio/client`, `@temporalio/worker`, `@temporalio/testing`)
- **Testing**: Jest, Supertest, React Testing Library, ts-jest
- **Infrastructure & Containerization**: Docker Compose (Temporal Server & Web UI)

---

## Project Structure

```text
hotel-rate-comparator/
├── apps/
│   ├── frontend/
│   │   ├── app/                      # Next.js App Router pages and global CSS
│   │   │   ├── globals.css           # Modern theme styling & responsive tokens
│   │   │   ├── layout.tsx            # HTML layout shell with Google Fonts
│   │   │   └── page.tsx              # Main Hotel Search UI page
│   │   ├── components/               # Modular UI components
│   │   │   ├── HotelSearchForm.tsx   # Search input form & client-side validation
│   │   │   ├── LoadingState.tsx      # Spinner & interactive Cancel button
│   │   │   ├── SearchResult.tsx      # Best rate display card with badges
│   │   │   └── ErrorMessage.tsx      # User-friendly error alert card
│   │   ├── lib/
│   │   │   └── api.ts                # Frontend API client (POST search & cancel)
│   │   ├── types/
│   │   │   └── hotel.ts              # Shared domain TypeScript interfaces
│   │   ├── tests/                    # Frontend component tests (Jest + RTL)
│   │   ├── package.json
│   │   └── tsconfig.json
│   │
│   └── backend/
│       ├── src/
│       │   ├── activities/           # Supplier A & Supplier B Temporal activities
│       │   ├── api/                  # Express REST controllers & routes
│       │   │   ├── controllers/      # Health, search, and supplier controllers
│       │   │   ├── middleware/       # Centralized error handling (no stack traces)
│       │   │   └── routes/           # Express router endpoints
│       │   ├── config/               # Typed environment configuration
│       │   ├── services/             # Pure deterministic price comparison logic
│       │   ├── suppliers/            # Mock supplier engines & behavior simulators
│       │   ├── temporal/             # Temporal client & worker initialization
│       │   ├── types/                # Domain models & result interfaces
│       │   ├── workflows/            # Temporal hotelSearchWorkflow
│       │   ├── app.ts                # Express app definition (Supertest-ready)
│       │   └── server.ts             # Server entry point with auto-fallback engine
│       ├── tests/                    # Backend test suites
│       │   ├── api/                  # Supertest API tests (health, suppliers, search)
│       │   ├── unit/                 # Pure comparison & activity tests
│       │   └── workflows/            # Temporal workflow bundle & E2E tests
│       ├── package.json
│       └── tsconfig.json
│
├── docker-compose.yml                # Local Temporal Server & UI infrastructure
├── .env.example                      # Root environment variable template
├── package.json                      # Monorepo root scripts & workspaces
└── README.md
```

---

## Setup & Running Locally

### 1. Clone & Install Dependencies

```bash
git clone <repository-url>
cd hotel-rate-comparator
npm install
```

### 2. Configure Environment

Copy `.env.example` to `.env`:

```bash
cp .env.example .env
```

Default settings:
```env
PORT=8003
NEXT_PUBLIC_API_URL=http://localhost:8003
TEMPORAL_ADDRESS=localhost:7233
TEMPORAL_NAMESPACE=default
TEMPORAL_TASK_QUEUE=hotel-search
```

### 3. Start Temporal Infrastructure

Start the local Temporal service and Web UI using Docker Compose:

```bash
docker compose up -d
```
- Temporal Server: `localhost:7233`
- Temporal Web UI: [http://localhost:8233](http://localhost:8233)

> **Note**: If Docker is unavailable, the backend server includes an automatic embedded Temporal fallback powered by `@temporalio/testing`, allowing immediate out-of-the-box local development!

### 4. Start the Application

Open separate terminals or run in parallel:

```bash
# Terminal 1: Backend API (Port 8003)
npm run dev:backend

# Terminal 2: Temporal Worker
npm run worker

# Terminal 3: Frontend App (Port 5001)
npm run dev:frontend
```

Alternatively, run frontend and backend simultaneously:
```bash
npm run dev
```

Visit the application at: [http://localhost:5001](http://localhost:5001)

---

## API Documentation

### 1. Health Check
```http
GET /health
```
**Response (200 OK):**
```json
{
  "status": "ok",
  "timestamp": "2026-09-03T01:00:00.000Z",
  "service": "hotel-rate-comparator-backend"
}
```

---

### 2. Search Hotels
```http
POST /api/search-hotels
Content-Type: application/json
```
**Request Body:**
```json
{
  "city": "Dubai",
  "checkIn": "2026-10-10",
  "checkOut": "2026-10-12"
}
```
**Response (200 OK):**
```json
{
  "workflowId": "hotel-search-c490e3df-9715-4c77-8664-3482c637dcb0",
  "hotelId": "hotel-b-101",
  "name": "Grand Dubai Hotel",
  "price": 115,
  "supplier": "B",
  "status": "SUCCESS"
}
```

**Status Code Mappings:**
- `200 OK`: Best rate successfully found.
- `400 Bad Request`: Input validation error (`city` missing, invalid date format, `checkOut <= checkIn`).
- `404 Not Found`: No hotels available for the requested criteria.
- `502 Bad Gateway`: Both suppliers failed to provide rates.
- `499 Client Closed Request`: Search workflow was cancelled.
- `500 Internal Server Error`: Internal system failure (internal stack traces suppressed).

---

### 3. Cancel Active Search
```http
POST /api/search-hotels/:workflowId/cancel
```
**Response (200 OK):**
```json
{
  "message": "Workflow cancellation requested",
  "workflowId": "hotel-search-c490e3df-9715-4c77-8664-3482c637dcb0"
}
```

---

### 4. Supplier Mock Endpoints
```http
GET /supplierA/hotels?city=Dubai&checkIn=2026-10-10&checkOut=2026-10-12&behavior=success
GET /supplierB/hotels?city=Dubai&checkIn=2026-10-10&checkOut=2026-10-12&behavior=success
```

---

## Supplier Simulation

Both suppliers (`/supplierA/hotels` and `/supplierB/hotels`) support behavior simulation parameters:

| Behavior | URL Parameter | Description |
|---|---|---|
| **`success`** | `behavior=success` | Returns deterministic normal hotel rates immediately (200 OK). |
| **`delay`** | `behavior=delay` | Simulates high network latency (~2.0 seconds) then succeeds (200 OK). |
| **`slow`** | `behavior=slow` | Simulates 6.0-second delay exceeding Temporal's 5-second activity timeout. |
| **`empty`** | `behavior=empty` | Returns empty hotel collection: `{"hotels": []}` (200 OK). |
| **`error`** | `behavior=error` | Throws HTTP 500 Internal Server Error. |
| **`fail-twice`** | `behavior=fail-twice` | First 2 requests return HTTP 500; 3rd request succeeds (tests native Temporal retry recovery). |

---

## Assignment Scenario Matrix

All required scenarios are fully implemented and verified via automated test suites:

| # | Scenario | Expected Result | Automated Test File | Status |
|---|---|---|---|:---:|
| 1 | **Supplier A cheaper** | Supplier A selected | `tests/workflows/workflow.e2e.test.ts` | Pass |
| 2 | **Supplier B cheaper** | Supplier B selected | `tests/workflows/workflow.e2e.test.ts` | Pass |
| 3 | **Same price** | Supplier A selected (deterministic tie-breaker) | `tests/workflows/workflow.e2e.test.ts` | Pass |
| 4 | **A fails, B succeeds** | Supplier B selected (`PARTIAL_SUCCESS`) | `tests/workflows/workflow.e2e.test.ts` | Pass |
| 5 | **B fails, A succeeds** | Supplier A selected (`PARTIAL_SUCCESS`) | `tests/workflows/workflow.e2e.test.ts` | Pass |
| 6 | **Both suppliers fail** | Throws `ApplicationFailure` (HTTP 502) | `tests/workflows/workflow.e2e.test.ts` | Pass |
| 7 | **A empty, B succeeds** | Supplier B selected | `tests/workflows/workflow.e2e.test.ts` | Pass |
| 8 | **B empty, A succeeds** | Supplier A selected | `tests/workflows/workflow.e2e.test.ts` | Pass |
| 9 | **Both empty** | Returns `NO_HOTELS_FOUND` (HTTP 404) | `tests/workflows/workflow.e2e.test.ts` | Pass |
| 10 | **Supplier > 5s** | Slow activity times out (5s), other supplier returned | `tests/workflows/workflow.e2e.test.ts` | Pass |
| 11 | **A fails twice** | Retried automatically, succeeds on Attempt 3 | `tests/workflows/workflow.e2e.test.ts` | Pass |
| 12 | **Cancellation** | Terminates gracefully, not converted to success | `tests/workflows/workflow.e2e.test.ts` | Pass |

---

## Testing & Coverage

Run the complete test suite across all monorepo workspaces:

```bash
npm test
```

Generate detailed line and branch coverage:

```bash
npm run test:coverage
```

### Test Suite Structure
- **Unit Comparison Tests** (`comparison.test.ts`): Tests pure price comparison, tie-breaking, and error policies.
- **Activity Tests** (`activities.test.ts`): Tests activity HTTP fetch, 500 error mapping, empty payload handling, and cancellation signals.
- **Workflow Bundle Test** (`workflow.bundle.test.ts`): Webpack bundle test verifying zero determinism or V8 isolation violations.
- **Workflow E2E Tests** (`workflow.e2e.test.ts`): Runs all 12 scenarios inside Temporal's `TestWorkflowEnvironment`.
- **API Tests** (`search.test.ts`, `supplier.test.ts`, `health.test.ts`): Supertest tests verifying HTTP status codes, headers, and validations.
- **Frontend Tests** (`components.test.tsx`): React Testing Library tests for forms, validations, loading, and results.

---

## Known Limitations

- **Mocked Inventory**: Supplier rates are simulated based on city destination and query parameters; real third-party GDS/hotel APIs are not connected.
- **Authentication**: No user authentication or role-based access control (RBAC) is implemented for search endpoints.
- **Fixed Currency**: All rates are denominated in USD ($) without multi-currency conversion.
- **Single-Room Pricing**: Rates represent single-room night stays without multi-occupancy breakdowns.
- **Local Temporal**: Intended for local development and demonstration via Docker Compose or embedded test server.

---

## Reviewer Instructions

Follow these quick steps to evaluate the application:

1. **Install Dependencies**:
   ```bash
   npm install
   ```
2. **Start Temporal** (or rely on the auto-fallback embedded server):
   ```bash
   docker compose up -d
   ```
3. **Start Backend Server**:
   ```bash
   npm run dev:backend
   ```
4. **Start Temporal Worker**:
   ```bash
   npm run worker
   ```
5. **Start Frontend App**:
   ```bash
   npm run dev:frontend
   ```
   Open [http://localhost:5001](http://localhost:5001) in your browser.
6. **Run Full Test Suite**:
   ```bash
   npm test
   npm run test:coverage
   ```
