const PROXY_CONFIG = [
  {
    context: [
      "/api",
      "/hub/notificationhub",
    ],
    target: 'http://prof-api.profcontrol-soft.com',
    secure: false,
    ws: true,
    changeOrigin: true,
    headers: {
      Connection: 'Keep-Alive'
    }
  }
]

module.exports = PROXY_CONFIG;
