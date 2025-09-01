import { Session, SessionData } from 'express-session';
import { TokenSet } from 'openid-client';
import { AuthUser } from './AuthUser';

declare module 'express-session' {
  interface SessionData {
    state?: string;
    nonce?: string;
    user?: AuthUser;
    tokenSet?: TokenSet;
    returnTo?: string;
  }
}

declare global {
  namespace Express {
    interface Request {
      session: Session & {
        user?: AuthUser;
        tokenSet?: TokenSet;
      };
    }
  }
}
