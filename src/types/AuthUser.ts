/**
 * Represents an authenticated user in the system
 */
export interface AuthUser {
  id: string;
  email: string;
  roles: string[];
  // Add any additional user properties here
}
