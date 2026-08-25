process.env.NODE_ENV ??= 'test';
process.env.DATABASE_URL ??= 'postgresql://ContentLane:ContentLane@localhost:5432/ContentLane?schema=public';
process.env.FRONTEND_URL ??= 'http://localhost:5173';
process.env.LOG_LEVEL ??= 'error';
process.env.JWT_SECRET ??= 'test-secret-at-least-32-characters-long';
process.env.DODO_STARTER_PRODUCT_ID ??= 'pdt_test_starter';
process.env.DODO_PRO_PRODUCT_ID ??= 'pdt_test_pro';
process.env.DODO_PAYMENTS_PRODUCT_ID ??= 'pdt_test_legacy_pro';
