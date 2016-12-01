'use strict'

const expect = require('code').expect
const Lab = require('lab')
const lab = exports.lab = Lab.script()
var proxyquire = require('proxyquire')

var policyOps = {}
var policiesRoutes = proxyquire('./../../../routes/private/policies', { './../../lib/policyOps': () => policyOps })
var server = proxyquire('./../../../wiring-hapi', { './routes/private/policies': policiesRoutes })

lab.experiment('Policies', () => {
  lab.test('create new policy without a service key should return 403 Forbidden', (done) => {
    const options = {
      method: 'POST',
      url: '/authorization/policies?sig=1234'
    }

    server.inject(options, (response) => {
      expect(response.statusCode).to.equal(403)

      done()
    })
  })

  lab.test('create new policy without valid data should return 400 Bad Request', (done) => {
    const options = {
      method: 'POST',
      url: '/authorization/policies?sig=123456789',
      payload: {
        version: '2016-07-01',
        name: 'Documents Admin',
        orgId: 'WONKA'
      }
    }

    server.inject(options, (response) => {
      expect(response.statusCode).to.equal(400)

      done()
    })
  })

  lab.test('create new policy should return 201 and the created policy data', (done) => {
    const policyStub = {
      id: 2,
      version: '2016-07-01',
      name: 'Documents Admin',
      orgId: 'WONKA',
      statements: '{"Statement":[{"Effect":"Allow","Action":["documents:Read"],"Resource":["wonka:documents:/public/*"]}]}'
    }

    const options = {
      method: 'POST',
      url: '/authorization/policies?sig=123456789',
      payload: {
        version: policyStub.version,
        name: policyStub.name,
        orgId: policyStub.orgId,
        statements: policyStub.statements
      }
    }

    policyOps.createPolicy = (params, cb) => {
      process.nextTick(() => {
        cb(null, policyStub)
      })
    }

    server.inject(options, (response) => {
      const result = response.result

      expect(response.statusCode).to.equal(201)
      expect(result).to.equal(policyStub)

      done()
    })
  })

  lab.test('update new policy without a service key should return 403 Forbidden', (done) => {
    const options = {
      method: 'PUT',
      url: '/authorization/policies/1?sig=1234'
    }

    server.inject(options, (response) => {
      expect(response.statusCode).to.equal(403)

      done()
    })
  })

  lab.test('update policy without valid data should return 400 Bad Request', (done) => {
    const options = {
      method: 'PUT',
      url: '/authorization/policies/1?sig=123456789',
      payload: {
        version: '2016-07-01',
        name: 'Documents Admin',
        orgId: 'WONKA'
      }
    }

    server.inject(options, (response) => {
      expect(response.statusCode).to.equal(400)

      done()
    })
  })

  lab.test('update new policy should return the updated policy data', (done) => {
    const policyStub = {
      id: 2,
      version: '2016-07-01',
      name: 'Documents Admin - updated',
      orgId: 'WONKA',
      statements: '{"Statement":[{"Effect":"Allow","Action":["documents:Update"],"Resource":["wonka:documents:/public/*"]}]}'
    }

    const options = {
      method: 'PUT',
      url: '/authorization/policies/2?sig=123456789',
      payload: {
        version: policyStub.version,
        name: policyStub.name,
        orgId: policyStub.orgId,
        statements: policyStub.statements
      }
    }

    policyOps.updatePolicy = (params, cb) => {
      process.nextTick(() => {
        cb(null, policyStub)
      })
    }

    server.inject(options, (response) => {
      const result = response.result

      expect(response.statusCode).to.equal(200)
      expect(result).to.equal(policyStub)

      done()
    })
  })

  lab.test('delete policy without a service key should return 403 Forbidden', (done) => {
    const options = {
      method: 'DELETE',
      url: '/authorization/policies/1?sig=1234'
    }

    server.inject(options, (response) => {
      expect(response.statusCode).to.equal(403)

      done()
    })
  })

  lab.test('delete policy should return 204', (done) => {
    const options = {
      method: 'DELETE',
      url: '/authorization/policies/1?sig=123456789'
    }

    policyOps.deletePolicyById = (params, cb) => {
      process.nextTick(() => {
        cb(null)
      })
    }

    server.inject(options, (response) => {
      expect(response.statusCode).to.equal(204)

      done()
    })
  })
})
