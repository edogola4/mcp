import { WeatherService } from '../../services/WeatherService';
import fetch from 'node-fetch';
import { BadRequestError } from '../../utils/errors';

// Mock node-fetch
jest.mock('node-fetch');
const { Response } = jest.requireActual('node-fetch');

const mockConfig = {
  apiKey: 'test-api-key',
  baseUrl: 'https://api.openweathermap.org/data/2.5',
  timeout: 5000,
};

describe('WeatherService', () => {
  let weatherService: WeatherService;

  beforeEach(() => {
    jest.clearAllMocks();
    weatherService = new WeatherService(mockConfig);
  });

  describe('getCurrentWeather', () => {
    it('should fetch current weather by city name', async () => {
      const mockResponse = {
        coord: { lon: -0.1257, lat: 51.5085 },
        weather: [
          {
            id: 800,
            main: 'Clear',
            description: 'clear sky',
            icon: '01d',
          },
        ],
        base: 'stations',
        main: {
          temp: 15.5,
          feels_like: 14.8,
          temp_min: 14.5,
          temp_max: 16.5,
          pressure: 1012,
          humidity: 72,
        },
        visibility: 10000,
        wind: {
          speed: 3.6,
          deg: 200,
        },
        clouds: {
          all: 0,
        },
        dt: 1620000000,
        sys: {
          type: 2,
          id: 2019646,
          country: 'GB',
          sunrise: 1619950000,
          sunset: 1620000000,
        },
        timezone: 3600,
        id: 2643743,
        name: 'London',
        cod: 200,
      };

      (fetch as jest.MockedFunction<typeof fetch>).mockResolvedValueOnce(
        new Response(JSON.stringify(mockResponse))
      );

      const result = await weatherService.getCurrentWeather({
        city: 'London',
        units: 'metric',
      });

      expect(fetch).toHaveBeenCalledWith(
        'https://api.openweathermap.org/data/2.5/weather?q=London&appid=test-api-key&units=metric',
        expect.any(Object)
      );

      expect(result).toMatchObject({
        location: {
          name: 'London',
          country: 'GB',
          coord: {
            lat: 51.5085,
            lon: -0.1257,
          },
        },
        weather: {
          main: 'Clear',
          description: 'clear sky',
          icon: '01d',
          temperature: {
            current: 15.5,
            feelsLike: 14.8,
            min: 14.5,
            max: 16.5,
          },
          pressure: 1012,
          humidity: 72,
          visibility: 10,
          wind: {
            speed: 3.6,
            deg: 200,
          },
          clouds: 0,
        },
      });
    });

    it('should fetch current weather by coordinates', async () => {
      (fetch as jest.MockedFunction<typeof fetch>).mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            name: 'London',
            sys: { country: 'GB' },
            weather: [{}],
            main: {},
            wind: {},
            clouds: {},
          })
        )
      );

      await weatherService.getCurrentWeather({
        lat: 51.5085,
        lon: -0.1257,
      });

      expect(fetch).toHaveBeenCalledWith(
        'https://api.openweathermap.org/data/2.5/weather?lat=51.5085&lon=-0.1257&appid=test-api-key&units=metric',
        expect.any(Object)
      );
    });

    it('should throw BadRequestError when neither city nor coordinates are provided', async () => {
      await expect(weatherService.getCurrentWeather({})).rejects.toThrow(
        BadRequestError
      );
    });

    it('should handle API errors', async () => {
      (fetch as jest.MockedFunction<typeof fetch>).mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            cod: 401,
            message: 'Invalid API key',
          }),
          { status: 401 }
        )
      );

      await expect(
        weatherService.getCurrentWeather({ city: 'London' })
      ).rejects.toThrow('Invalid API key');
    });

    it('should handle network errors', async () => {
      (fetch as jest.MockedFunction<typeof fetch>).mockRejectedValueOnce(
        new Error('Network error')
      );

      await expect(
        weatherService.getCurrentWeather({ city: 'London' })
      ).rejects.toThrow('Failed to fetch weather data');
    });
  });

  describe('validateParams', () => {
    it('should not throw for valid city parameter', () => {
      expect(() =>
        weatherService['validateParams']({ city: 'London' })
      ).not.toThrow();
    });

    it('should not throw for valid coordinates', () => {
      expect(() =>
        weatherService['validateParams']({ lat: 51.5085, lon: -0.1257 })
      ).not.toThrow();
    });

    it('should throw for missing parameters', () => {
      expect(() => weatherService['validateParams']({})).toThrow(
        'Either city or lat/lon coordinates must be provided'
      );
    });

    it('should throw for invalid units', () => {
      expect(() =>
        weatherService['validateParams']({ city: 'London', units: 'invalid' })
      ).toThrow('Invalid units. Must be one of: metric, imperial, standard');
    });

    it('should throw when both city and coordinates are provided', () => {
      expect(() =>
        weatherService['validateParams']({
          city: 'London',
          lat: 51.5085,
          lon: -0.1257,
        })
      ).toThrow('Cannot specify both city and coordinates');
    });
  });

  describe('handleWeatherApiError', () => {
    it('should handle 404 error', () => {
      const error = weatherService['handleWeatherApiError'](404, {
        message: 'city not found',
      });

      expect(error).toBeInstanceOf(Error);
      expect(error.message).toBe('City not found');
      expect(error['statusCode']).toBe(400);
      expect(error['code']).toBe('CITY_NOT_FOUND');
    });

    it('should handle 401 error', () => {
      const error = weatherService['handleWeatherApiError'](401, {
        message: 'Invalid API key',
      });

      expect(error.message).toBe('Invalid API key');
      expect(error['code']).toBe('INVALID_API_KEY');
    });

    it('should handle 429 error', () => {
      const error = weatherService['handleWeatherApiError'](429, {
        message: 'API rate limit exceeded',
      });

      expect(error.message).toBe('API rate limit exceeded');
      expect(error['code']).toBe('RATE_LIMIT_EXCEEDED');
    });

    it('should handle unknown error', () => {
      const error = weatherService['handleWeatherApiError'](500, {
        message: 'Internal server error',
      });

      expect(error.message).toBe('Weather API server error');
      expect(error['code']).toBe('WEATHER_API_ERROR');
    });
  });

  describe('formatWeatherResponse', () => {
    it('should format the weather response correctly', () => {
      const input = {
        coord: { lon: -0.1257, lat: 51.5085 },
        weather: [
          {
            id: 800,
            main: 'Clear',
            description: 'clear sky',
            icon: '01d',
          },
        ],
        base: 'stations',
        main: {
          temp: 15.5,
          feels_like: 14.8,
          temp_min: 14.5,
          temp_max: 16.5,
          pressure: 1012,
          humidity: 72,
        },
        visibility: 10000,
        wind: {
          speed: 3.6,
          deg: 200,
          gust: 4.1,
        },
        clouds: {
          all: 0,
        },
        dt: 1620000000,
        sys: {
          type: 2,
          id: 2019646,
          country: 'GB',
          sunrise: 1619950000,
          sunset: 1620000000,
        },
        timezone: 0,
        id: 2643743,
        name: 'London',
        cod: 200,
      };

      const result = weatherService['formatWeatherResponse'](input as any);

      expect(result).toEqual({
        location: {
          name: 'London',
          country: 'GB',
          coord: {
            lat: 51.5085,
            lon: -0.1257,
          },
          timezone: 0,
          sunrise: '2021-05-01T23:46:40.000Z',
          sunset: '2021-05-03T00:00:00.000Z',
        },
        weather: {
          main: 'Clear',
          description: 'clear sky',
          icon: '01d',
          temperature: {
            current: 15.5,
            feelsLike: 14.8,
            min: 14.5,
            max: 16.5,
          },
          pressure: 1012,
          humidity: 72,
          visibility: 10,
          wind: {
            speed: 3.6,
            deg: 200,
            gust: 4.1,
          },
          clouds: 0,
        },
        lastUpdated: '2021-05-03T00:00:00.000Z',
      });
    });
  });
});
