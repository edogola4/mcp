# MCP (Model Context Protocol) Server

A production-ready implementation of a Model Context Protocol (MCP) server that provides AI models with secure access to external tools and services through a standardized JSON-RPC interface. This server implements the latest MCP specification with enhanced security and scalability features.

## ✨ Features

### Core
- **JSON-RPC 2.0** over HTTP with WebSocket support
- **TypeScript** first implementation with full type safety
- **Modular Architecture** for easy extension and customization

### Authentication & Security
- 🔒 **OAuth 2.0/OpenID Connect** integration
- 🔑 **JWT-based** authentication with refresh tokens
- 👥 **Role-based access control** (RBAC)
- 🛡️ **CORS** with configurable allowed origins
- ⏱️ **Rate limiting** to prevent abuse
- 🔄 **CSRF protection**

### Built-in Tools
- 🌦️ **Weather API** integration (OpenWeatherMap)
- 📁 **Secure file system** operations with sandboxing
- 💾 **SQLite database** with migrations
- 📊 **Logging** with Winston (console + file)
- 🔍 **Input validation** using Zod schemas

### Production Ready
- 🚀 **Containerized** with Docker
- 🔄 **Hot-reload** in development
- 📈 **Performance optimized**
- 🔒 **Security headers**
- 📝 **Comprehensive logging**
- 🧪 **Test coverage** with Jest

## 🚀 Getting Started

### Prerequisites

- Node.js 18+ or Docker
- npm or yarn
- SQLite3 (for database operations)
- OpenWeatherMap API key (for weather functionality)
- OAuth 2.0/OpenID Connect provider (e.g., Auth0, Okta, Keycloak)

### Quick Start

1. Clone and install:
   ```bash
   git clone https://github.com/yourusername/mcp-server.git
   cd mcp-server
   npm install
   cp .env.example .env
   ```

2. Configure your `.env` file (see below)

3. Start the development server:
   ```bash
   npm run dev
   ```

4. Access the API at `http://localhost:3000`

## Installation

1. Clone the repository:
   ```bash
   git clone https://github.com/yourusername/mcp-server.git
   cd mcp-server
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Copy the example environment file and update with your settings:
   ```bash
   cp .env.example .env
   ```

4. Update the `.env` file with your configuration.

## ⚙️ Configuration

### Environment Variables

Create a `.env` file in the root directory with the following variables:

```env
# ==================================
# Server Configuration
# ==================================
PORT=3000
NODE_ENV=development
BASE_URL=http://localhost:3000

# ==================================
# Logging
# ==================================
LOG_LEVEL=info  # error, warn, info, debug, verbose
LOG_FILE=logs/mcp-server.log

# ==================================
# Weather API (OpenWeatherMap)
# ==================================
OPENWEATHER_API_KEY=your_api_key_here
OPENWEATHER_BASE_URL=https://api.openweathermap.org/data/2.5
OPENWEATHER_TIMEOUT=5000  # ms

# ==================================
# Database
# ==================================
DB_PATH=./data/mcp-db.sqlite
DB_LOGGING=false

# ==================================
# Security
# ==================================
# JWT Configuration
JWT_SECRET=your_secure_jwt_secret
JWT_EXPIRES_IN=1h
REFRESH_TOKEN_EXPIRES_IN=7d

# Rate Limiting
RATE_LIMIT_WINDOW_MS=900000  # 15 minutes
RATE_LIMIT_MAX_REQUESTS=100

# Request Limits
MAX_REQUEST_SIZE=1mb
MAX_FILE_SIZE_MB=10

# CORS
CORS_ORIGIN=http://localhost:5173,http://localhost:3000
CORS_METHODS=GET,POST,PUT,DELETE,OPTIONS
CORS_ALLOWED_HEADERS=Content-Type,Authorization
CORS_CREDENTIALS=true

# ==================================
# OAuth 2.0 / OpenID Connect
# ==================================
OAUTH_ISSUER_URL=https://your-oidc-provider.com
OAUTH_CLIENT_ID=your_client_id
OAUTH_CLIENT_SECRET=your_client_secret
OAUTH_REDIRECT_URI=${BASE_URL}/auth/callback
OAUTH_SCOPE=openid profile email

# ==================================
# File System
# ==================================
SANDBOX_DIR=./sandbox
```

### OAuth Provider Setup

1. Register a new application with your OAuth provider
2. Set the callback URL to `http://localhost:3000/auth/callback`
3. Copy the client ID and secret to your `.env` file
4. Configure the required scopes: `openid profile email`

## 🚀 Usage

### Development

```bash
# Start development server with hot-reload
npm run dev

# Run tests
npm test

# Lint code
npm run lint

# Format code
npm run format
```

### Production

```bash
# Build the application
npm run build

# Start production server
npm start
```

### Docker

```bash
# Build and start containers
docker-compose up --build

# Run tests in Docker
docker-compose run --rm app npm test
```

## 📡 API Reference

### Base URL
All API endpoints are prefixed with `/api/v1`.

### Authentication

1. **Login**
   ```
   GET /auth/login
   ```
   Initiates the OAuth 2.0 flow.

2. **Callback**
   ```
   GET /auth/callback
   ```
   OAuth callback URL (handled automatically).

3. **Refresh Token**
   ```
   POST /auth/refresh
   ```
   Refresh an access token.

### JSON-RPC 2.0 Endpoint

```
POST /rpc
```

All RPC methods require a valid JWT token in the `Authorization` header:
```
Authorization: Bearer <your_jwt_token>
```

#### Example Request

```bash
curl -X POST http://localhost:3000/rpc \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <your_jwt_token>" \
  -d '{
    "jsonrpc": "2.0",
    "method": "weather.getCurrent",
    "params": {
      "city": "London"
    },
    "id": 1
  }'
```

Example response:

```json
{
  "jsonrpc": "2.0",
  "result": {
    "location": {
      "name": "London",
      "country": "GB",
      "coord": {
        "lat": 51.5074,
        "lon": -0.1278
      },
      "timezone": 0,
      "sunrise": "2023-05-01T04:45:12.000Z",
      "sunset": "2023-05-01T19:53:12.000Z"
    },
    "weather": {
      "main": "Clear",
      "description": "clear sky",
      "icon": "01d",
      "temperature": {
        "current": 15.5,
        "feelsLike": 14.8,
        "min": 13.2,
        "max": 17.1
      },
      "pressure": 1012,
      "humidity": 72,
      "visibility": 10,
      "wind": {
        "speed": 3.6,
        "deg": 200
      },
      "clouds": 0
    },
    "lastUpdated": "2023-05-01T12:00:00.000Z"
  },
  "id": 1
}
```

## 🔐 Authentication

The server uses OAuth 2.0 with OpenID Connect for authentication. The flow is as follows:

1. Client redirects to `/auth/login`
2. User authenticates with the OAuth provider
3. Provider redirects to `/auth/callback` with an authorization code
4. Server exchanges the code for tokens
5. Client receives an access token and refresh token

### Token Management

- **Access Token**: Short-lived (default: 1h), used for API authentication
- **Refresh Token**: Long-lived (default: 7d), used to obtain new access tokens

### Protected Endpoints

All endpoints except the following require authentication:
- `GET /health` - Health check
- `GET /auth/login` - OAuth login
- `GET /auth/callback` - OAuth callback
- `POST /auth/refresh` - Token refresh

## 🛠️ Available Methods

### Authentication

- `auth.getUserInfo(accessToken: string)`
  Get user information from the OAuth provider.

### Weather

- `weather.getCurrent(params: { city?: string, lat?: number, lon?: number, units?: string, lang?: string })`
  Get current weather for a location by city name or coordinates.

### File System

- `file.read(params: { path: string, encoding?: string })`
  Read a file from the sandbox directory.

- `file.write(params: { path: string, content: string, encoding?: string, createDir?: boolean, append?: boolean })`
  Write content to a file in the sandbox directory.

### Database

- `database.query(params: { sql: string, params?: any[], readOnly?: boolean })`
  Execute a SQL query against the database.
  ```json
  {
    "method": "database.query",
    "params": {
      "sql": "SELECT * FROM users WHERE id = ?",
      "params": ["user123"],
      "readOnly": true
    },
    "id": 1
  }
  ```

- `database.transaction(queries: Array<{ sql: string, params?: any[] }>)`
  Execute multiple SQL queries in a transaction.
  ```json
  {
    "method": "database.transaction",
    "params": {
      "queries": [
        {"sql": "INSERT INTO users (id, email) VALUES (?, ?)", "params": ["user123", "test@example.com"]},
        {"sql": "INSERT INTO user_profiles (user_id, name) VALUES (?, ?)", "params": ["user123", "Test User"]}
      ]
    },
    "id": 2
  }
  ```

### User Management

- `user.getProfile()`
  Get the current user's profile.
  
- `user.updateProfile(params: { email?: string, name?: string })`
  Update the current user's profile.

- `user.changePassword(params: { currentPassword: string, newPassword: string })`
  Change the user's password.

### System

- `system.getStatus()`
  Get system status and health information.
  
- `system.getMetrics()`
  Get system metrics (CPU, memory, etc.).

## 🧪 Testing

### Running Tests

```bash
# Run all tests
npm test

# Run tests with coverage
npm run test:coverage

# Run integration tests
npm run test:integration

# Run tests in watch mode
npm run test:watch
```

### Test Coverage

We aim to maintain high test coverage. Current coverage:
- Unit Tests: ~90%
- Integration Tests: ~80%
- E2E Tests: ~70%

### Linting

```bash
# Run linter
npm run lint

# Fix linting issues
npm run lint:fix
```

## 🚀 Deployment

### Docker (Recommended)

```bash
# Build and run with Docker Compose
docker-compose up --build -d

# View logs
docker-compose logs -f

# Run migrations
docker-compose run --rm app npm run db:migrate
```

### PM2 (Production)

```bash
# Install PM2 globally
npm install -g pm2

# Start in production
NODE_ENV=production pm2 start dist/index.js --name "mcp-server"

# Save process list
pm2 save

# Set up startup script
pm2 startup

# Monitor logs
pm2 logs mcp-server

# Monitor application
pm2 monit
```

### Kubernetes

Example deployment:

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: mcp-server
spec:
  replicas: 3
  selector:
    matchLabels:
      app: mcp-server
  template:
    metadata:
      labels:
        app: mcp-server
    spec:
      containers:
      - name: mcp-server
        image: your-registry/mcp-server:latest
        ports:
        - containerPort: 3000
        envFrom:
        - secretRef:
            name: mcp-secrets
        resources:
          limits:
            cpu: "1"
            memory: "512Mi"
          requests:
            cpu: "0.5"
            memory: "256Mi"
        livenessProbe:
          httpGet:
            path: /health
            port: 3000
          initialDelaySeconds: 30
          periodSeconds: 10
        readinessProbe:
          httpGet:
            path: /health
            port: 3000
          initialDelaySeconds: 5
          periodSeconds: 5
```

## 📚 Documentation

- [API Documentation](https://your-docs-url.com)
- [Developer Guide](https://your-docs-url.com/developer-guide)
- [API Reference](https://your-docs-url.com/api-reference)

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request
