'use strict'

const expect = require('code').expect
const Lab = require('lab')
const lab = exports.lab = Lab.script()
const utils = require('./../utils')
const server = require('./../../src/hapi-udaru/wiring-hapi')
const { udaru } = utils

const statements = { Statement: [{ Effect: 'Allow', Action: ['documents:Read'], Resource: ['wonka:documents:/public/*'] }] }

const policyCreateData = {
  version: '2016-07-01',
  name: 'Documents Admin',
  statements,
  organizationId: 'WONKA'
}

lab.experiment('Users: read - delete - update', () => {
  lab.test('user list should have default pagination', (done) => {
    const options = utils.requestOptions({
      method: 'GET',
      url: '/authorization/users'
    })

    server.inject(options, (response) => {
      const result = response.result

      expect(response.statusCode).to.equal(200)
      expect(result.page).to.equal(1)
      expect(result.limit).greaterThan(1)
      expect(result.total).to.be.at.least(7)
      expect(result.data.length).to.equal(result.total)

      done()
    })
  })

  lab.test('get user list', (done) => {
    const options = utils.requestOptions({
      method: 'GET',
      url: '/authorization/users?page=1&limit=3'
    })

    server.inject(options, (response) => {
      const result = response.result

      expect(response.statusCode).to.equal(200)
      expect(result.total).to.equal(7)
      expect(result.page).to.equal(1)
      expect(result.limit).to.equal(3)
      expect(result.data.length).to.equal(3)
      expect(result.data[0]).to.equal({
        id: 'AugustusId',
        name: 'Augustus Gloop',
        organizationId: 'WONKA'
      })

      done()
    })
  })

  lab.test('get single user', (done) => {
    const options = utils.requestOptions({
      method: 'GET',
      url: '/authorization/users/AugustusId'
    })

    server.inject(options, (response) => {
      const result = response.result

      expect(response.statusCode).to.equal(200)
      expect(result).to.equal({
        id: 'AugustusId',
        name: 'Augustus Gloop',
        organizationId: 'WONKA',
        policies: [],
        teams: [
          {
            id: '1',
            name: 'Admins'
          }
        ]
      })

      done()
    })
  })

  lab.test('delete user should return 204 if success', (done) => {
    udaru.users.create({name: 'test', id: 'testId', organizationId: 'ROOT'}, (err, user) => {
      expect(err).to.not.exist()

      const options = utils.requestOptions({
        method: 'DELETE',
        url: '/authorization/users/testId',
        headers: {
          authorization: 'ROOTid'
        }
      })

      server.inject(options, (response) => {
        const result = response.result

        expect(response.statusCode).to.equal(204)
        expect(result).to.be.undefined

        done()
      })
    })
  })

  lab.test('update user should return 200 for success', (done) => {
    const options = utils.requestOptions({
      method: 'PUT',
      url: '/authorization/users/ModifyId',
      payload: {
        name: 'Modify you'
      }
    })

    server.inject(options, (response) => {
      const result = response.result

      expect(response.statusCode).to.equal(200)
      expect(result).to.equal({
        id: 'ModifyId',
        name: 'Modify you',
        organizationId: 'WONKA',
        teams: [],
        policies: []
      })

      udaru.users.update({ name: 'Modify Me', id: 'ModifyId', organizationId: 'WONKA' }, done)
    })
  })
})

lab.experiment('Users - create', () => {
  lab.test('create user for a non existent organization', (done) => {
    const options = utils.requestOptions({
      method: 'POST',
      url: '/authorization/users',
      payload: {
        name: 'Salman',
        id: 'testId'
      },
      headers: {
        authorization: 'ROOTid',
        org: 'DOES_NOT_EXISTS'
      }
    })

    server.inject(options, (response) => {
      const result = response.result

      expect(response.statusCode).to.equal(400)
      expect(result).to.equal({
        error: 'Bad Request',
        message: `Organization 'DOES_NOT_EXISTS' does not exists`,
        statusCode: 400
      })

      done()
    })
  })

  lab.test('create user for a specific organization being a SuperUser', (done) => {
    const options = utils.requestOptions({
      method: 'POST',
      url: '/authorization/users',
      payload: {
        name: 'Salman',
        id: 'testId'
      },
      headers: {
        authorization: 'ROOTid',
        org: 'OILCOUSA'
      }
    })

    server.inject(options, (response) => {
      const result = response.result

      expect(response.statusCode).to.equal(201)
      expect(result.id).to.equal('testId')
      expect(result.name).to.equal('Salman')
      expect(result.organizationId).to.equal('OILCOUSA')

      udaru.users.delete({ id: 'testId', organizationId: 'OILCOUSA' }, done)
    })
  })

  lab.test('create user for a specific organization being a SuperUser but without specifying the user id', (done) => {
    const options = utils.requestOptions({
      method: 'POST',
      url: '/authorization/users',
      payload: {
        name: 'Salman'
      },
      headers: {
        authorization: 'ROOTid',
        org: 'OILCOUSA'
      }
    })

    server.inject(options, (response) => {
      const result = response.result

      expect(response.statusCode).to.equal(201)
      expect(result.id).to.not.be.null()
      expect(result.name).to.equal('Salman')
      expect(result.organizationId).to.equal('OILCOUSA')

      udaru.users.delete({ id: result.id, organizationId: 'OILCOUSA' }, done)
    })
  })

  lab.test('create user for a specific organization being a SuperUser with an already used id', (done) => {
    const options = utils.requestOptions({
      method: 'POST',
      url: '/authorization/users',
      payload: {
        id: 'ROOTid',
        name: 'Salman'
      },
      headers: {
        authorization: 'ROOTid',
        org: 'OILCOUSA'
      }
    })

    server.inject(options, (response) => {
      const result = response.result

      expect(response.statusCode).to.equal(400)
      expect(result.message).to.equal('User with id ROOTid already present')

      done()
    })
  })

  lab.test('create user for the admin organization', (done) => {
    const options = utils.requestOptions({
      method: 'POST',
      url: '/authorization/users',
      payload: {
        name: 'Salman',
        id: 'U2FsbWFu'
      },
      headers: {
        authorization: 'ROOTid'
      }
    })

    server.inject(options, (response) => {
      const result = response.result

      expect(response.statusCode).to.equal(201)
      expect(result.id).to.equal('U2FsbWFu')
      expect(result.name).to.equal('Salman')
      expect(result.organizationId).to.equal('ROOT')

      udaru.users.delete({ id: result.id, organizationId: 'ROOT' }, done)
    })
  })

  lab.test('create user should return 400 bad request if input validation fails', (done) => {
    const options = utils.requestOptions({
      method: 'POST',
      url: '/authorization/users',
      payload: {}
    })

    server.inject(options, (response) => {
      const result = response.result

      expect(response.statusCode).to.equal(400)
      expect(result).to.include({
        statusCode: 400,
        error: 'Bad Request'
      })

      done()
    })
  })
})

lab.experiment('Users - manage policies', () => {
  lab.test('add policies to a user', (done) => {
    udaru.policies.create(policyCreateData, (err, p) => {
      expect(err).to.not.exist()

      const options = utils.requestOptions({
        method: 'PUT',
        url: '/authorization/users/ModifyId/policies',
        payload: {
          policies: [p.id]
        }
      })

      server.inject(options, (response) => {
        const result = response.result

        expect(response.statusCode).to.equal(200)
        expect(result.policies[0].id).to.equal(p.id)

        udaru.users.deletePolicies({ id: 'ModifyId', organizationId: 'WONKA' }, (err, res) => {
          expect(err).to.not.exist()

          udaru.policies.delete({ id: p.id, organizationId: 'WONKA' }, done)
        })
      })
    })
  })

  lab.test('clear and replace policies for a user', (done) => {
    udaru.policies.create(policyCreateData, (err, p) => {
      expect(err).to.not.exist()

      const options = utils.requestOptions({
        method: 'POST',
        url: '/authorization/users/ModifyId/policies',
        payload: {
          policies: [p.id]
        }
      })

      server.inject(options, (response) => {
        const result = response.result

        expect(response.statusCode).to.equal(200)
        expect(result.policies.length).to.equal(1)
        expect(result.policies[0].id).to.equal(p.id)

        udaru.policies.create(policyCreateData, (err, newP) => {
          expect(err).to.not.exist()

          options.payload.policies = [newP.id]

          server.inject(options, (response) => {
            const result = response.result

            expect(response.statusCode).to.equal(200)
            expect(result.policies.length).to.equal(1)
            expect(result.policies[0].id).to.equal(newP.id)

            udaru.users.deletePolicies({ id: 'ModifyId', organizationId: 'WONKA' }, (err, res) => {
              expect(err).to.not.exist()

              udaru.policies.delete({ id: p.id, organizationId: 'WONKA' }, (err, res) => {
                expect(err).to.not.exist()

                udaru.policies.delete({ id: newP.id, organizationId: 'WONKA' }, done)
              })
            })
          })
        })
      })
    })
  })

  lab.test('remove all user\'s policies', (done) => {
    const options = utils.requestOptions({
      method: 'DELETE',
      url: '/authorization/users/ModifyId/policies'
    })

    udaru.policies.create(policyCreateData, (err, p) => {
      expect(err).to.not.exist()

      udaru.users.addPolicies({ id: 'ModifyId', organizationId: 'WONKA', policies: [p.id] }, (err) => {
        expect(err).to.not.exist()

        server.inject(options, (response) => {
          expect(response.statusCode).to.equal(204)

          udaru.users.read({ id: 'ModifyId', organizationId: 'WONKA' }, (err, user) => {
            expect(err).not.to.exist()
            expect(user.policies).to.equal([])

            udaru.policies.delete({ id: p.id, organizationId: 'WONKA' }, done)
          })
        })
      })
    })
  })

  lab.test('remove one user\'s policies', (done) => {
    udaru.policies.create(policyCreateData, (err, p) => {
      expect(err).to.not.exist()

      udaru.users.addPolicies({ id: 'ModifyId', organizationId: 'WONKA', policies: [p.id] }, (err) => {
        expect(err).to.not.exist()

        const options = utils.requestOptions({
          method: 'DELETE',
          url: `/authorization/users/ModifyId/policies/${p.id}`
        })

        server.inject(options, (response) => {
          expect(response.statusCode).to.equal(204)

          udaru.users.read({ id: 'ModifyId', organizationId: 'WONKA' }, (err, user) => {
            expect(err).not.to.exist()
            expect(user.policies).to.equal([])

            udaru.policies.delete({ id: p.id, organizationId: 'WONKA' }, done)
          })
        })
      })
    })
  })
})

lab.experiment('Users - checking org_id scoping', () => {
  let policyId

  lab.before((done) => {
    udaru.organizations.create({ id: 'NEWORG', name: 'new org', description: 'new org' }, (err, org) => {
      if (err) return done(err)

      const policyData = {
        version: '1',
        name: 'Documents Admin',
        organizationId: 'NEWORG',
        statements
      }

      udaru.policies.create(policyData, (err, policy) => {
        if (err) return done(err)

        policyId = policy.id
        done()
      })
    })
  })

  lab.after((done) => {
    udaru.organizations.delete('NEWORG', done)
  })

  lab.test('add policies from a different organization should not be allowed', (done) => {
    const options = utils.requestOptions({
      method: 'PUT',
      url: '/authorization/users/ModifyId/policies',
      payload: {
        policies: [policyId]
      }
    })

    server.inject(options, (response) => {
      expect(response.statusCode).to.equal(400)
      done()
    })
  })

  lab.test('replace policies from a different organization should not be allowed', (done) => {
    const options = utils.requestOptions({
      method: 'POST',
      url: '/authorization/users/ModifyId/policies',
      payload: {
        policies: [policyId]
      }
    })

    server.inject(options, (response) => {
      expect(response.statusCode).to.equal(400)
      done()
    })
  })
})
