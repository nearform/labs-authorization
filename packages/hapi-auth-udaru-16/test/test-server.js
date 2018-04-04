const config = require('../config')()
const Action = config.get('AuthConfig.Action')
const Hapi = require('hapi')
const UdaruPlugin = require('..')

module.exports = function buildServer (additionalConfig, done) {
  const server = new Hapi.Server({debug: false})

  server.connection({
    port: Number(config.get('hapi.port')),
    host: config.get('hapi.host'),
    routes: {
      cors: {
        additionalHeaders: ['org']
      }
    }
  })

  server.register({
    register: UdaruPlugin,
    options: {config, ...additionalConfig}
  }, function (err) {
    if (err) {
      if (typeof done === 'function') return done(err, server)
      throw err
    }

    if (typeof done === 'function') done(null, server)
  })

  server.route({
    method: 'GET',
    path: '/no/plugins',
    async handler (request) {
      return true
    },
    config: {
      plugins: {}
    }
  })

  server.route({
    method: 'GET',
    path: '/no/resource',
    async handler (request) {
      return true
    },
    config: {
      plugins: {
        auth: {
          action: Action.CheckAccess
        }
      }
    }
  })

  server.route({
    method: 'POST',
    path: '/no/team-resource/{id}',
    async handler (request) {
      return true
    },
    config: {
      plugins: {
        auth: {
          action: Action.DeleteUserTeams,
          getParams: (request) => ({ userId: request.params.id })
        }
      }
    }
  })

  return server
}
