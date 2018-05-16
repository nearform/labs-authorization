'use strict'

const _ = require('lodash')
const Joi = require('joi')
const headers = require('./../headers')
const swagger = require('@nearform/udaru-core/lib/ops/validation').swagger
const validation = require('@nearform/udaru-core/lib/ops/validation').authorize

exports.register = function (server, options, next) {
  const Action = server.udaruConfig.get('AuthConfig.Action')

  server.route({
    method: 'GET',
    path: '/authorization/access/{userId}/{action}/{resource*}',
    handler: function (request, reply) {
      const { organizationId } = request.udaru
      const { resource, action, userId } = request.params

      const params = {
        userId,
        action,
        resource,
        organizationId,
        sourceIpAddress: request.info.remoteAddress,
        sourcePort: request.info.remotePort
      }

      request.udaruCore.authorize.isUserAuthorized(params, reply)
    },
    config: {
      plugins: {
        auth: {
          action: Action.CheckAccess,
          resource: 'authorization/access'
        }
      },
      validate: {
        params: _.pick(validation.isUserAuthorized, ['userId', 'action', 'resource']),
        headers
      },
      description: 'Authorize user action against a resource',
      notes: 'The GET /authorization/access/{userId}/{action}/{resource} endpoint answers if a user can perform an action\non a resource.\n',
      tags: ['api', 'authorization'],
      response: { schema: swagger.Access }
    }
  })

  server.route({
    method: 'POST',
    path: '/authorization/access/{userId}',
    handler: function (request, reply) {
      const { organizationId } = request.udaru
      const { resourceBatch } = request.payload
      const { userId } = request.params

      const params = {
        userId,
        resourceBatch,
        organizationId,
        sourceIpAddress: request.info.remoteAddress,
        sourcePort: request.info.remotePort
      }

      request.udaruCore.authorize.batchAuthorization(params, reply)
    },
    config: {
      plugins: {
        auth: {
          action: Action.BatchAccess,
          resource: 'authorization/batchaccess'
        }
      },
      validate: {
        params: _.pick(validation.batchAuthorization, ['userId']),
        payload: Joi.object(_.pick(validation.batchAuthorization, ['resourceBatch'])).label('ResourceBatchPayload'),
        headers
      },
      description: 'Authorize a batch of action/resource pairss',
      notes: 'The POST /authorization/access/{userId} endpoint determines if a user has authorization on a batch of action/resource pairs\n',
      tags: ['api', 'authorization'],
      response: { schema: swagger.BatchAccess }
    }
  })

  server.route({
    method: 'GET',
    path: '/authorization/list/{userId}/{resource*}',
    handler: function (request, reply) {
      const { organizationId } = request.udaru
      const { resource, userId } = request.params
      const params = {
        userId,
        resource,
        organizationId,
        sourceIpAddress: request.info.remoteAddress,
        sourcePort: request.info.remotePort
      }

      request.udaruCore.authorize.listActions(params, reply)
    },
    config: {
      plugins: {
        auth: {
          action: Action.ListActions,
          resource: 'authorization/actions'
        }
      },
      validate: {
        params: _.pick(validation.listAuthorizations, ['userId', 'resource']),
        headers
      },
      description: 'List all the actions a user can perform on a resource',
      notes: 'The GET /authorization/list/{userId}/{resource} endpoint returns a list of all the actions a user\ncan perform on a given resource.\n',
      tags: ['api', 'authorization'],
      response: { schema: swagger.UserActions }
    }
  })

  server.route({
    method: 'GET',
    path: '/authorization/list/{userId}',
    handler: function (request, reply) {
      const { organizationId } = request.udaru
      const { userId } = request.params
      const { resources } = request.query
      const params = {
        userId,
        resources,
        organizationId,
        sourceIpAddress: request.info.remoteAddress,
        sourcePort: request.info.remotePort
      }

      request.udaruCore.authorize.listAuthorizationsOnResources(params, reply)
    },
    config: {
      plugins: {
        auth: {
          action: Action.ListActionsOnResources,
          resource: 'authorization/actions/resources'
        }
      },
      validate: {
        params: _.pick(validation.listAuthorizationsOnResources, ['userId']),
        query: _.pick(validation.listAuthorizationsOnResources, ['resources']),
        headers
      },
      description: 'List all the actions a user can perform on a list of resources',
      notes: 'The GET /authorization/list/{userId} endpoint returns a list of all the actions a user\ncan perform on a given list of resources.\n',
      tags: ['api', 'authorization'],
      response: { schema: swagger.UserActionsOnResources }
    }
  })

  next()
}

exports.register.attributes = {
  name: 'authorization',
  version: '0.0.1'
}
