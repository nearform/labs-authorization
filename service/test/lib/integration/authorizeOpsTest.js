'use strict'

const expect = require('code').expect
const Lab = require('lab')
const lab = exports.lab = Lab.script()
const async = require('async')

const authorize = require('../../../lib/ops/authorizeOps')
const organizationOps = require('../../../lib/ops/organizationOps')
const userOps = require('../../../lib/ops/userOps')
const teamOps = require('../../../lib/ops/teamOps')
const policyOps = require('../../../lib/ops/policyOps')

const fs = require('fs')
const path = require('path')

let testUserId
let testTeamId
const organizationId = 'WONKA'
const testUserData = {
  name: 'Salman',
  organizationId
}
const updateUserData = {
  organizationId,
  name: 'Salman',
  teams: [4]
}


lab.experiment('AuthorizeOps', () => {
  lab.before((done) => {
    userOps.createUser(testUserData, (err, result) => {
      if (err) return done(err)
      testUserId = result.id

      updateUserData.id = testUserId
      userOps.updateUser(updateUserData, (err, result) => {
        if (err) return done(err)

        userOps.replaceUserPolicies({ id: testUserId, policies: [1], organizationId }, done)
      })
    })
  })

  lab.after((done) => {
    userOps.deleteUser({ id: testUserId, organizationId: 'WONKA' }, (err, res) => {
      if (err) return done(err)

      teamOps.deleteTeam({ id: testTeamId, organizationId }, done)
    })
  })

  lab.test('check authorization should return access true for allowed', (done) => {
    authorize.isUserAuthorized({ userId: testUserId, resource: 'database:pg01:balancesheet', action: 'finance:ReadBalanceSheet' }, (err, result) => {
      if (err) return done(err)

      expect(err).to.not.exist()
      expect(result).to.exist()
      expect(result.access).to.be.true()

      done()
    })
  })

  lab.test('authorize isUserAuthorized - check on a resource and action with wildcards both in action and resource', (done) => {

    userOps.replaceUserPolicies({ id: testUserId, policies: [5], organizationId }, (err, result) => {
      if (err) return done(err)

      authorize.isUserAuthorized({ userId: testUserId, resource: 'database:pg01:balancesheet', action: 'database:dropTable' }, (err, result) => {
        if (err) return done(err)

        expect(err).to.not.exist()
        expect(result).to.exist()
        expect(result.access).to.be.true()

        done()
      })
    })
  })

  lab.test('authorize isUserAuthorized - check on a resource and action with wildcards only for resource', (done) => {

    userOps.replaceUserPolicies({ id: testUserId, policies: [6], organizationId }, (err, result) => {
      if (err) return done(err)

      authorize.isUserAuthorized({ userId: testUserId, resource: 'database:pg01:balancesheet', action: 'database:Read' }, (err, result) => {
        if (err) return done(err)

        expect(err).to.not.exist()
        expect(result).to.exist()
        expect(result.access).to.be.true()

        done()
      })
    })
  })

  lab.test('authorize isUserAuthorized - check on a resource and action with wildcards only for action', (done) => {
    userOps.replaceUserPolicies({ id: testUserId, policies: [7], organizationId }, (err, result) => {
      if (err) return done(err)

      authorize.isUserAuthorized({ userId: testUserId, resource: 'database:pg01:balancesheet', action: 'database:Delete' }, (err, result) => {
        if (err) return done(err)

        expect(err).to.not.exist()
        expect(result).to.exist()
        expect(result.access).to.be.true()

        done()
      })
    })
  })

  lab.test('authorize isUserAuthorized - check on a resource and action with wildcards for URL resource', (done) => {
    userOps.replaceUserPolicies({ id: testUserId, policies: [8], organizationId }, (err, result) => {
      if (err) return done(err)

      authorize.isUserAuthorized({ userId: testUserId, resource: '/my/site/i/should/read/this', action: 'Read' }, (err, result) => {
        if (err) return done(err)

        expect(err).to.not.exist()
        expect(result).to.exist()
        expect(result.access).to.be.true()

        done()
      })
    })
  })

  lab.test('authorize isUserAuthorized - should return false if the policies has a wildcard on the resource but we are asking for the wrong action', (done) => {
    userOps.replaceUserPolicies({ id: testUserId, policies: [6], organizationId }, (err, result) => {
      if (err) return done(err)

      authorize.isUserAuthorized({ userId: testUserId, resource: 'database:pg01:balancesheet', action: 'database:Write' }, (err, result) => {
        if (err) return done(err)

        expect(err).to.not.exist()
        expect(result).to.exist()
        expect(result.access).to.be.false()

        done()
      })
    })
  })

  lab.test('authorize isUserAuthorized - should return false if the policies has a wildcard on the action but we are asking for the wrong resource', (done) => {
    userOps.replaceUserPolicies({ id: testUserId, policies: [6], organizationId }, (err, result) => {
      if (err) return done(err)

      authorize.isUserAuthorized({ userId: testUserId, resource: 'database:pg01:notMyTable', action: 'database:Write' }, (err, result) => {
        if (err) return done(err)

        expect(err).to.not.exist()
        expect(result).to.exist()
        expect(result.access).to.be.false()

        done()
      })
    })
  })

  lab.test('authorize listAuthorizations - get all user actions on a resource', (done) => {
    const testTeamName = 'Actors'
    const testTeamParent = null
    const testTeamDesc = 'Famous Actors'
    const tasks = []

    // set-up
    tasks.push((cb) => {
      updateUserData.id = testUserId
      updateUserData.teams = []
      userOps.updateUser(updateUserData, cb)
    })
    tasks.push((result, cb) => {
      userOps.replaceUserPolicies({ id: testUserId, policies: [], organizationId }, cb)
    })

    tasks.push((result, cb) => {
      teamOps.listOrgTeams({ organizationId }, (err, result) => {
        expect(result.length).to.equal(6)
        cb(err, result)
      })
    })

    tasks.push((result, cb) => {
      const teamData = {
        name: testTeamName,
        description: testTeamDesc,
        parentId: testTeamParent,
        organizationId
      }
      teamOps.createTeam(teamData, (err, result) => {
        expect(err).to.not.exist()
        testTeamId = result.id
        cb(err, result)
      })
    })

    // test for no permissions on the resource
    tasks.push((result, cb) => {
      authorize.listAuthorizations({
        userId: testUserId,
        resource: 'database:pg01:balancesheet'
      }, (err, result) => {
        expect(err).to.not.exist()
        expect(result).to.exist()
        expect(result.actions).to.equal([])

        cb(err, result)
      })
    })

    // test for team permissions on the resource
    tasks.push((result, cb) => {
      const teamData = {
        id: testTeamId,
        users: [testUserId],
        organizationId
      }
      teamOps.replaceUsersInTeam(teamData, cb)
    })

    tasks.push((result, cb) => {
      authorize.listAuthorizations({
        userId: testUserId,
        resource: 'database:pg01:balancesheet'
      }, (err, result) => {
        expect(err).to.not.exist()
        expect(result).to.exist()
        expect(result.actions).to.equal(['finance:ReadBalanceSheet'])

        cb(err, result)
      })
    })

    // test for user permissions on the resource
    tasks.push((result, cb) => {
      updateUserData.teams = []
      userOps.updateUser(updateUserData, cb)
    })
    tasks.push((result, cb) => {
      userOps.replaceUserPolicies({ id: testUserId, policies: [3], organizationId }, cb)
    })

    tasks.push((result, cb) => {
      authorize.listAuthorizations({
        userId: testUserId,
        resource: 'database:pg01:balancesheet'
      }, (err, result) => {
        expect(err).to.not.exist()
        expect(result).to.exist()
        expect(result.actions).to.equal(['finance:ReadBalanceSheet', 'finance:ImportBalanceSheet'])

        cb(err, result)
      })
    })

    // test for team and user permissions on the resource
    tasks.push((result, cb) => {
      updateUserData.teams = [1]
      userOps.updateUser(updateUserData, cb)
    })
    tasks.push((result, cb) => {
      userOps.replaceUserPolicies({ id: testUserId, policies: [4], organizationId }, cb)
    })

    tasks.push((result, cb) => {
      authorize.listAuthorizations({
        userId: testUserId,
        resource: 'database:pg01:balancesheet'
      }, (err, result) => {
        expect(err).to.not.exist()
        expect(result).to.exist()
        expect(result.actions).to.equal(['finance:ReadBalanceSheet', 'finance:EditBalanceSheet'])

        cb(err, result)
      })
    })

    async.waterfall(tasks, done)
  })
})

lab.experiment('AuthorizeOps - list and access with multiple policies', () => {
  let adminId
  let savedPolicies
  const organizationId = 'nearForm'

  lab.before((done) => {
    const policies = JSON.parse(fs.readFileSync(path.join(__dirname, 'policies.json'), { encoding: 'utf8' }))
    policies.map((policy) => {
      policy.statements = JSON.stringify(policy.statements)

      return policy
    })

    organizationOps.create({ id: organizationId, name: 'nearForm', description: 'nearform description', user: { name: 'admin' } }, (err, res) => {
      if (err) return done(err)

      adminId = res.user.id

      const tasks = policies.map((policy, index) => {
        return (next) => {
          policy.organizationId = organizationId
          policyOps.createPolicy(policy, next)
        }
      })

      async.series(tasks, (err, res) => {
        if (err) return done(err)

        savedPolicies = res
        done()
      })
    })
  })

  lab.test('check list simple action', (done) => {
    userOps.replaceUserPolicies({ id: adminId, organizationId, policies: [ savedPolicies[0].id ] }, (err, res) => {
      if (err) return done(err)

      authorize.listAuthorizations({
        userId: adminId,
        resource: 'FOO:orga:CLOUDCUCKOO:scenario:bau-1',
        organizationId
      }, (err, res) => {
        expect(err).to.not.exist()
        expect(res).to.equal({ actions: ['FOO:scenario:read'] })

        done()
      })
    })
  })

  lab.test('check list simple action on multiple resources', (done) => {
    userOps.replaceUserPolicies({
      id: adminId,
      organizationId,
      policies: [ savedPolicies[0].id, savedPolicies[1].id ]
    }, (err, res) => {
      if (err) return done(err)

      authorize.listAuthorizations({
        userId: adminId,
        resource: 'FOO:orga:CLOUDCUCKOO:scenario:TEST:entity:north-america-id',
        organizationId
      }, (err, res) => {
        expect(err).to.not.exist()
        expect(res).to.equal({ actions: ['FOO:scenario:filter'] })

        done()
      })
    })
  })

  lab.test('check list multiple actions', (done) => {
    userOps.replaceUserPolicies({
      id: adminId,
      organizationId,
      policies: [ savedPolicies[4].id, savedPolicies[5].id ]
    }, (err, res) => {
      if (err) return done(err)

      authorize.listAuthorizations({
        userId: adminId,
        resource: 'FOO:orga:shell:scenario:TEST',
        organizationId
      }, (err, res) => {
        expect(err).to.not.exist()
        expect(res).to.equal({ actions: [
          'FOO:scenario:granular-read',
          'FOO:scenario:clone',
          'FOO:scenario:download',
          'FOO:scenario:delete',
          'FOO:scenario:publish'
        ]})

        done()
      })
    })
  })

  lab.after((done) => {
    organizationOps.deleteById('nearForm', done)
  })
})
