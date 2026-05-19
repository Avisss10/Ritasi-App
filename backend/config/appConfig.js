import env from "./env.js";

const appConfig = {
  appName: "Ritasi App",
  mode: env.app.env,
  port: env.app.port,
  apiPrefix: "/api",
  logging: env.app.env === "development",

  database: {
    retry: 3,
    pooling: true,
  },
};

export default appConfig;
