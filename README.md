# MCP (Model Context Protocol) Server

A production-ready implementation of a Model Context Protocol (MCP) server that provides AI models with access to external tools and services through a standardized JSON-RPC interface.

## Features

- **JSON-RPC 2.0** over HTTP with WebSocket support
- **Modular Architecture** for easy extension
- **Built-in Tools**:
  - Weather API integration
  - Secure file system operations
  - SQLite database access
- **Production-Ready**:
  - Comprehensive error handling
  - Logging with Winston
  - Configuration management
  - Input validation
  - Security best practices

## Prerequisites

- Node.js 16+ or Docker
- npm or yarn
- SQLite3 (for database operations)
- OpenWeatherMap API key (for weather functionality)

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

## Configuration

Edit the `.env` file to configure the server:

```env
# Server Configuration
PORT=3000
NODE_ENV=development

# Logging
LOG_LEVEL=info
LOG_FILE=logs/mcp-server.log

# Weather API (OpenWeatherMap)
OPENWEATHER_API_KEY=your_api_key_here

# Database
DB_PATH=./data/mcp-db.sqlite

# Security
MAX_REQUEST_SIZE=1mb
RATE_LIMIT_WINDOW_MS=900000  # 15 minutes
RATE_LIMIT_MAX_REQUESTS=100

# File System
SANDBOX_DIR=./sandbox
MAX_FILE_SIZE_MB=10
```

## Usage

### Starting the Server

```bash
# Development mode with hot-reload
npm run dev

# Production mode
npm start

# Using Docker
docker-compose up --build
```

### Making Requests

The server exposes a JSON-RPC 2.0 endpoint at `POST /rpc`.

Example request:

```json
{
  "jsonrpc": "2.0",
  "method": "weather.getCurrent",
  "params": {
    "city": "London"
  },
  "id": 1
}
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

## Available Methods

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

- `database.transaction(queries: Array<{ sql: string, params?: any[] }>)`
  Execute multiple SQL queries in a transaction.

## Security

- All file system operations are sandboxed to the configured `SANDBOX_DIR`
- SQL injection prevention measures are in place
- Request size limits to prevent DoS attacks
- Rate limiting to prevent abuse
- Environment variables for sensitive configuration

## Testing

```bash
# Run tests
npm test

# Run tests with coverage
npm run test:coverage
```

## Deployment

### Docker

```bash
docker build -t mcp-server .
docker run -p 3000:3000 --env-file .env mcp-server
```

### PM2 (Production)

```bash
# Install PM2 globally
npm install -g pm2

# Start the server
pm2 start dist/index.js --name "mcp-server"

# Save process list for auto-start on reboot
pm2 save
pm2 startup
```

## License

MIT

## Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request
