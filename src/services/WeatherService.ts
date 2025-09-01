import fetch from 'node-fetch';
import { WeatherConfig } from '../config';
import { MCPError, BadRequestError } from '../utils/errors';
import logger from '../utils/logger';

interface WeatherParams {
  city?: string;
  lat?: number;
  lon?: number;
  units?: 'metric' | 'imperial' | 'standard';
  lang?: string;
}

interface WeatherResponse {
  coord: {
    lon: number;
    lat: number;
  };
  weather: Array<{
    id: number;
    main: string;
    description: string;
    icon: string;
  }>;
  base: string;
  main: {
    temp: number;
    feels_like: number;
    temp_min: number;
    temp_max: number;
    pressure: number;
    humidity: number;
    sea_level?: number;
    grnd_level?: number;
  };
  visibility: number;
  wind: {
    speed: number;
    deg: number;
    gust?: number;
  };
  clouds: {
    all: number;
  };
  dt: number;
  sys: {
    type?: number;
    id?: number;
    country: string;
    sunrise: number;
    sunset: number;
  };
  timezone: number;
  id: number;
  name: string;
  cod: number;
}

interface WeatherData {
  temperature: number;
  humidity: number;
  description: string;
  city: string;
  country?: string;
  icon: string;
  timestamp: Date;
  feels_like?: number;
  pressure?: number;
  wind_speed?: number;
  visibility?: number;
  clouds?: number;
  dt?: number;
}

interface WeatherQueryParams {
  city: string;
  country?: string;
  units?: 'metric' | 'imperial';
  lang?: string;
}

export class WeatherService {
  private config: WeatherConfig;
  private baseUrl: string;
  private apiKey: string;
  private timeout: number = 10000; // 10 seconds
  private logger: typeof logger;

  constructor(config: WeatherConfig) {
    this.config = config;
    this.baseUrl = config.baseUrl;
    this.apiKey = config.apiKey;
    this.logger = logger;
  }

  /**
   * Get current weather for a location
   * @param params Weather parameters (city or lat/lon)
   * @returns Current weather data
   */
  private formatWeatherData(data: any, units: string = 'metric'): WeatherData {
    return {
      temperature: data.main.temp,
      humidity: data.main.humidity,
      description: data.weather[0].description,
      city: data.name,
      country: data.sys?.country,
      icon: data.weather[0].icon, // Add the icon code to the response
      timestamp: new Date(),
      // Include additional weather data that might be useful
      feels_like: data.main.feels_like,
      pressure: data.main.pressure,
      wind_speed: data.wind?.speed,
      visibility: data.visibility,
      clouds: data.clouds?.all,
      dt: data.dt
    };
  }

  public async getCurrentWeather(params: WeatherQueryParams): Promise<WeatherData> {
    const { city, country, units = 'metric', lang = 'en' } = params;
    
    if (!city) {
      const error = new Error('City is required');
      (error as any).code = 'MISSING_CITY';
      (error as any).statusCode = 400;
      throw error;
    }

    const query = country ? `${city},${country}` : city;
    const url = new URL('https://api.openweathermap.org/data/2.5/weather');
    
    // Debug log the API key (redacted for security)
    console.log('Using OpenWeather API key (first 5 chars):', this.apiKey ? `${this.apiKey.substring(0, 5)}...` : 'undefined');
    
    url.searchParams.append('q', query);
    url.searchParams.append('appid', this.apiKey);
    url.searchParams.append('units', units);
    url.searchParams.append('lang', lang);
    
    // Debug log the full URL (with redacted API key)
    const debugUrl = new URL(url.toString());
    if (debugUrl.searchParams.has('appid')) {
      debugUrl.searchParams.set('appid', '***REDACTED***');
    }
    console.log('Making request to:', debugUrl.toString());

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.timeout);

    try {
      const response = await fetch(url.toString(), {
        signal: controller.signal as AbortSignal,
      });

      clearTimeout(timeout);

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw this.normalizeWeatherError(response.status, typeof errorData === 'object' && errorData !== null ? errorData : {});
      }

      const data = await response.json();
      return this.formatWeatherData(data, units);
    } catch (error: unknown) {
      const fetchError = error as Error & { name?: string };
      if (fetchError.name === 'AbortError') {
        const timeoutError = new Error('Weather API request timed out');
        (timeoutError as any).code = 'REQUEST_TIMEOUT';
        (timeoutError as any).statusCode = 504;
        throw timeoutError;
      }
      
      // If it's already a normalized error, just rethrow
      if (error && typeof error === 'object' && 'code' in error) {
        throw error;
      }
      
      // Log the error
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      this.logger?.error('Failed to fetch weather data', {
        error: errorMessage,
        params,
      });
      
      // Create a normalized error
      const normalizedError = new Error(errorMessage);
      (normalizedError as any).code = 'WEATHER_API_ERROR';
      (normalizedError as any).statusCode = 500;
      throw normalizedError;
    }
  }
  
  /**
   * Validate weather request parameters
   */
  private validateParams(params: WeatherParams): void {
    if (!params.city && (params.lat === undefined || params.lon === undefined)) {
      const error = new Error('Either city or lat/lon coordinates must be provided');
      (error as any).code = 'INVALID_PARAMS';
      (error as any).statusCode = 400;
      throw error;
    }
    
    if (params.units && !['metric', 'imperial', 'standard'].includes(params.units)) {
      const error = new Error('Invalid units. Must be one of: metric, imperial, standard');
      (error as any).code = 'INVALID_UNITS';
      (error as any).statusCode = 400;
      throw error;
    }
    
    if (params.city && (params.lat !== undefined || params.lon !== undefined)) {
      const error = new Error('Cannot specify both city and coordinates');
      (error as any).code = 'INVALID_PARAMS';
      (error as any).statusCode = 400;
      throw error;
    }
  }
  
  /**
   * Handle Weather API errors
   */
  private normalizeWeatherError(status: number, data: { message?: string } = {}): Error {
    const errorMap: { [key: number]: { message: string; code: string } } = {
      400: { message: 'Invalid request parameters', code: 'INVALID_PARAMETERS' },
      401: { message: 'Invalid API key', code: 'INVALID_API_KEY' },
      404: { message: 'City not found', code: 'CITY_NOT_FOUND' },
      429: { message: 'API rate limit exceeded', code: 'RATE_LIMIT_EXCEEDED' },
      500: { message: 'Weather API server error', code: 'WEATHER_API_ERROR' },
      502: { message: 'Weather API is currently unavailable', code: 'SERVICE_UNAVAILABLE' },
      503: { message: 'Weather API service unavailable', code: 'SERVICE_UNAVAILABLE' },
      504: { message: 'Weather API gateway timeout', code: 'GATEWAY_TIMEOUT' },
    };
    
    const errorInfo = errorMap[status] || {
      message: 'Unexpected error from Weather API',
      code: 'UNEXPECTED_ERROR',
    };
    
    // Create a plain error object instead of MCPError
    const error = new Error(errorInfo.message);
    (error as any).code = errorInfo.code;
    (error as any).statusCode = status >= 500 ? 502 : 400; // Convert 5xx to 502 Bad Gateway
    (error as any).details = {
      originalStatus: status,
      ...(data?.message && { originalMessage: data.message }),
    };
    
    return error;
  }
  
  /**
   * Format the weather API response
   */
  private formatWeatherResponse(data: WeatherResponse): any {
    return {
      location: {
        name: data.name,
        country: data.sys.country,
        coord: {
          lat: data.coord.lat,
          lon: data.coord.lon,
        },
        timezone: data.timezone,
        sunrise: new Date(data.sys.sunrise * 1000).toISOString(),
        sunset: new Date(data.sys.sunset * 1000).toISOString(),
      },
      weather: {
        main: data.weather[0]?.main,
        description: data.weather[0]?.description,
        icon: data.weather[0]?.icon,
        temperature: {
          current: data.main.temp,
          feelsLike: data.main.feels_like,
          min: data.main.temp_min,
          max: data.main.temp_max,
        },
        pressure: data.main.pressure,
        humidity: data.main.humidity,
        visibility: data.visibility / 1000, // Convert meters to kilometers
        wind: {
          speed: data.wind.speed,
          deg: data.wind.deg,
          gust: data.wind.gust,
        },
        clouds: data.clouds.all,
      },
      lastUpdated: new Date(data.dt * 1000).toISOString(),
    };
  }
}
