import "dotenv/config";

export default {
  databaseUrl: process.env.DATABASE_URL,
  port: process.env.PORT || 5050,
  jwtSecret: process.env.JWT_SECRET || "default_secret",
};
