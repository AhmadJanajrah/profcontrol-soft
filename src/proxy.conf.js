const { env } = require('process');

const target = env.ASPNETCORE_HTTPS_PORT ? `https://localhost:${env.ASPNETCORE_HTTPS_PORT}` :
  env.ASPNETCORE_URLS ? env.ASPNETCORE_URLS.split(';')[0] : 'https://localhost:7056';

const PROXY_CONFIG = [
  {
    context: [
      "/api",
      "/hub/notificationhub",
    ],
    target,
    secure: false,
    ws: true,
    changeOrigin: true,
    headers: {
      Connection: 'Keep-Alive'
    }
  }
]

module.exports = PROXY_CONFIG;
