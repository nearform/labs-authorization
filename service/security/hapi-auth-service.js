'use strict'

const Boom = require('boom')
const Hoek = require('hoek')

const internals = {}


exports.register = function (server, options, next) {
  server.auth.scheme('service', internals.implementation)

  next()
}

exports.register.attributes = {
  name: 'Service',
  version: '0.0.1'
}


internals.implementation = function (server, options) {

  Hoek.assert(options, 'Missing service auth strategy options')
  Hoek.assert(typeof options.validateFunc === 'function', 'options.validateFunc must be a valid function in service scheme')

  const settings = Hoek.clone(options)

  const scheme = {
    authenticate: function (request, reply) {
      const req = request.raw.req

      const authorization = req.headers.authorization
      if (!authorization) {
        return reply(Boom.unauthorized('Missing authorization', 'udaru'))
      }

      const token = String(authorization)

      settings.validateFunc(server, request, token, (error, isValid, user) => {
        if (error) {
          return reply(Boom.unauthorized(error.message))
        }

        if (!isValid) {
          return reply(Boom.forbidden('Invalid credentials', 'udaru'))
        }

        if (!user || typeof user !== 'object') {
          return reply(Boom.badImplementation('Bad credentials object received'))
        }

        // only allow the SuperAdmin to impersonate an org
        let organizationId = user.organizationId
        if (organizationId === 'ROOT' && request.headers.org) {
          organizationId = request.headers.org
        }

        request.udaru = {
          user,
          organizationId
        }

        return reply.continue({ credentials: { scope: 'udaru' } })
      })
    }
  }

  return scheme
}
