import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

// Fix __dirname di ES Module
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load .env file
dotenv.config({ path: path.join(__dirname, "../.env") });

export default {
  db: {
    host: process.env.DB_HOST,
    port: process.env.DB_PORT || 4000,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD || "",
    database: process.env.DB_NAME,
    sslCert: process.env.DB_SSL_CERT || null,
  },
  app: {
    port: process.env.PORT || 5000,
    env: process.env.NODE_ENV || "development",
  },
};
