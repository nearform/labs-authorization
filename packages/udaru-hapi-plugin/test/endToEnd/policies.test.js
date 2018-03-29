'use strict'

const _ = require('lodash')
const expect = require('code').expect
const Lab = require('lab')
const lab = exports.lab = Lab.script()
const utils = require('@nearform/udaru-test/utils')
const serverFactory = require('../test-server')
const udaru = require('@nearform/udaru-core')()

const statements = { Statement: [{ Effect: 'Allow', Action: ['documents:Read'], Resource: ['wonka:documents:/public/*'] }] }
const policyCreateData = {
  version: '2016-07-01',
  name: 'Documents Admin',
  statements,
  organizationId: 'WONKA'
}

lab.experiment('Policies - get/list', () => {
  let server = null

  lab.before(async () => {
    server = await serverFactory()
  })

  lab.test('get policy list has default pagination params', async () => {
    const options = utils.requestOptions({
      method: 'GET',
      url: '/authorization/policies'
    })

    const response = await server.inject(options)
    expect(response.statusCode).to.equal(200)
    expect(response.result.page).to.equal(1)
    expect(response.result.limit).greaterThan(1)
  })

  lab.test('get policy list: limit', async () => {
    const options = utils.requestOptions({
      method: 'GET',
      url: '/authorization/policies?limit=4&page=1'
    })

    const response = await server.inject(options)
    const result = response.result

    expect(response.statusCode).to.equal(200)
    expect(result.total).greaterThan(4)
    expect(result.page).to.equal(1)
    expect(result.limit).to.equal(4)
    expect(result.data.length).to.equal(4)
  })

  lab.test('get policy list', async () => {
    const options = utils.requestOptions({
      method: 'GET',
      url: '/authorization/policies?limit=500&page=1'
    })

    const response = await server.inject(options)
    const result = response.result

    expect(response.statusCode).to.equal(200)
    expect(result.total).lessThan(result.limit) // Will fail if we need to increase limit
    let accountantPolicy = _.find(result.data, {id: 'policyId2'})
    expect(accountantPolicy).to.equal({
      id: 'policyId2',
      version: '0.1',
      name: 'Accountant',
      statements: {
        Statement: [
          {
            Effect: 'Allow',
            Action: ['finance:ReadBalanceSheet'],
            Resource: ['database:pg01:balancesheet']
          },
          {
            Effect: 'Deny',
            Action: ['finance:ImportBalanceSheet'],
            Resource: ['database:pg01:balancesheet']
          },
          {
            Effect: 'Deny',
            Action: ['finance:ReadCompanies'],
            Resource: ['database:pg01:companies']
          },
          {
            Effect: 'Deny',
            Action: ['finance:UpdateCompanies'],
            Resource: ['database:pg01:companies']
          },
          {
            Effect: 'Deny',
            Action: ['finance:DeleteCompanies'],
            Resource: ['database:pg01:companies']
          }
        ]
      }
    })
  })

  lab.test('get single policy', async () => {
    const p = await udaru.policies.create(policyCreateData)

    const options = utils.requestOptions({
      method: 'GET',
      url: `/authorization/policies/${p.id}`
    })

    const response = await server.inject(options)
    const result = response.result

    expect(response.statusCode).to.equal(200)
    expect(result).to.equal(p)

    await udaru.policies.delete({id: p.id, organizationId: 'WONKA'})
  })
})

lab.experiment('Policies - create/update/delete (need service key)', () => {
  let server = null

  lab.before(async () => {
    server = await serverFactory()
  })

  lab.test('create new policy without a service key should return 403 Forbidden', async () => {
    const options = utils.requestOptions({
      method: 'POST',
      url: '/authorization/policies?sig=1234',
      payload: {
        version: '2016-07-01',
        name: 'Documents Admin',
        statements
      }
    })

    const response = await server.inject(options)
    expect(response.statusCode).to.equal(403)
  })

  lab.test('create new policy without valid data should return 400 Bad Request', async () => {
    const options = utils.requestOptions({
      method: 'POST',
      url: '/authorization/policies?sig=123456789',
      payload: {
        version: '2016-07-01',
        name: 'Documents Admin'
      }
    })

    const response = await server.inject(options)
    expect(response.statusCode).to.equal(400)
  })

  lab.test('create new policy with already present id should return 400 Bad Request', async () => {
    const options = utils.requestOptions({
      method: 'POST',
      url: '/authorization/policies?sig=123456789',
      payload: {
        id: 'policyId1',
        version: '2016-07-01',
        name: 'Documents Admin',
        statements
      }
    })

    const response = await server.inject(options)
    expect(response.statusCode).to.equal(409)
    expect(response.result.message).to.equal('policy already exists')
  })

  lab.test('create new policy should return 201 and the created policy data', async () => {
    const options = utils.requestOptions({
      method: 'POST',
      url: '/authorization/policies?sig=123456789',
      payload: {
        version: '2016-07-01',
        name: 'Documents Admin',
        statements
      }
    })

    const response = await server.inject(options)
    const result = response.result

    expect(response.statusCode).to.equal(201)
    expect(result.name).to.equal('Documents Admin')
    expect(result.statements).to.equal(statements)

    await udaru.policies.delete({id: result.id, organizationId: 'WONKA'})
  })

  lab.test('create new policy with invalid effect data - should return a 400', async () => {
    const badStatement = { Statement: [{ Effect: 'Groot', Action: ['documents:Read'], Resource: ['wonka:documents:/public/*'] }] }
    const options = utils.requestOptions({
      method: 'POST',
      url: '/authorization/policies?sig=123456789',
      payload: {
        id: 'badPolicy',
        version: '2016-07-01',
        name: 'Documents Admin',
        badStatement
      }
    })

    const response = await server.inject(options)
    expect(response.statusCode).to.equal(400)
  })

  lab.test('create new policy should allow empty string as id', async () => {
    const options = utils.requestOptions({
      method: 'POST',
      url: '/authorization/policies?sig=123456789',
      payload: {
        id: '',
        version: '2016-07-01',
        name: 'Documents Admin',
        statements
      }
    })

    const response = await server.inject(options)
    const result = response.result

    expect(response.statusCode).to.equal(201)
    expect(result.id).to.not.equal('')
    expect(result.name).to.equal('Documents Admin')

    await udaru.policies.delete({id: result.id, organizationId: 'WONKA'})
  })

  lab.test('create new policy specifying an id should return 201 and the created policy data', async () => {
    const options = utils.requestOptions({
      method: 'POST',
      url: '/authorization/policies?sig=123456789',
      payload: {
        id: 'mySpecialPolicyId',
        version: '2016-07-01',
        name: 'Documents Admin',
        statements
      }
    })

    const response = await server.inject(options)
    const result = response.result

    expect(response.statusCode).to.equal(201)
    expect(result.id).to.equal('mySpecialPolicyId')
    expect(result.name).to.equal('Documents Admin')

    await udaru.policies.delete({id: result.id, organizationId: 'WONKA'})
  })

  lab.test('update new policy without a service key should return 403 Forbidden', async () => {
    const options = utils.requestOptions({
      method: 'PUT',
      url: '/authorization/policies/whatever?sig=123',
      payload: {
        version: '2016-07-01',
        name: 'Documents Admin',
        statements
      }
    })

    const response = await server.inject(options)
    expect(response.statusCode).to.equal(403)
  })

  lab.test('update policy without valid data should return 400 Bad Request', async () => {
    const options = utils.requestOptions({
      method: 'PUT',
      url: '/authorization/policies/whatever?sig=123456789',
      payload: {
        version: '2016-07-01',
        name: 'Documents Admin'
      }
    })

    const response = await server.inject(options)
    expect(response.statusCode).to.equal(400)
  })

  lab.test('update new policy should return the updated policy data', async () => {
    const p = await udaru.policies.create(policyCreateData)

    const options = utils.requestOptions({
      method: 'PUT',
      url: `/authorization/policies/${p.id}?sig=123456789`,
      payload: {
        version: '1234',
        name: 'new policy name',
        statements: {
          Statement: [
            {
              Effect: 'Deny',
              Action: ['documents:Read'],
              Resource: ['wonka:documents:/public/*']
            }
          ]
        }
      }
    })

    const response = await server.inject(options)
    const result = response.result

    expect(response.statusCode).to.equal(200)
    expect(result.name).to.equal('new policy name')
    expect(result.version).to.equal('1234')
    expect(result.statements).to.equal({ Statement: [{ Action: ['documents:Read'], Effect: 'Deny', Resource: ['wonka:documents:/public/*'] }] })

    await udaru.policies.delete({ id: p.id, organizationId: 'WONKA' })
  })

  lab.test('delete policy without a service key should return 403 Forbidden', async () => {
    const options = utils.requestOptions({
      method: 'DELETE',
      url: '/authorization/policies/policyId1?sig=1234'
    })

    const response = await server.inject(options)
    expect(response.statusCode).to.equal(403)
  })

  lab.test('delete policy should return 204', async () => {
    const p = await udaru.policies.create(policyCreateData)

    const options = utils.requestOptions({
      method: 'DELETE',
      url: `/authorization/policies/${p.id}?sig=123456789`
    })

    const response = await server.inject(options)
    expect(response.statusCode).to.equal(204)
  })
})

lab.experiment('Shared Policies - create/update/delete (need service key)', () => {
  let server = null

  lab.before(async () => {
    server = await serverFactory()
  })

  const sharedPolicyCreateData = {
    version: '2016-07-01',
    name: 'Documents Admin',
    statements
  }

  lab.test('create new shared policy without a service key should return 403 Forbidden', async () => {
    const options = utils.requestOptions({
      method: 'POST',
      url: '/authorization/shared-policies?sig=1234',
      payload: {
        version: '2016-07-01',
        name: 'Documents Admin',
        statements
      }
    })

    const response = await server.inject(options)
    expect(response.statusCode).to.equal(403)
  })

  lab.test('create new shared policy without valid data should return 400 Bad Request', async () => {
    const options = utils.requestOptions({
      method: 'POST',
      url: '/authorization/shared-policies?sig=123456789',
      payload: {
        version: '2016-07-01',
        name: 'Documents Admin'
      }
    })

    const response = await server.inject(options)
    expect(response.statusCode).to.equal(400)
  })

  lab.test('create new shared policy with already present id should return 409 conflict', async () => {
    const options = utils.requestOptions({
      method: 'POST',
      url: '/authorization/shared-policies?sig=123456789',
      payload: {
        id: 'policyId1',
        version: '2016-07-01',
        name: 'Documents Admin',
        statements
      }
    })

    const response = await server.inject(options)
    expect(response.statusCode).to.equal(409)
    expect(response.result.message).to.equal('policy already exists')
  })

  lab.test('create new shared policy should return 201 and the created policy data', async () => {
    const options = utils.requestOptions({
      method: 'POST',
      url: '/authorization/shared-policies?sig=123456789',
      payload: {
        version: '2016-07-01',
        name: 'Documents Admin',
        statements
      }
    })

    const response = await server.inject(options)
    const result = response.result

    expect(response.statusCode).to.equal(201)
    expect(result.name).to.equal('Documents Admin')
    expect(result.statements).to.equal(statements)

    await udaru.policies.deleteShared({id: result.id})
  })

  lab.test('create new shared policy should allow empty string as id', async () => {
    const options = utils.requestOptions({
      method: 'POST',
      url: '/authorization/shared-policies?sig=123456789',
      payload: {
        id: '',
        version: '2016-07-01',
        name: 'Documents Admin',
        statements
      }
    })

    const response = await server.inject(options)
    const result = response.result

    expect(response.statusCode).to.equal(201)
    expect(result.id).to.not.equal('')
    expect(result.name).to.equal('Documents Admin')

    await udaru.policies.deleteShared({id: result.id})
  })

  lab.test('create new shared policy specifying an id should return 201 and the created policy data', async () => {
    const options = utils.requestOptions({
      method: 'POST',
      url: '/authorization/shared-policies?sig=123456789',
      payload: {
        id: 'mySpecialPolicyId',
        version: '2016-07-01',
        name: 'Documents Admin',
        statements
      }
    })

    const response = await server.inject(options)
    const result = response.result

    expect(response.statusCode).to.equal(201)
    expect(result.id).to.equal('mySpecialPolicyId')
    expect(result.name).to.equal('Documents Admin')

    await udaru.policies.deleteShared({id: result.id})
  })

  lab.test('update shared policy without a service key should return 403 Forbidden', async () => {
    const options = utils.requestOptions({
      method: 'PUT',
      url: '/authorization/shared-policies/whatever?sig=123',
      payload: {
        version: '2016-07-01',
        name: 'Documents Admin',
        statements
      }
    })

    const response = await server.inject(options)
    expect(response.statusCode).to.equal(403)
  })

  lab.test('update shared policy without valid data should return 400 Bad Request', async () => {
    const options = utils.requestOptions({
      method: 'PUT',
      url: '/authorization/shared-policies/whatever?sig=123456789',
      payload: {
        version: '2016-07-01',
        name: 'Documents Admin'
      }
    })

    const response = await server.inject(options)
    expect(response.statusCode).to.equal(400)
  })

  lab.test('update shared policy should return the updated policy data', async () => {
    const p = await udaru.policies.createShared(sharedPolicyCreateData)

    const options = utils.requestOptions({
      method: 'PUT',
      url: `/authorization/shared-policies/${p.id}?sig=123456789`,
      payload: {
        version: '1234',
        name: 'new policy name',
        statements: {
          Statement: [
            {
              Effect: 'Deny',
              Action: ['documents:Read'],
              Resource: ['wonka:documents:/public/*']
            }
          ]
        }
      }
    })

    const response = await server.inject(options)
    const result = response.result

    expect(response.statusCode).to.equal(200)
    expect(result.name).to.equal('new policy name')
    expect(result.version).to.equal('1234')
    expect(result.statements).to.equal({ Statement: [{ Action: ['documents:Read'], Effect: 'Deny', Resource: ['wonka:documents:/public/*'] }] })

    await udaru.policies.deleteShared({id: p.id})
  })

  lab.test('delete shared policy without a service key should return 403 Forbidden', async () => {
    const options = utils.requestOptions({
      method: 'DELETE',
      url: '/authorization/shared-policies/policyId1?sig=1234'
    })

    const response = await server.inject(options)
    expect(response.statusCode).to.equal(403)
  })

  lab.test('delete shared policy should return 204', async () => {
    const p = await udaru.policies.createShared(sharedPolicyCreateData)

    const options = utils.requestOptions({
      method: 'DELETE',
      url: `/authorization/shared-policies/${p.id}?sig=123456789`
    })

    const response = await server.inject(options)
    expect(response.statusCode).to.equal(204)
  })
})

lab.experiment('Shared policies - get/list', () => {
  let server = null

  const sharedPolicyCreateData = {
    id: 'sharedPolicyTestX',
    version: '2016-07-01',
    name: 'Documents Admin',
    statements
  }

  lab.before(async () => {
    server = await serverFactory()
    await udaru.policies.createShared(sharedPolicyCreateData)
  })

  lab.after(async () => {
    try {
      await udaru.policies.deleteShared({id: sharedPolicyCreateData.id})
    } catch (e) {
      // This is needed to ignore the error (i.e. in case the policy wasn't properly created)
    }
  })

  lab.test('get policy list has default pagination params', async () => {
    const options = utils.requestOptions({
      method: 'GET',
      url: '/authorization/shared-policies'
    })

    const response = await server.inject(options)
    expect(response.statusCode).to.equal(200)
    expect(response.result.page).to.equal(1)
    expect(response.result.limit).greaterThan(1)
  })

  lab.test('get policy list: limit', async () => {
    const options = utils.requestOptions({
      method: 'GET',
      url: '/authorization/shared-policies?limit=1&page=1'
    })

    const response = await server.inject(options)
    const result = response.result

    expect(response.statusCode).to.equal(200)
    expect(result.total).greaterThan(1)
    expect(result.page).to.equal(1)
    expect(result.limit).to.equal(1)
    expect(result.data.length).to.equal(1)
  })

  lab.test('get policy list', async () => {
    const options = utils.requestOptions({
      method: 'GET',
      url: '/authorization/shared-policies?limit=500&page=1'
    })

    const response = await server.inject(options)
    const result = response.result

    expect(response.statusCode).to.equal(200)
    expect(result.total).lessThan(result.limit) // Will fail if we need to increase limit
    let accountantPolicy = _.find(result.data, {id: 'sharedPolicyId1'})
    expect(accountantPolicy).to.equal({
      id: 'sharedPolicyId1',
      version: '0.1',
      name: 'Shared policy from fixtures',
      statements: {
        Statement: [{
          Effect: 'Allow',
          Action: ['Read'],
          Resource: ['/myapp/documents/*']
        }]
      }
    })
  })

  lab.test('get single policy', async () => {
    const options = utils.requestOptions({
      method: 'GET',
      url: '/authorization/shared-policies/sharedPolicyTestX'
    })

    const response = await server.inject(options)
    const result = response.result

    expect(response.statusCode).to.equal(200)
    expect(result).to.equal(sharedPolicyCreateData)
  })
})
