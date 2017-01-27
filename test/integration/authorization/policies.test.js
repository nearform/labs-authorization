const Lab = require('lab')
const lab = exports.lab = Lab.script()
const server = require('../../../lib/server')
const config = require('../../../lib/server/lib/config')


const Factory = require('../../factory')
const BuildFor = require('./test-builder')

const utils = require('../../utils')
const { udaru } = utils

const organizationId = 'WONKA'
function Policy (Statement) {
  return {
    version: '2016-07-01',
    name: 'Test Policy',
    statements: JSON.stringify({
      Statement: Statement || [{
        Effect: 'Allow',
        Action: ['dummy'],
        Resource: ['dummy']
      }]
    }),
    organizationId
  }
}

lab.experiment('Routes Authorizations', () => {
  lab.experiment('policies', () => {
    lab.experiment('GET /authorization/policies', () => {
      const records = Factory(lab, {
        users: {
          caller: { name: 'caller', organizationId, policies: ['testedPolicy'] }
        },
        policies: {
          testedPolicy: Policy()
        }
      })

      const endpoint = BuildFor(lab, records)
        .server(server)
        .endpoint({
          method: 'GET',
          url: '/authorization/policies',
          headers: { authorization: '{{caller.id}}' }
        })

      endpoint.test('should authorize user with correct policy')
        .withPolicy([{
          Effect: 'Allow',
          Action: ['authorization:policies:list'],
          Resource: ['/authorization/policy/WONKA/*']
        }])
        .shouldRespond(200)

      endpoint.test('should not authorize user with incorrect policy (action)')
        .withPolicy([{
          Effect: 'Allow',
          Action: ['authorization:policies:dummy'],
          Resource: ['/authorization/policy/WONKA']
        }])
        .shouldRespond(403)

      endpoint.test('should not authorize user with incorrect policy (resource)')
        .withPolicy([{
          Effect: 'Allow',
          Action: ['authorization:policies:list'],
          Resource: ['/authorization/policy/dummy']
        }])
        .shouldRespond(403)
    })

    lab.experiment('GET /authorization/policies/{id}', () => {
      const records = Factory(lab, {
        users: {
          caller: { name: 'caller', organizationId, policies: ['testedPolicy'] }
        },
        policies: {
          testedPolicy: Policy(),
          calledPolicy: Policy()
        }
      })

      const endpoint = BuildFor(lab, records)
        .server(server)
        .endpoint({
          method: 'GET',
          url: '/authorization/policies/{{calledPolicy.id}}',
          headers: { authorization: '{{caller.id}}' }
        })

      endpoint.test('should authorize user with policy for all policies')
        .withPolicy([{
          Effect: 'Allow',
          Action: ['authorization:policies:read'],
          Resource: ['/authorization/policy/WONKA/*']
        }])
        .shouldRespond(200)

      endpoint.test('should authorize user with policy for specific policy')
        .withPolicy([{
          Effect: 'Allow',
          Action: ['authorization:policies:read'],
          Resource: ['/authorization/policy/WONKA/{{calledPolicy.id}}']
        }])
        .shouldRespond(200)

      endpoint.test('should not authorize user with incorrect policy (action)')
        .withPolicy([{
          Effect: 'Allow',
          Action: ['authorization:policies:dummy'],
          Resource: ['/authorization/policy/WONKA/{{calledPolicy.id}}']
        }])
        .shouldRespond(403)

      endpoint.test('should not authorize user with incorrect policy (resource)')
        .withPolicy([{
          Effect: 'Allow',
          Action: ['authorization:policies:read'],
          Resource: ['/authorization/policy/WONKA/dummy']
        }])
        .shouldRespond(403)
    })

    lab.experiment('POST /authorization/policies', () => {
      const records = Factory(lab, {
        users: {
          caller: { name: 'caller', organizationId, policies: ['testedPolicy'] }
        },
        policies: {
          testedPolicy: Policy()
        }
      })

      const endpoint = BuildFor(lab, records)
        .server(server)
        .endpoint({
          method: 'POST',
          url: `/authorization/policies?sig=${config.get('security.api.servicekeys.private')}`,
          payload: {
            id: 'added-policy',
            version: 'anything',
            name: 'Added Policy',
            statements: { Statement: [{
              Effect: 'Allow',
              Action: ['dummy'],
              Resource: ['dummy']
            }] }
          },
          headers: { authorization: '{{caller.id}}' }
        })

      lab.afterEach((done) => {
        udaru.policies.delete({ id: 'added-policy', organizationId: 'WONKA' }, () => {
          // ignore error
          done()
        })
      })

      endpoint.test('should authorize user with correct policy')
        .withPolicy([{
          Effect: 'Allow',
          Action: ['authorization:policies:create'],
          Resource: ['/authorization/policy/WONKA/*']
        }])
        .shouldRespond(201)

      endpoint.test('should not authorize user with incorrect policy (action)')
        .withPolicy([{
          Effect: 'Allow',
          Action: ['authorization:policies:dummy'],
          Resource: ['/authorization/policy/WONKA/*']
        }])
        .shouldRespond(403)

      endpoint.test('should not authorize user with incorrect policy (resource)')
        .withPolicy([{
          Effect: 'Allow',
          Action: ['authorization:policies:create'],
          Resource: ['/authorization/policy/WONKA/dummy']
        }])
        .shouldRespond(403)
    })

    lab.experiment('PUT /authorization/policies/{{id}}', () => {
      const records = Factory(lab, {
        users: {
          caller: { name: 'caller', organizationId, policies: ['testedPolicy'] }
        },
        policies: {
          testedPolicy: Policy(),
          calledPolicy: Policy()
        }
      })

      const endpoint = BuildFor(lab, records)
        .server(server)
        .endpoint({
          method: 'PUT',
          url: `/authorization/policies/{{calledPolicy.id}}?sig=${config.get('security.api.servicekeys.private')}`,
          payload: {
            version: 'anything',
            name: 'Updated Policy',
            statements: { Statement: [{
              Effect: 'Allow',
              Action: ['dummy'],
              Resource: ['dummy']
            }] }
          },
          headers: { authorization: '{{caller.id}}' }
        })

      endpoint.test('should authorize user with policy for all policies')
        .withPolicy([{
          Effect: 'Allow',
          Action: ['authorization:policies:update'],
          Resource: ['/authorization/policy/WONKA/*']
        }])
        .shouldRespond(200)

      endpoint.test('should authorize user with policy for a specific policy')
        .withPolicy([{
          Effect: 'Allow',
          Action: ['authorization:policies:update'],
          Resource: ['/authorization/policy/WONKA/{{calledPolicy.id}}']
        }])
        .shouldRespond(200)

      endpoint.test('should not authorize user with incorrect policy (action)')
        .withPolicy([{
          Effect: 'Allow',
          Action: ['authorization:policies:dummy'],
          Resource: ['/authorization/policy/WONKA/{{calledPolicy.id}}']
        }])
        .shouldRespond(403)

      endpoint.test('should not authorize user with incorrect policy (resource)')
        .withPolicy([{
          Effect: 'Allow',
          Action: ['authorization:policies:update'],
          Resource: ['/authorization/policy/WONKA/dummy']
        }])
        .shouldRespond(403)
    })

    lab.experiment('DELETE /authorization/policies/{{id}}', () => {
      const records = Factory(lab, {
        users: {
          caller: { name: 'caller', organizationId, policies: ['testedPolicy'] }
        },
        policies: {
          testedPolicy: Policy(),
          calledPolicy: Policy()
        }
      })

      const endpoint = BuildFor(lab, records)
        .server(server)
        .endpoint({
          method: 'DELETE',
          url: `/authorization/policies/{{calledPolicy.id}}?sig=${config.get('security.api.servicekeys.private')}`,
          headers: { authorization: '{{caller.id}}' }
        })

      endpoint.test('should authorize user with policy for all policies')
        .withPolicy([{
          Effect: 'Allow',
          Action: ['authorization:policies:delete'],
          Resource: ['/authorization/policy/WONKA/*']
        }])
        .shouldRespond(204)

      endpoint.test('should authorize user with policy for a specific policy')
        .withPolicy([{
          Effect: 'Allow',
          Action: ['authorization:policies:delete'],
          Resource: ['/authorization/policy/WONKA/{{calledPolicy.id}}']
        }])
        .shouldRespond(204)

      endpoint.test('should not authorize user with incorrect policy (action)')
        .withPolicy([{
          Effect: 'Allow',
          Action: ['authorization:policies:dummy'],
          Resource: ['/authorization/policy/WONKA/{{calledPolicy.id}}']
        }])
        .shouldRespond(403)

      endpoint.test('should not authorize user with incorrect policy (resource)')
        .withPolicy([{
          Effect: 'Allow',
          Action: ['authorization:policies:delete'],
          Resource: ['/authorization/policy/WONKA/dummy']
        }])
        .shouldRespond(403)
    })
  })
})
