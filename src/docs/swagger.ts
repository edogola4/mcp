import { OpenAPIV3 } from 'openapi-types';

// Helper type for parameter items
type ParameterItemsObject = {
  type?: 'string' | 'number' | 'integer' | 'boolean' | 'array';
  items?: ParameterItemsObject | OpenAPIV3.ReferenceObject;
  oneOf?: Array<{ type: string }>;
  [key: string]: any;
} & Omit<OpenAPIV3.NonArraySchemaObject, 'type'>;

// Helper type for schema properties
interface SchemaProperties {
  [name: string]: OpenAPIV3.ReferenceObject | OpenAPIV3.SchemaObject | ParameterItemsObject;
}

export const swaggerDefinition: OpenAPIV3.Document = {
  openapi: '3.0.0',
  info: {
    title: 'MCP Server API',
    version: '1.0.0',
    description: 'MCP (Microservice Control Plane) Server API Documentation',
    contact: {
      name: 'API Support',
      email: 'support@example.com'
    },
    license: {
      name: 'Apache 2.0',
      url: 'https://www.apache.org/licenses/LICENSE-2.0.html'
    }
  },
  servers: [
    {
      url: 'http://localhost:3000/api/v1',
      description: 'Development server'
    },
    {
      url: 'https://api.example.com/v1',
      description: 'Production server'
    }
  ],
  tags: [
    {
      name: 'Authentication',
      description: 'Authentication and user management endpoints'
    },
    {
      name: 'Weather',
      description: 'Weather data endpoints'
    },
    {
      name: 'Files',
      description: 'File management endpoints'
    },
    {
      name: 'Database',
      description: 'Database query endpoints'
    }
  ],
  components: {
    securitySchemes: {
      bearerAuth: {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
        description: 'JWT token obtained from the login endpoint'
      },
      apiKeyAuth: {
        type: 'apiKey',
        in: 'header',
        name: 'x-api-key',
        description: 'API key for programmatic access'
      }
    },
    schemas: {
      Error: {
        type: 'object',
        properties: {
          success: {
            type: 'boolean',
            example: false
          },
          error: {
            type: 'object',
            properties: {
              code: {
                type: 'string',
                example: 'VALIDATION_ERROR'
              },
              message: {
                type: 'string',
                example: 'Validation failed'
              },
              details: {
                type: 'object',
                additionalProperties: true
              }
            }
          },
          requestId: {
            type: 'string',
            format: 'uuid',
            example: '550e8400-e29b-41d4-a716-446655440000'
          }
        }
      },
      WeatherData: {
        type: 'object',
        properties: {
          location: {
            type: 'string',
            example: 'New York, US'
          },
          temperature: {
            type: 'number',
            format: 'float',
            example: 22.5
          },
          unit: {
            type: 'string',
            enum: ['celsius', 'fahrenheit'],
            example: 'celsius'
          },
          condition: {
            type: 'string',
            example: 'Clear'
          },
          humidity: {
            type: 'number',
            format: 'int32',
            example: 65
          },
          windSpeed: {
            type: 'number',
            format: 'float',
            example: 5.2
          },
          windDirection: {
            type: 'string',
            example: 'NW'
          },
          timestamp: {
            type: 'string',
            format: 'date-time',
            example: '2023-05-15T14:30:00Z'
          }
        }
      },
      FileContent: {
        type: 'object',
        properties: {
          path: {
            type: 'string',
            example: '/path/to/file.txt'
          },
          content: {
            type: 'string',
            format: 'binary',
            description: 'File content (base64 encoded for binary files)'
          },
          size: {
            type: 'integer',
            format: 'int64',
            example: 1024
          },
          type: {
            type: 'string',
            enum: ['file', 'directory'],
            example: 'file'
          },
          mtime: {
            type: 'string',
            format: 'date-time'
          },
          ctime: {
            type: 'string',
            format: 'date-time'
          }
        }
      },
      QueryResult: {
        type: 'object',
        properties: {
          rows: {
            type: 'array',
            items: {
              type: 'object',
              additionalProperties: true
            }
          },
          fields: {
            type: 'array',
            items: {
              type: 'string'
            },
            example: ['id', 'name', 'createdAt']
          },
          rowCount: {
            type: 'integer',
            example: 1
          },
          lastID: {
            type: 'integer',
            example: 1
          },
          changes: {
            type: 'integer',
            example: 1
          }
        }
      },
      Pagination: {
        type: 'object',
        properties: {
          page: {
            type: 'integer',
            minimum: 1,
            default: 1,
            description: 'Page number (1-based)'
          },
          limit: {
            type: 'integer',
            minimum: 1,
            maximum: 100,
            default: 20,
            description: 'Number of items per page'
          },
          total: {
            type: 'integer',
            description: 'Total number of items',
            example: 100
          },
          pages: {
            type: 'integer',
            description: 'Total number of pages',
            example: 5
          }
        }
      }
    },
    parameters: {
      pageParam: {
        name: 'page',
        in: 'query',
        description: 'Page number (1-based)',
        required: false,
        schema: {
          type: 'integer',
          minimum: 1,
          default: 1
        }
      },
      limitParam: {
        name: 'limit',
        in: 'query',
        description: 'Number of items per page',
        required: false,
        schema: {
          type: 'integer',
          minimum: 1,
          maximum: 100,
          default: 20
        }
      },
      sortParam: {
        name: 'sort',
        in: 'query',
        description: 'Sort field and direction (e.g., "name:asc" or "createdAt:desc")',
        required: false,
        schema: {
          type: 'string'
        }
      }
    },
    responses: {
      UnauthorizedError: {
        description: 'Unauthorized - Authentication token is missing or invalid',
        content: {
          'application/json': {
            schema: {
              $ref: '#/components/schemas/Error'
            },
            example: {
              success: false,
              error: {
                code: 'UNAUTHORIZED',
                message: 'Authentication required'
              }
            }
          }
        }
      },
      ForbiddenError: {
        description: 'Forbidden - User does not have permission to access this resource',
        content: {
          'application/json': {
            schema: {
              $ref: '#/components/schemas/Error'
            },
            example: {
              success: false,
              error: {
                code: 'FORBIDDEN',
                message: 'Insufficient permissions'
              }
            }
          }
        }
      },
      ValidationError: {
        description: 'Validation error',
        content: {
          'application/json': {
            schema: {
              $ref: '#/components/schemas/Error'
            },
            example: {
              success: false,
              error: {
                code: 'VALIDATION_ERROR',
                message: 'Validation failed',
                details: [
                  {
                    param: 'email',
                    message: 'Invalid email address',
                    value: 'invalid-email'
                  }
                ]
              }
            }
          }
        }
      },
      NotFoundError: {
        description: 'Resource not found',
        content: {
          'application/json': {
            schema: {
              $ref: '#/components/schemas/Error'
            },
            example: {
              success: false,
              error: {
                code: 'NOT_FOUND',
                message: 'The requested resource was not found'
              }
            }
          }
        }
      },
      RateLimitError: {
        description: 'Too many requests',
        content: {
          'application/json': {
            schema: {
              $ref: '#/components/schemas/Error'
            },
            example: {
              success: false,
              error: {
                code: 'RATE_LIMIT_EXCEEDED',
                message: 'Too many requests, please try again later',
                details: {
                  retryAfter: 60
                }
              }
            }
          }
        }
      }
    }
  },
  paths: {
    '/auth/login': {
      post: {
        tags: ['Authentication'],
        summary: 'Authenticate user and get JWT token',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['email', 'password'],
                properties: {
                  email: {
                    type: 'string',
                    format: 'email',
                    example: 'user@example.com'
                  },
                  password: {
                    type: 'string',
                    format: 'password',
                    minLength: 8,
                    example: 'your-password'
                  }
                }
              }
            }
          }
        },
        responses: {
          '200': {
            description: 'Authentication successful',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    success: {
                      type: 'boolean',
                      example: true
                    },
                    data: {
                      type: 'object',
                      properties: {
                        token: {
                          type: 'string',
                          example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...'
                        },
                        user: {
                          type: 'object',
                          properties: {
                            id: {
                              type: 'string',
                              format: 'uuid'
                            },
                            email: {
                              type: 'string',
                              format: 'email'
                            },
                            roles: {
                              type: 'array',
                              items: {
                                type: 'string'
                              }
                            }
                          }
                        }
                      }
                    }
                  }
                }
              }
            }
          },
          '400': {
            $ref: '#/components/responses/ValidationError'
          },
          '401': {
            description: 'Invalid credentials',
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/Error'
                },
                example: {
                  success: false,
                  error: {
                    code: 'INVALID_CREDENTIALS',
                    message: 'Invalid email or password'
                  }
                }
              }
            }
          }
        }
      }
    },
    '/weather/current': {
      get: {
        tags: ['Weather'],
        summary: 'Get current weather for a location',
        security: [
          { bearerAuth: [] },
          { apiKeyAuth: [] }
        ],
        parameters: [
          {
            name: 'location',
            in: 'query',
            description: 'City name, zip code, or coordinates (lat,lon)',
            required: true,
            schema: {
              type: 'string',
              example: 'New York,US'
            }
          },
          {
            name: 'units',
            in: 'query',
            description: 'Temperature unit',
            required: false,
            schema: {
              type: 'string',
              enum: ['metric', 'imperial'],
              default: 'metric'
            }
          }
        ],
        responses: {
          '200': {
            description: 'Current weather data',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    success: {
                      type: 'boolean',
                      example: true
                    },
                    data: {
                      $ref: '#/components/schemas/WeatherData'
                    }
                  }
                }
              }
            }
          },
          '400': {
            $ref: '#/components/responses/ValidationError'
          },
          '401': {
            $ref: '#/components/responses/UnauthorizedError'
          },
          '404': {
            description: 'Location not found',
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/Error'
                },
                example: {
                  success: false,
                  error: {
                    code: 'LOCATION_NOT_FOUND',
                    message: 'Could not find the specified location'
                  }
                }
              }
            }
          },
          '429': {
            $ref: '#/components/responses/RateLimitError'
          },
          '500': {
            description: 'Weather service unavailable',
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/Error'
                },
                example: {
                  success: false,
                  error: {
                    code: 'SERVICE_UNAVAILABLE',
                    message: 'Weather service is currently unavailable'
                  }
                }
              }
            }
          }
        }
      }
    },
    '/files': {
      get: {
        tags: ['Files'],
        summary: 'List files in a directory',
        security: [
          { bearerAuth: [] },
          { apiKeyAuth: [] }
        ],
        parameters: [
          {
            name: 'path',
            in: 'query',
            description: 'Directory path (relative to base directory)',
            required: false,
            schema: {
              type: 'string',
              default: '/'
            }
          },
          {
            $ref: '#/components/parameters/pageParam'
          },
          {
            $ref: '#/components/parameters/limitParam'
          },
          {
            $ref: '#/components/parameters/sortParam'
          }
        ],
        responses: {
          '200': {
            description: 'List of files and directories',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    success: {
                      type: 'boolean',
                      example: true
                    },
                    data: {
                      type: 'array',
                      items: {
                        $ref: '#/components/schemas/FileContent'
                      }
                    },
                    pagination: {
                      $ref: '#/components/schemas/Pagination'
                    }
                  }
                }
              }
            }
          },
          '400': {
            $ref: '#/components/responses/ValidationError'
          },
          '401': {
            $ref: '#/components/responses/UnauthorizedError'
          },
          '403': {
            $ref: '#/components/responses/ForbiddenError'
          },
          '404': {
            description: 'Directory not found',
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/Error'
                },
                example: {
                  success: false,
                  error: {
                    code: 'DIRECTORY_NOT_FOUND',
                    message: 'The specified directory does not exist'
                  }
                }
              }
            }
          }
        }
      },
      post: {
        tags: ['Files'],
        summary: 'Upload a file',
        security: [
          { bearerAuth: [] },
          { apiKeyAuth: [] }
        ],
        requestBody: {
          required: true,
          content: {
            'multipart/form-data': {
              schema: {
                type: 'object',
                required: ['file'],
                properties: {
                  file: {
                    type: 'string',
                    format: 'binary',
                    description: 'File to upload'
                  },
                  path: {
                    type: 'string',
                    description: 'Target directory path (relative to base directory)',
                    default: '/'
                  },
                  overwrite: {
                    type: 'boolean',
                    description: 'Overwrite if file exists',
                    default: false
                  }
                }
              }
            }
          }
        },
        responses: {
          '201': {
            description: 'File uploaded successfully',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    success: {
                      type: 'boolean',
                      example: true
                    },
                    data: {
                      $ref: '#/components/schemas/FileContent'
                    }
                  }
                }
              }
            }
          },
          '400': {
            $ref: '#/components/responses/ValidationError'
          },
          '401': {
            $ref: '#/components/responses/UnauthorizedError'
          },
          '403': {
            $ref: '#/components/responses/ForbiddenError'
          },
          '409': {
            description: 'File already exists',
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/Error'
                },
                example: {
                  success: false,
                  error: {
                    code: 'FILE_EXISTS',
                    message: 'A file with this name already exists',
                    details: {
                      path: '/uploads/example.txt',
                      overwrite: false
                    }
                  }
                }
              }
            }
          }
        }
      }
    },
    '/files/{path}': {
      parameters: [
        {
          name: 'path',
          in: 'path',
          description: 'File or directory path (relative to base directory)',
          required: true,
          schema: {
            type: 'string'
          }
        }
      ],
      get: {
        tags: ['Files'],
        summary: 'Get file content or directory listing',
        security: [
          { bearerAuth: [] },
          { apiKeyAuth: [] }
        ],
        responses: {
          '200': {
            description: 'File content or directory listing',
            content: {
              'application/json': {
                schema: {
                  oneOf: [
                    {
                      $ref: '#/components/schemas/FileContent'
                    },
                    {
                      type: 'object',
                      properties: {
                        success: {
                          type: 'boolean',
                          example: true
                        },
                        data: {
                          type: 'array',
                          items: {
                            $ref: '#/components/schemas/FileContent'
                          }
                        }
                      }
                    }
                  ]
                }
              },
              'application/octet-stream': {
                schema: {
                  type: 'string',
                  format: 'binary'
                }
              },
              'text/plain': {
                schema: {
                  type: 'string'
                }
              }
            }
          },
          '206': {
            description: 'Partial content (for range requests)',
            content: {
              'application/octet-stream': {
                schema: {
                  type: 'string',
                  format: 'binary'
                }
              }
            }
          },
          '400': {
            $ref: '#/components/responses/ValidationError'
          },
          '401': {
            $ref: '#/components/responses/UnauthorizedError'
          },
          '403': {
            $ref: '#/components/responses/ForbiddenError'
          },
          '404': {
            $ref: '#/components/responses/NotFoundError'
          }
        }
      },
      put: {
        tags: ['Files'],
        summary: 'Create or update a file',
        security: [
          { bearerAuth: [] },
          { apiKeyAuth: [] }
        ],
        requestBody: {
          required: true,
          content: {
            'text/plain': {
              schema: {
                type: 'string',
                example: 'File content here'
              }
            },
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  content: {
                    type: 'string',
                    description: 'File content',
                    example: 'File content here'
                  },
                  encoding: {
                    type: 'string',
                    enum: ['utf8', 'base64', 'hex'],
                    default: 'utf8',
                    description: 'Content encoding'
                  }
                },
                required: ['content']
              }
            }
          }
        },
        responses: {
          '200': {
            description: 'File created or updated successfully',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    success: {
                      type: 'boolean',
                      example: true
                    },
                    data: {
                      $ref: '#/components/schemas/FileContent'
                    }
                  }
                }
              }
            }
          },
          '400': {
            $ref: '#/components/responses/ValidationError'
          },
          '401': {
            $ref: '#/components/responses/UnauthorizedError'
          },
          '403': {
            $ref: '#/components/responses/ForbiddenError'
          },
          '409': {
            description: 'Directory already exists at the specified path',
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/Error'
                },
                example: {
                  success: false,
                  error: {
                    code: 'DIRECTORY_EXISTS',
                    message: 'A directory already exists at the specified path'
                  }
                }
              }
            }
          }
        }
      },
      delete: {
        tags: ['Files'],
        summary: 'Delete a file or directory',
        security: [
          { bearerAuth: [] },
          { apiKeyAuth: [] }
        ],
        parameters: [
          {
            name: 'recursive',
            in: 'query',
            description: 'Delete directory contents recursively',
            required: false,
            schema: {
              type: 'boolean',
              default: false
            }
          }
        ],
        responses: {
          '200': {
            description: 'File or directory deleted successfully',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    success: {
                      type: 'boolean',
                      example: true
                    },
                    data: {
                      type: 'object',
                      properties: {
                        deleted: {
                          type: 'boolean',
                          example: true
                        }
                      }
                    }
                  }
                }
              }
            }
          },
          '400': {
            description: 'Directory not empty',
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/Error'
                },
                example: {
                  success: false,
                  error: {
                    code: 'DIRECTORY_NOT_EMPTY',
                    message: 'Directory is not empty. Use recursive=true to delete non-empty directories'
                  }
                }
              }
            }
          },
          '401': {
            $ref: '#/components/responses/UnauthorizedError'
          },
          '403': {
            $ref: '#/components/responses/ForbiddenError'
          },
          '404': {
            $ref: '#/components/responses/NotFoundError'
          }
        }
      }
    },
    '/db/query': {
      post: {
        tags: ['Database'],
        summary: 'Execute a database query',
        security: [
          { bearerAuth: [] },
          { apiKeyAuth: [] }
        ],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['query'],
                properties: {
                  query: {
                    type: 'string',
                    description: 'SQL query to execute',
                    example: 'SELECT * FROM users WHERE id = ?'
                  },
                  params: {
                    type: 'array',
                    description: 'Query parameters',
                    items: {
                      anyOf: [
                        { type: 'string' },
                        { type: 'number' },
                        { type: 'boolean' },
                        { type: 'null' }
                      ]
                    },
                    example: [1]
                  } as OpenAPIV3.ArraySchemaObject,
                  readOnly: {
                    type: 'boolean',
                    description: 'Whether the query is read-only',
                    default: false
                  }
                }
              }
            }
          }
        },
        responses: {
          '200': {
            description: 'Query executed successfully',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    success: {
                      type: 'boolean',
                      example: true
                    },
                    data: {
                      $ref: '#/components/schemas/QueryResult'
                    }
                  }
                }
              }
            }
          },
          '400': {
            description: 'Invalid query',
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/Error'
                },
                example: {
                  success: false,
                  error: {
                    code: 'INVALID_QUERY',
                    message: 'SQL syntax error near...',
                    details: {
                      position: 10
                    }
                  }
                }
              }
            }
          },
          '401': {
            $ref: '#/components/responses/UnauthorizedError'
          },
          '403': {
            $ref: '#/components/responses/ForbiddenError'
          },
          '500': {
            description: 'Database error',
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/Error'
                },
                example: {
                  success: false,
                  error: {
                    code: 'DATABASE_ERROR',
                    message: 'A database error occurred',
                    details: {
                      code: 'SQLITE_ERROR',
                      message: 'no such table: non_existent_table'
                    }
                  }
                }
              }
            }
          }
        }
      }
    },
    '/db/tables': {
      get: {
        tags: ['Database'],
        summary: 'List all tables in the database',
        security: [
          { bearerAuth: [] },
          { apiKeyAuth: [] }
        ],
        responses: {
          '200': {
            description: 'List of tables',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    success: {
                      type: 'boolean',
                      example: true
                    },
                    data: {
                      type: 'array',
                      items: {
                        type: 'string',
                        example: 'users'
                      }
                    }
                  }
                }
              }
            }
          },
          '401': {
            $ref: '#/components/responses/UnauthorizedError'
          },
          '403': {
            $ref: '#/components/responses/ForbiddenError'
          }
        }
      }
    },
    '/db/tables/{table}': {
      parameters: [
        {
          name: 'table',
          in: 'path',
          description: 'Table name',
          required: true,
          schema: {
            type: 'string'
          }
        }
      ],
      get: {
        tags: ['Database'],
        summary: 'Get table schema',
        security: [
          { bearerAuth: [] },
          { apiKeyAuth: [] }
        ],
        responses: {
          '200': {
            description: 'Table schema',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    success: {
                      type: 'boolean',
                      example: true
                    },
                    data: {
                      type: 'object',
                      properties: {
                        name: {
                          type: 'string',
                          example: 'users'
                        },
                        columns: {
                          type: 'array',
                          items: {
                            type: 'object',
                            properties: {
                              name: {
                                type: 'string',
                                example: 'id'
                              },
                              type: {
                                type: 'string',
                                example: 'INTEGER'
                              },
                              notnull: {
                                type: 'boolean',
                                example: true
                              },
                              dflt_value: {
                                type: ['string', 'number', 'null'],
                                example: null
                              },
                              pk: {
                                type: 'integer',
                                example: 1
                              }
                            }
                          }
                        },
                        indexes: {
                          type: 'array',
                          items: {
                            type: 'object',
                            properties: {
                              name: {
                                type: 'string',
                                example: 'idx_users_email'
                              },
                              unique: {
                                type: 'boolean',
                                example: true
                              },
                              columns: {
                                type: 'array',
                                items: {
                                  type: 'string'
                                },
                                example: ['email']
                              }
                            }
                          }
                        },
                        foreignKeys: {
                          type: 'array',
                          items: {
                            type: 'object',
                            properties: {
                              id: {
                                type: 'integer',
                                example: 1
                              },
                              table: {
                                type: 'string',
                                example: 'posts'
                              },
                              from: {
                                type: 'string',
                                example: 'user_id'
                              },
                              to: {
                                type: 'string',
                                example: 'id'
                              },
                              onUpdate: {
                                type: 'string',
                                example: 'CASCADE'
                              },
                              onDelete: {
                                type: 'string',
                                example: 'SET NULL'
                              }
                            }
                          }
                        }
                      }
                    }
                  }
                }
              }
            }
          },
          '401': {
            $ref: '#/components/responses/UnauthorizedError'
          },
          '403': {
            $ref: '#/components/responses/ForbiddenError'
          },
          '404': {
            description: 'Table not found',
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/Error'
                },
                example: {
                  success: false,
                  error: {
                    code: 'TABLE_NOT_FOUND',
                    message: 'The specified table does not exist'
                  }
                }
              }
            }
          }
        }
      }
    }
  }
};

export default swaggerDefinition;
