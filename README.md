# Visa MCP Server

MCP (Model Context Protocol) server for Visa Developer APIs, designed for the Dedalus Labs marketplace.

## Features

- **13 MCP Tools** covering:
  - Foreign Exchange Rates
  - ATM Locator
  - Visa Subscription Manager
  - Visa Stop Payment Service
- **Two-Way SSL (mTLS)** authentication
- **Dedalus-compatible** SSE transport

## Quick Start

### 1. Install Dependencies
```bash
npm install
```

### 2. Configure Credentials

Copy `.env.example` to `.env` and fill in your Visa Developer credentials:

```bash
cp .env.example .env
```

Place your certificate files in the `certs/` directory:
- `cert.pem` - Client certificate
- `key.pem` - Private key

### 3. Run the Server

Development mode (with hot reload):
```bash
npm run dev
```

Production:
```bash
npm run build
npm start
```

## Endpoints

| Endpoint | Description |
|----------|-------------|
| `GET /mcp` | MCP SSE connection (Dedalus validator) |
| `POST /messages` | MCP message handler |
| `GET /health` | Health check |

## Available Tools

### Core Tools
- `hello_world` - Test API connectivity
- `get_exchange_rate` - Get Visa FX rates
- `find_nearby_atms` - Locate Visa/Plus ATMs

### Subscription Manager
- `vsm_search` - Search stop instructions
- `vsm_merchant_details` - Get merchant details
- `vsm_add_merchant` - Create stop instruction
- `vsm_cancel` - Cancel stop instruction

### Stop Payment Service
- `vsps_search_instructions` - Get active stop IDs
- `vsps_search_eligible` - Search eligible transactions
- `vsps_add_stop` - Add stop instruction
- `vsps_cancel_stop` - Cancel stop instruction
- `vsps_update_stop` - Update stop instruction
- `vsps_extend_stop` - Extend stop instruction

## Getting Visa Credentials

1. Register at [developer.visa.com](https://developer.visa.com)
2. Create a new project
3. Select the APIs you need
4. Download credentials (User ID, Password, Certificates)

See [Visa Developer Quick Start Guide](https://developer.visa.com/pages/working-with-visa-apis/visa-developer-quick-start-guide) for details.

## License

MIT
