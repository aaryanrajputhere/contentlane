import dotenv from 'dotenv';

dotenv.config({
  path: ['.env', '.env.clerk'],
  override: false,
  quiet: true,
});
