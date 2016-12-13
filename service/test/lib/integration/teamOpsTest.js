
'use strict'

const expect = require('code').expect
const Lab = require('lab')
const lab = exports.lab = Lab.script()
const logger = require('pino')()

const TeamOps = require('../../../lib/teamOps')
const PolicyOps = require('../../../lib/policyOps')
const dbConn = require('../../../lib/dbConn')

const db = dbConn.create(logger)
const teamOps = TeamOps(db.pool, logger)
const policyOps = PolicyOps(db.pool, logger)

let testTeamId

lab.experiment('TeamOps', () => {
  lab.test('list of all teams', (done) => {
    teamOps.listAllTeams({}, (err, result) => {
      expect(err).to.not.exist()
      expect(result).to.exist()
      expect(result.length).to.equal(6)
      // TODO:      t.deepEqual(result, expectedUserList, 'data should be as expected')

      done()
    })
  })

  lab.test('list of org teams', (done) => {
    teamOps.listOrgTeams(['WONKA'], (err, result) => {
      expect(err).to.not.exist()
      expect(result).to.exist()
      expect(result.length).to.equal(6)
      // TODO:      t.deepEqual(result, expectedUserList, 'data should be as expected')

      done()
    })
  })

  lab.test('create, update and delete a team', (done) => {
    const teamData = {
      name: 'Team 4',
      description: 'This is a test team',
      parentId: null,
      organizationId: 'WONKA'
    }
    teamOps.createTeam(teamData, function (err, result) {
      testTeamId = result.id

      expect(err).to.not.exist()
      expect(result).to.exist()
      expect(result.name).to.equal('Team 4')

      teamOps.updateTeam([testTeamId, 'Team 5', 'description', [{'id': 1, 'name': 'Tom Watson'}, {'id': 2, 'name': 'Michael O\'Brien'}], [{'id': 1, 'name': 'Financial info access'}]], (err, result) => {
        expect(err).to.not.exist()
        expect(result).to.exist()
        expect(result.name).to.equal('Team 5')

        teamOps.deleteTeamById([testTeamId], (err) => {
          if (err) return done(err)

          policyOps.listByOrganization('WONKA', (err, policies) => {
            expect(err).to.not.exist()

            const defaultPolicy = policies.find((p) => { return p.name === 'Default Team Admin for ' + testTeamId })
            expect(defaultPolicy).to.exist()

            policyOps.deletePolicyById([defaultPolicy.id], done)
          })
        })
      })
    })
  })

  lab.test('read a specific team', (done) => {
    teamOps.readTeamById([1], (err, result) => {
      expect(err).to.not.exist()
      expect(result).to.exist()
      expect(result.users.length).to.equal(1)
      expect(result.policies.length).to.equal(1)

      done()
    })
  })

  lab.test('creating a team should create a default admin policy', (done) => {
    const teamData = {
      name: 'Team 5',
      description: 'This is a test team for policies',
      parentId: null,
      organizationId: 'WONKA'
    }
    teamOps.createTeam(teamData, function (err, result) {
      expect(err).to.not.exist()
      expect(result).to.exist()

      policyOps.listByOrganization('WONKA', (err, policies) => {
        expect(err).to.not.exist()

        const defaultPolicy = policies.find((p) => { return p.name === 'Default Team Admin for ' + result.id })
        expect(defaultPolicy).to.exist()

        policyOps.deletePolicyById([defaultPolicy.id], (err) => {
          expect(err).to.not.exist()

          teamOps.deleteTeamById([result.id], done)
        })
      })
    })
  })
})
