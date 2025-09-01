import { ApiClient } from './client';

// Create a single instance of the API client
const api = new ApiClient(import.meta.env.VITE_API_BASE_URL);

export { api };
