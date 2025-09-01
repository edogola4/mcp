/**
 * Represents an authenticated user in the system
 */
export interface AuthUser {
  id: string;
  email?: string;  // Made optional to be more flexible with different OAuth providers
  name?: string;   // Made optional to be more flexible with different OAuth providers
  roles?: string[]; // Made optional to be more flexible with different OAuth providers
  // Add any additional user properties here
  [key: string]: any; // Allow additional properties from the OAuth provider
}
