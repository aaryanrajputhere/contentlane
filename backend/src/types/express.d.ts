declare global {
  namespace Express {
    interface Request {
      requestId: string;
      user?: {
        id: string;
        email: string;
        name: string | null;
        role: 'USER' | 'ADMIN';
      };
    }
  }
}

export {};
