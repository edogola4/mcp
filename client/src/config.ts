// API Configuration
export const API_CONFIG = {
  // Use the RPC endpoint for all API calls
  BASE_URL: '', // Empty string since we handle the /rpc path in the client
  RPC_PATH: '/rpc', // RPC endpoint path
  // In production, you would use an environment variable:
  // BASE_URL: import.meta.env.VITE_API_BASE_URL || '',
  TIMEOUT: 10000,
};
