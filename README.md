# MCP (Model Context Protocol) Server

A production-ready implementation of a Model Context Protocol (MCP) server with a modern React frontend. The server provides a secure JSON-RPC interface for AI model interactions, while the frontend offers a user-friendly dashboard for monitoring and management.

## ✨ Features

### Backend (Node.js/TypeScript)
- **JSON-RPC 2.0** over HTTP with WebSocket support
- **TypeScript** with full type safety
- **Modular Architecture** for easy extension
- **SQLite** database with migrations
- **JWT-based** authentication with OAuth 2.0 support
- **Rate limiting** and security headers
- **Winston** logging with file rotation
- **Health checks** with detailed system metrics
- **API Documentation** with Swagger/OpenAPI
- **Containerization** with Docker

### Frontend (React/TypeScript)
- 🚀 **Vite** for fast development and builds
- 🎨 **Material-UI** (MUI) for beautiful, responsive UI
- 🔄 **React Query** for server state management
- 🛡️ **Secure API** client with token refresh
- 📱 **Mobile-responsive** design with PWA support
- 🎭 **Theming** support
- 📊 **Real-time** monitoring and metrics
- 🔍 **Error tracking** with Sentry

## 🚀 Getting Started

### Prerequisites

- Node.js 18+
- npm or yarn
- SQLite3 (included in most systems)
- Docker (optional, for containerized deployment)

### Quick Start

1. Clone and install dependencies:
   ```bash
   git clone https://github.com/edogola4/mcp.git
   cd mcp
   
   # Install backend dependencies
   npm install
   
   # Install frontend dependencies
   cd client
   npm install
   cd ..
   ```

2. Set up environment variables:
   ```bash
   # Run the setup script
   npm run setup
   
   # Or manually copy the example config
   cp config.example.ts .env
   ```
   
   Edit the `.env` file and update the configuration values as needed.
   ```

3. Start the development servers:
   ```bash
   # In the root directory (for the backend)
   npm run dev
   
   # In a new terminal, from the client directory (for the frontend)
   cd client
   npm run dev
   ```

## 🛠️ Configuration

### Environment Variables

All configuration is managed through environment variables. The following environment variables are available:

#### Server Configuration
- `NODE_ENV`: Application environment (`development`, `production`, `test`)
- `PORT`: Port to run the server on (default: `3000`)
- `HOST`: Host to bind the server to (default: `0.0.0.0`)

#### Security
- `JWT_SECRET`: Secret key for JWT token signing (required)
- `JWT_EXPIRES_IN`: JWT token expiration time (default: `1d`)
- `CORS_ORIGIN`: Allowed CORS origins (default: `*`)
- `RATE_LIMIT_WINDOW_MS`: Rate limiting window in milliseconds (default: `900000` - 15 minutes)
- `RATE_LIMIT_MAX`: Maximum requests per window (default: `100`)

#### Database
- `DB_PATH`: Path to SQLite database file (default: `./data/mcp-db.sqlite`)
- `DB_LOGGING`: Enable database query logging (default: `false`)

#### Logging
- `LOG_LEVEL`: Logging level (`error`, `warn`, `info`, `http`, `verbose`, `debug`, `silly`)
- `LOG_TO_FILE`: Enable logging to file (default: `false`)
- `LOG_FILE_PATH`: Path to log file (default: `logs/app.log`)

#### API Documentation
- `API_DOCS_ENABLED`: Enable API documentation (default: `true`)
- `API_DOCS_PATH`: Path to API documentation (default: `/api-docs`)

#### OAuth (Optional)
- `OAUTH_ENABLED`: Enable OAuth authentication (default: `false`)
- `OAUTH_ISSUER_URL`: OAuth provider URL
- `OAUTH_CLIENT_ID`: OAuth client ID
- `OAUTH_CLIENT_SECRET`: OAuth client secret
- `OAUTH_REDIRECT_URI`: OAuth redirect URI
- `OAUTH_SCOPE`: OAuth scopes (default: `openid profile email`)

## 🚀 Development

### Running the Application

#### Development Mode

```bash
# Start the backend server
npm run dev

# In a separate terminal, start the frontend
cd client
npm run dev
```

#### Production Build

```bash
# Build the application
npm run build

# Start the production server
npm start
```

### Testing

```bash
# Run tests
npm test

# Run tests with coverage
npm run test:coverage

# Run tests in watch mode
npm run test:watch
```

## 🐳 Docker Support

The application includes Docker support for easy deployment:

```bash
# Build the Docker image
docker build -t mcp-server .

# Run the container
docker run -p 3000:3000 --env-file .env mcp-server
```

## 📦 Production Deployment

For production deployment, consider the following:

1. Set `NODE_ENV=production`
2. Configure a reverse proxy (Nginx, Apache, etc.)
3. Set up HTTPS with a valid SSL certificate
4. Configure proper logging and monitoring
5. Set up a process manager (PM2, systemd, etc.)

## 🤝 Contributing

Contributions are welcome! Please read our [Contributing Guidelines](CONTRIBUTING.md) for details.

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 📞 Support

For support, please open an issue in the [GitHub repository](https://github.com/edogola4/mcp/issues).
   npm run dev
   ```

4. Access the application:
   - Frontend: http://localhost:3001
   - Backend API: http://localhost:3000

## Project Structure

```
mcp-server/
├── client/                # Frontend React application
│   ├── public/           # Static files
│   └── src/              # React source code
│       ├── api/          # API client and RPC calls
│       ├── components/   # Reusable UI components
│       └── pages/        # Page components
├── src/                  # Backend source code
│   ├── config/          # Configuration files
│   ├── controllers/     # Request handlers
│   ├── core/            # Core application logic
│   └── services/        # Business logic services
├── .env.example         # Example environment variables
└── package.json         # Backend dependencies and scripts
```

## Development

### Backend

```bash
# Install dependencies
npm install

# Start development server with hot-reload
npm run dev:server

# Run tests
npm test
```

### Frontend

```bash
cd client

# Install dependencies
npm install

# Start development server
npm run dev
```

## Production Build

```bash
# Build frontend
cd client
npm run build

# Start production server (from root)
npm start
```

## ⚙️ Configuration

### Backend Environment Variables

Create a `.env` file in the root directory with the following variables:

```env
# Server Configuration
PORT=3000
NODE_ENV=development
BASE_URL=http://localhost:3000

# Database
DB_PATH=./data/mcp-db.sqlite
DB_LOGGING=false

# JWT Configuration
JWT_SECRET=your_secure_jwt_secret
JWT_EXPIRES_IN=1h
REFRESH_TOKEN_EXPIRES_IN=7d

# CORS
CORS_ORIGIN=http://localhost:3001
CORS_METHODS=GET,POST,PUT,DELETE,OPTIONS
CORS_ALLOWED_HEADERS=Content-Type,Authorization
CORS_CREDENTIALS=true
```

### Frontend Configuration

The frontend is pre-configured to connect to the backend at `http://localhost:3000`. If you need to change this, modify the proxy settings in `client/vite.config.final.ts`.

## 📡 API Reference

The API uses JSON-RPC 2.0 over HTTP. All endpoints are prefixed with `/api`.

### Authentication

1. **Login**
   ```
   POST /api/auth/login
   ```
   Authenticate with username and password.

2. **Refresh Token**
   ```
   POST /api/auth/refresh
   ```
   Get a new access token using a refresh token.

### RPC Endpoint

```
POST /api/rpc
```

Example request:
```json
{
  "jsonrpc": "2.0",
  "method": "health.check",
  "params": {},
  "id": 1
}
```

## 📦 Deployment

### PM2 (Recommended for Production)

```bash
# Install PM2 globally
npm install -g pm2

# Start the application
pm2 start npm --name "mcp-server" -- start

# Enable startup on system boot
pm2 startup
pm2 save
```

### Docker

```bash
# Build and start containers
docker-compose up --build -d
```

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
