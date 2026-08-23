const PROXY_CONFIG = [
  {
    context: [
      "/api",
      "/hub/notificationhub",
    ],
    target: 'https://prof-api.profcontrol-soft.com',
    secure: true,
    ws: true,
    changeOrigin: true,
    headers: {
      Connection: 'Keep-Alive'
    }
  }
]

module.exports = PROXY_CONFIG;
