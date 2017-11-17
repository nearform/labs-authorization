const config = require('udaru-hapi-plugin/config')

module.exports = (...amendments) => config({
  hapi: {
    port: 8080,
    host: 'localhost'
  },
  logger: {
    pino: {
      level: 'warn'
    }
  }
}, ...amendments)
