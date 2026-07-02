import type { UserRole } from '@prisma/client';

declare global {
  namespace Express {
    interface Request {
      auth?: { userId: string; role: UserRole; email: string };
      requestId: string;
    }
  }
}

export {};
