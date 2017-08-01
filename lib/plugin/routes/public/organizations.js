'use strict'

const _ = require('lodash')
const swagger = require('./../../swagger')
const headers = require('./../headers')
const config = require('../../config')

exports.register = function (server, options, next) {
  const udaru = server.app.udaru
  const Action = config.get('AuthConfig.Action')

  server.route({
    method: 'GET',
    path: '/authorization/organizations',
    handler: function (request, reply) {
      const limit = request.query.limit || config.get('authorization.defaultPageSize')
      const page = request.query.page || 1
      udaru.organizations.list({
        limit: limit,
        page: page
      }, (err, data, total) => {
        reply(
          err,
          err ? null : {
            page: page,
            limit: limit,
            total: total,
            data: data
          }
        )
      })
    },
    config: {
      description: 'List all the organizations',
      notes: 'The GET /authorization/organizations endpoint returns a list of all organizations.\n\nThe results are paginated. Page numbering and page limit start from 1.\n',
      tags: ['api', 'organizations'],
      plugins: {
        auth: {
          action: Action.ListOrganizations
        }
      },
      validate: {
        headers,
        query: udaru.organizations.list.validate
      },
      response: {schema: swagger.List(swagger.Organization).label('PagedOrganizations')}
    }
  })

  server.route({
    method: 'GET',
    path: '/authorization/organizations/{id}',
    handler: function (request, reply) {
      udaru.organizations.read(request.params.id, reply)
    },
    config: {
      description: 'Get organization',
      notes: 'The GET /authorization/organizations/{id} endpoint returns a single organization data.\n',
      tags: ['api', 'organizations'],
      plugins: {
        auth: {
          action: Action.ReadOrganization,
          getParams: (request) => ({ organizationId: request.params.id })
        }
      },
      validate: {
        params: {
          id: udaru.organizations.read.validate
        },
        headers
      },
      response: {schema: swagger.Organization}
    }
  })

  server.route({
    method: 'POST',
    path: '/authorization/organizations',
    handler: function (request, reply) {
      const params = {
        id: request.payload.id,
        name: request.payload.name,
        description: request.payload.description,
        user: request.payload.user
      }

      udaru.organizations.create(params, function (err, res) {
        if (err) {
          return reply(err)
        }

        return reply(res).code(201)
      })
    },
    config: {
      validate: {
        payload: udaru.organizations.create.validate,
        headers
      },
      description: 'Create an organization',
      notes: 'The POST /authorization/organizations endpoint creates a new organization, the default organization admin policy and (if provided) its admin.',
      tags: ['api', 'organizations'],
      plugins: {
        auth: {
          action: Action.CreateOrganization
        }
      },
      response: {schema: swagger.OrganizationAndUser}
    }
  })

  server.route({
    method: 'DELETE',
    path: '/authorization/organizations/{id}',
    handler: function (request, reply) {
      udaru.organizations.delete(request.params.id, function (err, res) {
        if (err) {
          return reply(err)
        }

        return reply().code(204)
      })
    },
    config: {
      description: 'DELETE an organization',
      notes: 'The DELETE /authorization/organizations/{id} endpoint will delete an organization.',
      tags: ['api', 'organizations'],
      plugins: {
        auth: {
          action: Action.DeleteOrganization,
          getParams: (request) => ({ organizationId: request.params.id })
        }
      },
      validate: {
        params: {
          id: udaru.organizations.delete.validate
        },
        headers
      }
    }
  })

  server.route({
    method: 'PUT',
    path: '/authorization/organizations/{id}',
    handler: function (request, reply) {
      const { id } = request.params
      const { name, description } = request.payload

      udaru.organizations.update({id, name, description}, reply)
    },
    config: {
      validate: {
        params: _.pick(udaru.organizations.update.validate, ['id']),
        payload: _.pick(udaru.organizations.update.validate, ['name', 'description']),
        headers
      },
      description: 'Update an organization',
      notes: 'The PUT /authorization/organizations/{id} endpoint will update an organization name and description',
      tags: ['api', 'organizations'],
      plugins: {
        auth: {
          action: Action.UpdateOrganization,
          getParams: (request) => ({ organizationId: request.params.id })
        }
      },
      response: {schema: swagger.Organization}
    }
  })

  server.route({
    method: 'PUT',
    path: '/authorization/organizations/{id}/policies',
    handler: function (request, reply) {
      const { id } = request.params
      const { policies } = request.payload

      udaru.organizations.addPolicies({id, policies}, reply)
    },
    config: {
      validate: {
        params: _.pick(udaru.organizations.addPolicies.validate, ['id']),
        payload: _.pick(udaru.organizations.addPolicies.validate, ['policies']),
        headers
      },
      description: 'Add one or more policies to an organization',
      notes: 'The PUT /authorization/organizations/{id}/policies endpoint adds one or more policies to an organization.',
      tags: ['api', 'organizations'],
      plugins: {
        auth: {
          action: Action.AddOrganizationPolicy,
          getParams: (request) => ({ organizationId: request.params.id })
        }
      },
      response: {schema: swagger.Organization}
    }
  })

  server.route({
    method: 'POST',
    path: '/authorization/organizations/{id}/policies',
    handler: function (request, reply) {
      const { id } = request.params
      const { policies } = request.payload

      udaru.organizations.replacePolicies({id, policies}, reply)
    },
    config: {
      validate: {
        params: _.pick(udaru.organizations.replacePolicies.validate, ['id']),
        payload: _.pick(udaru.organizations.replacePolicies.validate, ['policies']),
        headers
      },
      description: 'Clear and replace the policies of an organization',
      notes: 'The POST /authorization/organizations/{id}/policies endpoint replaces all the organization policies. The existing organization policies are removed.',
      tags: ['api', 'organizations'],
      plugins: {
        auth: {
          action: Action.ReplaceOrganizationPolicy,
          getParams: (request) => ({ organizationId: request.params.id })
        }
      },
      response: {schema: swagger.Organization}
    }
  })

  server.route({
    method: 'DELETE',
    path: '/authorization/organizations/{id}/policies',
    handler: function (request, reply) {
      const { id } = request.params

      udaru.organizations.deletePolicies({ id }, function (err, res) {
        if (err) {
          return reply(err)
        }

        return reply().code(204)
      })
    },
    config: {
      validate: {
        params: _.pick(udaru.organizations.deletePolicies.validate, ['id']),
        headers
      },
      description: 'Clear all policies of the organization',
      notes: 'The DELETE /authorization/organizations/{id}/policies endpoint removes all the organization policies.\n',
      tags: ['api', 'organizations'],
      plugins: {
        auth: {
          action: Action.RemoveOrganizationPolicy,
          getParams: (request) => ({ organizationId: request.params.id })
        }
      }
    }
  })

  server.route({
    method: 'DELETE',
    path: '/authorization/organizations/{id}/policies/{policyId}',
    handler: function (request, reply) {
      const { id, policyId } = request.params

      udaru.organizations.deletePolicy({ id, policyId }, function (err, res) {
        if (err) {
          return reply(err)
        }

        return reply().code(204)
      })
    },
    config: {
      validate: {
        params: _.pick(udaru.organizations.deletePolicy.validate, ['id', 'policyId']),
        headers
      },
      description: 'Remove a policy from one organization',
      notes: 'The DELETE /authorization/organizations/{id}/policies/{policyId} endpoint removes a specific policy from the organization.\n',
      tags: ['api', 'organizations'],
      plugins: {
        auth: {
          action: Action.RemoveOrganizationPolicy,
          getParams: (request) => ({
            organizationId: request.params.id,
            policyId: request.params.policyId
          })
        }
      }
    }
  })
  next()
}

exports.register.attributes = {
  name: 'organizations',
  version: '0.0.1'
}
