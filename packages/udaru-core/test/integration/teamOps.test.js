
'use strict'

const _ = require('lodash')
const expect = require('code').expect
const Lab = require('lab')
const lab = exports.lab = Lab.script()
const crypto = require('crypto')
const u = require('../testUtils')
const udaru = require('../..')()

const statements = { Statement: [{ Effect: 'Allow', Action: ['documents:Read'], Resource: ['wonka:documents:/public/*'] }] }

function randomId () {
  return crypto.randomBytes(2).toString('hex')
}

lab.experiment('TeamOps', () => {
  let testTeam
  let users
  let policies = []
  lab.before(done => {
    udaru.users.list({ organizationId: 'WONKA' }, (err, fetchedUsers) => {
      expect(err).to.not.exist()
      expect(fetchedUsers).to.exist()
      expect(fetchedUsers.length).to.be.at.least(2)
      users = fetchedUsers

      udaru.policies.create({
        version: '1',
        name: randomId(),
        organizationId: 'WONKA',
        statements
      }, (err, createdPolicy) => {
        expect(err).to.not.exist()
        expect(createdPolicy).to.exist()
        policies.push(createdPolicy)

        udaru.policies.create({
          version: '1',
          name: randomId(),
          organizationId: 'WONKA',
          statements
        }, (err, createdPolicy) => {
          expect(err).to.not.exist()
          expect(createdPolicy).to.exist()
          policies.push(createdPolicy)

          udaru.policies.create({
            id: 'testPolicyId-1234',
            version: '1',
            name: randomId(),
            organizationId: 'ROOT',
            statements
          }, (err, createdPolicy) => {
            expect(err).to.not.exist()
            expect(createdPolicy).to.exist()
            policies.push(createdPolicy)
            done()
          })
        })
      })
    })
  })

  lab.beforeEach(done => {
    testTeam = {
      name: 'test::teamOps:bfrEach:' + randomId(),
      description: 'description',
      organizationId: 'WONKA'
    }
    udaru.teams.create(testTeam, (err, result) => {
      expect(err).to.not.exist()
      expect(result).to.exist()
      expect(result.id).to.exist()
      testTeam.id = result.id // afterEach will cleanup based on the ID
      done()
    })
  })

  lab.afterEach(done => {
    // always cleanup test data
    if (testTeam && testTeam.id) {
      udaru.teams.delete({ id: testTeam.id, organizationId: 'WONKA' }, done)
      testTeam = null
    } else {
      done()
    }
  })

  lab.test('list of org teams', (done) => {
    udaru.teams.list({ organizationId: 'WONKA' }, (err, result) => {
      expect(err).to.not.exist()
      expect(result).to.exist()

      let expectedTeamIds = [
        'Admins',
        'Readers',
        'Authors',
        'Managers',
        'Personnel Managers',
        'Company Lawyer'
      ]
      expect(_.map(result, 'name')).contains(expectedTeamIds)
      done()
    })
  })

  lab.test('Add twice the same user to a team', (done) => {
    let userIds = [users[0].id]
    udaru.teams.addUsers({ id: testTeam.id, organizationId: 'WONKA', users: userIds }, (err, result) => {
      expect(err).to.not.exist()
      expect(result).to.exist()

      userIds = [users[0].id, users[1].id]
      udaru.teams.addUsers({ id: testTeam.id, organizationId: 'WONKA', users: userIds }, (err, result) => {
        expect(err).to.not.exist()
        expect(result).to.exist()
        expect(result.users.length).to.equal(2)

        udaru.teams.read({ id: testTeam.id, organizationId: 'WONKA' }, (err, readTeam) => {
          expect(err).to.not.exist()
          expect(readTeam).to.exist()
          expect(readTeam.users.length).to.equal(2)
          expect(readTeam.users).to.equal([
            _.pick(users[0], 'id', 'name'),
            _.pick(users[1], 'id', 'name')
          ])

          done()
        })
      })
    })
  })

  lab.test('create, update only the team name', (done) => {
    testTeam.name += '_n'

    udaru.teams.update(testTeam, (err, result) => {
      expect(err).to.not.exist()
      expect(result).to.exist()
      expect(result.name).to.equal(testTeam.name)
      expect(result.description).to.equal(testTeam.description)

      done()
    })
  })

  lab.test('create, update only the team description', (done) => {
    testTeam.description = '_d'

    udaru.teams.update(testTeam, (err, result) => {
      expect(err).to.not.exist()
      expect(result).to.exist()
      expect(result.name).to.equal(testTeam.name)
      expect(result.description).to.equal(testTeam.description)

      done()
    })
  })

  lab.test('create team and update meta', (done) => {
    const meta1 = {keya: 'vala', keyb: 'valb'}
    const meta2 = {keyx: 'valx', keyy: 'valy'}
    let testTeam = {
      id: 'nearForm',
      name: 'nearForm Meta1',
      description: 'description',
      metadata: meta1,
      organizationId: 'WONKA'
    }

    udaru.teams.create(testTeam, {createOnly: true}, (err, result) => {
      expect(err).to.not.exist()
      expect(result).to.exist()
      expect(result.name).to.equal(testTeam.name)
      expect(result.metadata).to.equal(meta1)

      testTeam.name = 'nearForm Meta2'
      testTeam.metadata = meta2

      udaru.teams.update(testTeam, (err, result) => {
        expect(err).to.not.exist()

        // might aswell read correctly for completeness
        udaru.teams.read({id: testTeam.id, organizationId: testTeam.organizationId}, (err, result) => {
          expect(err).to.not.exist()
          expect(result).to.exist()
          expect(result.name).to.equal(testTeam.name)
          expect(result.metadata).to.equal(meta2)

          udaru.teams.delete(testTeam, done)
        })
      })
    })
  })

  // TODO: Needs review
  lab.test('read a specific team', (done) => {
    udaru.teams.read({ id: '2', organizationId: 'WONKA' }, (err, result) => {
      expect(err).to.not.exist()
      expect(result).to.exist()
      expect(result.name).to.equal('Readers')
      expect(result.description).to.equal('General read-only access')
      expect(result.usersCount).to.equal(2)
      expect(result.usersCount).to.equal(result.users.length)
      expect(result.users.length).to.equal(2)
      expect(result.policies.length).to.equal(0)

      done()
    })
  })

  lab.test('read users from a specific team', (done) => {
    udaru.teams.listUsers({ id: '2', organizationId: 'WONKA' }, (err, result) => {
      expect(err).to.not.exist()
      expect(result).to.exist()
      expect(result.page).to.equal(1)
      expect(result.limit).to.greaterThan(1)
      expect(result.total).to.equal(2)
      expect(result.data.length).to.equal(2)
      expect(result.data).to.equal([
        { id: 'CharlieId', name: 'Charlie Bucket' },
        { id: 'VerucaId', name: 'Veruca Salt' }
      ])

      done()
    })
  })

  lab.test('paginated read users from a specific team', (done) => {
    udaru.teams.listUsers({ id: '2', page: 2, limit: 1, organizationId: 'WONKA' }, (err, result) => {
      expect(err).to.not.exist()
      expect(result).to.exist()
      expect(result.page).to.equal(2)
      expect(result.limit).to.equal(1)
      expect(result.total).to.equal(2)
      expect(result.data.length).to.equal(1)
      expect(result.data).to.equal([
        { id: 'VerucaId', name: 'Veruca Salt' }
      ])

      done()
    })
  })

  lab.test('creating a team should create a default admin policy', (done) => {
    udaru.policies.list({ organizationId: 'WONKA' }, (err, policies) => {
      expect(err).to.not.exist()

      const defaultPolicy = policies.find((p) => { return p.name === 'Default Team Admin for ' + testTeam.id })
      expect(defaultPolicy).to.exist()

      udaru.policies.delete({ id: defaultPolicy.id, organizationId: 'WONKA' }, (err) => {
        expect(err).to.not.exist()
        done()
      })
    })
  })

  lab.test('creating a team with createOnly option should not create a default admin policy', (done) => {
    let testTeam = {
      name: 'test::teamOps:+only:' + randomId(),
      description: 'description',
      organizationId: 'WONKA'
    }

    udaru.teams.create(testTeam, { createOnly: true }, (err, result) => {
      expect(err).to.not.exist()
      expect(result).to.exist()
      expect(result.id).to.exist()
      testTeam.id = result.id // afterEach will cleanup based on the ID

      udaru.policies.list({ organizationId: 'WONKA' }, (err, policies) => {
        udaru.teams.delete(testTeam, (err) => { if (err) throw err })
        expect(err).to.not.exist()

        const defaultPolicy = policies.find((p) => {
          return p.name === 'Default Team Admin for ' + testTeam.id
        })
        expect(defaultPolicy).to.not.exist()
        done()
      })
    })
  })

  lab.test('creating a team with the same id should fail second time', (done) => {
    let testTeam = {
      id: 'nearForm',
      name: 'nearForm',
      description: 'description',
      organizationId: 'WONKA'
    }

    udaru.teams.create(testTeam, { createOnly: true }, (err, result) => {
      expect(err).to.not.exist()
      expect(result).to.exist()

      udaru.teams.create(testTeam, { createOnly: true }, (err, result) => {
        expect(err).to.exist()
        expect(err.output.statusCode).to.equal(409)
        expect(err.message).to.equal('Key (id)=(nearForm) already exists.')

        udaru.teams.delete(testTeam, done)
      })
    })
  })

  lab.test('creating a team with invalid id should fail', (done) => {
    let testTeam = {
      id: 'id _ with ~ invalid / chars',
      name: 'nearForm',
      description: 'description',
      organizationId: 'WONKA'
    }

    udaru.teams.create(testTeam, { createOnly: true }, (err, result) => {
      expect(err).to.exist()
      expect(err.output.statusCode).to.equal(400)
      expect(err.message).to.equal('child "id" fails because ["id" with value "id _ with ~ invalid / chars" fails to match the required pattern: /^[A-Za-z0-9-]+$/]')

      done()
    })
  })

  lab.test('create a team with long name should fail', (done) => {
    const teamName = 'a'.repeat(31)
    udaru.teams.create({ organizationId: 'WONKA', name: teamName, description: 'nearform description' }, (err, result) => {
      expect(err).to.exist()
      expect(err.output.statusCode).to.equal(400)
      expect(err.message).to.match(/length must be less than/)

      done()
    })
  })

  lab.test('create a team with long id should fail', (done) => {
    const longId = 'a'.repeat(129)
    udaru.teams.create({ id: longId, organizationId: 'WONKA', name: 'team name', description: 'nearform description' }, (err, result) => {
      expect(err).to.exist()
      expect(err.output.statusCode).to.equal(400)
      expect(err.message).to.match(/length must be less than/)

      done()
    })
  })

  lab.test('create team support creation of default team admin user', (done) => {
    let teamId = randomId()
    let testTeam = {
      name: 'test::teamOps:dfltAdmin:' + teamId,
      description: 'description',
      organizationId: 'WONKA',
      user: { name: 'test:' + teamId }
    }
    setTimeout(() => {
      // TODO: delete team
      udaru.teams.delete(testTeam, () => { })
    }, 5000)

    udaru.teams.create(testTeam, function (err, team) {
      expect(err).to.not.exist()
      expect(team).to.exist()
      expect(team.users).to.exist()

      const defaultUser = team.users.find((u) => { return u.name === testTeam.user.name })
      expect(defaultUser).to.exist()

      udaru.users.read({ id: defaultUser.id, organizationId: 'WONKA' }, (err, user) => {
        expect(err).to.not.exist()

        expect(user.name).to.be.equal(testTeam.user.name)

        const defaultPolicy = user.policies.find((p) => { return p.name === 'Default Team Admin for ' + team.id })
        expect(defaultPolicy).to.exist()

        udaru.teams.delete({ id: team.id, organizationId: 'WONKA' }, (err) => {
          expect(err).to.not.exist()

          udaru.users.delete({ id: user.id, organizationId: 'WONKA' }, done)
        })
      })
    })
  })

  lab.test('create team support creation of default team admin user and specific user id', (done) => {
    let teamId = randomId()
    let testTeam = {
      name: 'test::teamOps:dfltAdmin:' + teamId,
      description: 'description',
      organizationId: 'WONKA',
      user: { name: 'test:' + teamId, id: 'test-' + teamId }
    }
    setTimeout(() => {
      // TODO: delete team
      udaru.teams.delete(testTeam, () => { })
    }, 5000)

    udaru.teams.create(testTeam, function (err, team) {
      expect(err).to.not.exist()
      expect(team).to.exist()
      expect(team.users).to.exist()
      expect(team.users.length).to.equal(1)
      expect(team.users[0]).to.equal({ id: testTeam.user.id, name: testTeam.user.name })

      const defaultUser = team.users[0]

      udaru.users.read({ id: defaultUser.id, organizationId: 'WONKA' }, (err, user) => {
        expect(err).to.not.exist()

        const defaultPolicy = user.policies.find((p) => { return p.name === 'Default Team Admin for ' + team.id })
        expect(defaultPolicy).to.exist()

        udaru.teams.delete({ id: team.id, organizationId: 'WONKA' }, (err) => {
          expect(err).to.not.exist()

          udaru.users.delete({ id: user.id, organizationId: 'WONKA' }, done)
        })
      })
    })
  })

  lab.test('createTeam should build path', (done) => {
    let childTeam = {
      name: 'test:team:child:' + randomId(),
      description: 'child',
      parentId: testTeam.id,
      organizationId: 'WONKA'
    }

    udaru.teams.create(childTeam, function (err, result) {
      expect(err).to.not.exist()
      expect(result).to.exist()
      expect(result.path).to.equal(testTeam.id + '.' + result.id)

      udaru.teams.delete({ id: result.id, organizationId: 'WONKA' }, done)
    })
  })

  lab.test('deleteTeam should also delete descendants', (done) => {
    const childTeam = {
      name: 'Team Parent',
      description: 'This is a test team for paths',
      parentId: null,
      organizationId: 'WONKA'
    }
    childTeam.parentId = testTeam.id

    udaru.teams.create(childTeam, (err, childTeam) => {
      expect(err).to.not.exist()
      expect(childTeam).to.exist()

      expect(childTeam.path).to.equal(testTeam.id + '.' + childTeam.id)

      udaru.teams.delete({ organizationId: 'WONKA', id: testTeam.id }, (err) => {
        expect(err).to.not.exist()
        testTeam = null // so that afterEach don't try to delete a team that was already deleted
        udaru.teams.read({ id: childTeam.id, organizationId: 'WONKA' }, (err) => {
          expect(err).to.exist()
          expect(err.isBoom).to.be.true()
          expect(err.message).to.match(/Team with id [a-zA-Z0-9-]+ could not be found/)
          done()
        })
      })
    })
  })

  lab.test('moveTeam should return an error if the moved team has invalid ID', (done) => {
    const id = 'InvalidMoveID'
    const parentId = 'InvalidParentMoveID'
    udaru.teams.move({ id: id, parentId: parentId, organizationId: 'WONKA' }, (err, result) => {
      expect(err).to.exist()
      expect(err.message).to.include('Some teams')
      expect(err.message).to.include('were not found')
      expect(err.message).to.include(id)
      expect(err.message).to.include(parentId)

      done()
    })
  })

  lab.test('moveTeam should return an error if teams are from different orgs', (done) => {
    let childTeam = {
      id: 'childTeam',
      name: 'Team Child',
      description: 'This is a test team for paths',
      parentId: null,
      organizationId: 'ROOT'
    }

    udaru.teams.create(childTeam, (err, childTeam) => {
      expect(err).to.not.exist()
      expect(childTeam).to.exist()

      let testTeam2 = {
        id: 'TeamParent',
        name: 'Team Parent',
        description: 'This is a test team for paths',
        organizationId: 'WONKA'
      }
      udaru.teams.create(testTeam2, (err, testTeam2) => {
        expect(err).to.not.exist()
        expect(testTeam2).to.exist()

        udaru.teams.move({ id: childTeam.id, parentId: testTeam2.id, organizationId: 'WONKA' }, (err, result) => {
          expect(err).to.exist()
          expect(err.message).to.equal('Some teams [childTeam] were not found')

          udaru.teams.delete({ id: childTeam.id, organizationId: 'ROOT' }, (err, result) => {
            expect(err).to.not.exist()

            udaru.teams.delete({ id: testTeam2.id, organizationId: 'WONKA' }, done)
          })
        })
      })
    })
  })

  lab.test('moveTeam should update path', (done) => {
    let childTeam = {
      name: 'Team Child',
      description: 'This is a test team for paths',
      parentId: testTeam.id,
      organizationId: 'WONKA'
    }

    udaru.teams.create(childTeam, (err, childTeam) => {
      expect(err).to.not.exist()
      expect(childTeam).to.exist()

      let testTeam2 = {
        name: 'Team Parent',
        description: 'This is a test team for paths',
        organizationId: 'WONKA'
      }
      udaru.teams.create(testTeam2, (err, testTeam2) => {
        expect(err).to.not.exist()
        expect(testTeam2).to.exist()
        udaru.teams.move({ id: childTeam.id, parentId: testTeam2.id, organizationId: 'WONKA' }, (err, result) => {
          expect(err).to.not.exist()
          expect(result).to.exist()
          expect(result.path).to.equal(testTeam2.id + '.' + childTeam.id)

          udaru.teams.read({ id: childTeam.id, organizationId: 'WONKA' }, (err, result) => {
            expect(err).to.not.exist()
            expect(result).to.exist()
            expect(result.path).to.equal(testTeam2.id + '.' + childTeam.id)

            udaru.teams.delete({ id: testTeam2.id, organizationId: 'WONKA' }, done)
          })
        })
      })
    })
  })

  lab.test('un-nest team', (done) => {
    const teamData = {
      name: 'Team Parent',
      description: 'This is a test team for paths',
      parentId: testTeam.id,
      organizationId: 'WONKA'
    }

    udaru.teams.create(teamData, (err, result) => {
      expect(err).to.not.exist()

      const teamId = result.id

      expect(result.path).to.equal(testTeam.id + '.' + teamId)

      udaru.teams.move({ id: teamId, parentId: null, organizationId: 'WONKA' }, (err, result) => {
        expect(err).to.not.exist()
        expect(result).to.exist()
        expect(result.path).to.equal(teamId.toString())

        udaru.teams.delete({ id: teamId, organizationId: 'WONKA' }, done)
      })
    })
  })

  lab.test('add policies from another org to team', (done) => {
    udaru.teams.addPolicies({ id: testTeam.id, policies: [{id: policies[2].id}], organizationId: 'WONKA' }, (err, team) => {
      expect(err).to.exist()
      expect(err.message).to.equal('Some policies [testPolicyId-1234] were not found')

      done()
    })
  })

  lab.test('add policies to team', (done) => {
    udaru.teams.addPolicies({ id: testTeam.id, policies: [{id: policies[0].id}, {id: policies[1].id}], organizationId: 'WONKA' }, (err, team) => {
      expect(err).to.not.exist()
      expect(team).to.exist()
      expect(team.policies).to.have.length(2)
      expect(u.PoliciesWithoutInstance(team.policies)).to.only.include([{
        id: policies[0].id,
        name: policies[0].name,
        version: policies[0].version,
        variables: {}
      }, {
        id: policies[1].id,
        name: policies[1].name,
        version: policies[1].version,
        variables: {}
      }])

      done()
    })
  })

  lab.test('add policies with variables to team', (done) => {
    const policiesParam = [{
      id: policies[0].id,
      variables: { var1: 'value1' }
    }, {
      id: policies[1].id,
      variables: { var2: 'value2' }
    }]

    udaru.teams.addPolicies({ id: testTeam.id, policies: policiesParam, organizationId: 'WONKA' }, (err, team) => {
      expect(err).to.not.exist()
      expect(team).to.exist()
      expect(team.policies).to.have.length(2)
      expect(u.PoliciesWithoutInstance(team.policies)).to.only.include([{
        id: policies[0].id,
        name: policies[0].name,
        version: policies[0].version,
        variables: { var1: 'value1' }
      }, {
        id: policies[1].id,
        name: policies[1].name,
        version: policies[1].version,
        variables: { var2: 'value2' }
      }])

      done()
    })
  })

  lab.test('add shared policies to team', (done) => {
    udaru.teams.addPolicies({ id: testTeam.id, policies: [{id: 'sharedPolicyId1'}], organizationId: 'WONKA' }, (err, team) => {
      expect(err).to.not.exist()
      expect(team).to.exist()
      expect(team.policies).to.have.length(1)
      expect(u.PoliciesWithoutInstance(team.policies)).to.only.include([{
        id: 'sharedPolicyId1',
        name: 'Shared policy from fixtures',
        version: '0.1',
        variables: {}
      }])

      done()
    })
  })

  lab.test('replace team policies', (done) => {
    udaru.teams.addPolicies({
      id: testTeam.id,
      organizationId: 'WONKA',
      policies: [{id: policies[0].id}]
    }, (err, team) => {
      expect(err).to.not.exist()
      expect(team).to.exist()

      udaru.teams.replacePolicies({ id: team.id, policies: [{id: policies[1].id}], organizationId: 'WONKA' }, (err, team) => {
        expect(err).to.not.exist()
        expect(team).to.exist()
        expect(team.policies).to.have.length(1)
        expect(u.PoliciesWithoutInstance(team.policies)).to.only.include([{
          id: policies[1].id,
          name: policies[1].name,
          version: policies[1].version,
          variables: {}
        }])
        done()
      })
    })
  })

  lab.test('replace team policies with variables', (done) => {
    udaru.teams.addPolicies({
      id: testTeam.id,
      organizationId: 'WONKA',
      policies: [{
        id: policies[0].id,
        variables: { var1: 'value1' }
      }]
    }, (err, team) => {
      expect(err).to.not.exist()
      expect(team).to.exist()

      const policiesParam = [{
        id: policies[1].id,
        variables: { var1: 'value2' }
      }]

      udaru.teams.replacePolicies({ id: team.id, policies: policiesParam, organizationId: 'WONKA' }, (err, team) => {
        expect(err).to.not.exist()
        expect(team).to.exist()
        expect(team.policies).to.have.length(1)
        expect(u.PoliciesWithoutInstance(team.policies)).to.only.include([{
          id: policies[1].id,
          name: policies[1].name,
          version: policies[1].version,
          variables: { var1: 'value2' }
        }])
        done()
      })
    })
  })

  lab.test('replace with shared policies', (done) => {
    udaru.teams.addPolicies({
      id: testTeam.id,
      organizationId: 'WONKA',
      policies: [{id: policies[0].id}]
    }, (err, team) => {
      expect(err).to.not.exist()
      expect(team).to.exist()

      udaru.teams.replacePolicies({ id: team.id, policies: [{id: 'sharedPolicyId1'}], organizationId: 'WONKA' }, (err, team) => {
        expect(err).to.not.exist()
        expect(team).to.exist()
        expect(team.policies).to.have.length(1)
        expect(u.PoliciesWithoutInstance(team.policies)).to.only.include([{
          id: 'sharedPolicyId1',
          name: 'Shared policy from fixtures',
          version: '0.1',
          variables: {}
        }])
        done()
      })
    })
  })

  lab.test('delete team policies', (done) => {
    udaru.teams.addPolicies({ id: testTeam.id, policies: [{id: policies[0].id}, {id: policies[1].id}], organizationId: 'WONKA' }, (err, team) => {
      expect(err).to.not.exist()
      expect(team).to.exist()
      expect(team.policies).to.have.length(2)

      udaru.teams.deletePolicies({ id: team.id, organizationId: 'WONKA' }, (err, team) => {
        expect(err).to.not.exist()
        expect(team).to.exist()
        expect(team.policies).to.equal([])
        done()
      })
    })
  })

  lab.test('delete specific team policy', (done) => {
    udaru.teams.addPolicies({ id: testTeam.id, policies: [{id: policies[0].id}, {id: policies[1].id}], organizationId: 'WONKA' }, (err, team) => {
      expect(err).to.not.exist()
      expect(team).to.exist()
      expect(team.policies).to.have.length(2)

      udaru.teams.deletePolicy({ teamId: team.id, policyId: policies[0].id, organizationId: 'WONKA' }, (err, team) => {
        expect(err).to.not.exist()
        expect(team).to.exist()
        expect(u.PoliciesWithoutInstance(team.policies)).to.equal([{
          id: policies[1].id,
          name: policies[1].name,
          version: policies[1].version,
          variables: {}
        }])

        done()
      })
    })
  })

  lab.test('add users from another org to a team', (done) => {
    udaru.users.create({ id: 'testUserRoot', name: 'test', organizationId: 'ROOT' }, (err, user) => {
      expect(err).to.not.exist()

      let userIds = [user.id]

      udaru.teams.addUsers({ id: testTeam.id, users: userIds, organizationId: 'WONKA' }, (err, team) => {
        expect(err).to.exist()
        expect(err.message).to.equal('Some users [testUserRoot] were not found')

        udaru.users.delete(user, done)
      })
    })
  })

  lab.test('add users to a team', (done) => {
    let userIds = [users[0].id]

    udaru.teams.addUsers({ id: testTeam.id, users: userIds, organizationId: 'WONKA' }, (err, team) => {
      expect(err).to.not.exist()
      expect(team).to.exist()
      expect(team.users).to.equal([
        {
          id: users[0].id,
          name: users[0].name
        }
      ])

      done()
    })
  })

  lab.test('replace users of a team', (done) => {
    let userIds = [users[0].id]

    udaru.teams.addUsers({ id: testTeam.id, users: userIds, organizationId: 'WONKA' }, (err, team) => {
      expect(err).to.not.exist()
      expect(team).to.exist()
      expect(team.users).to.equal([
        {
          id: users[0].id,
          name: users[0].name
        }
      ])

      userIds = [users[1].id]

      udaru.teams.replaceUsers({ id: team.id, users: userIds, organizationId: 'WONKA' }, (err, team) => {
        expect(err).to.not.exist()
        expect(team).to.exist()
        expect(team.users).to.equal([
          {
            id: users[1].id,
            name: users[1].name
          }
        ])
        done()
      })
    })
  })

  lab.test('delete users of a team', (done) => {
    let userIds = [users[0].id, users[1].id]

    udaru.teams.addUsers({ id: testTeam.id, users: userIds, organizationId: 'WONKA' }, (err, team) => {
      expect(err).to.not.exist()
      expect(team).to.exist()
      expect(team.users).to.equal([
        {
          id: users[0].id,
          name: users[0].name
        },
        {
          id: users[1].id,
          name: users[1].name
        }
      ])

      udaru.teams.deleteMembers({ id: team.id, organizationId: 'WONKA' }, (err, result) => {
        expect(err).to.not.exist()
        expect(result).to.not.exist()
        udaru.teams.read({ id: team.id, organizationId: 'WONKA' }, (err, team) => {
          expect(err).to.not.exist()
          expect(team).to.exist()
          expect(team.users).to.equal([])
          done()
        })
      })
    })
  })

  lab.test('delete a specific user of a team', (done) => {
    let userIds = [users[0].id, users[1].id]

    udaru.teams.addUsers({ id: testTeam.id, users: userIds, organizationId: 'WONKA' }, (err, team) => {
      expect(err).to.not.exist()
      expect(team).to.exist()
      expect(team.users).to.equal([
        {
          id: users[0].id,
          name: users[0].name
        },
        {
          id: users[1].id,
          name: users[1].name
        }
      ])

      udaru.teams.deleteMember({ id: team.id, userId: users[1].id, organizationId: 'WONKA' }, (err, result) => {
        expect(err).to.not.exist()
        expect(result).to.not.exist()

        udaru.teams.read({ id: team.id, organizationId: 'WONKA' }, (err, team) => {
          expect(err).to.not.exist()
          expect(team).to.exist()
          expect(team.users).to.equal([{
            id: users[0].id,
            name: users[0].name
          }])
          done()
        })
      })
    })
  })

  lab.experiment('multiple policy tests  - ', () => {
    lab.test('same policy instances without variables 409 conflict', (done) => {
      udaru.teams.addPolicies({ id: testTeam.id, policies: [{id: policies[0].id}, {id: policies[1].id}], organizationId: 'WONKA' }, (err, team) => {
        expect(err).to.not.exist()
        expect(team).to.exist()
        expect(team.policies).to.have.length(2)
        expect(u.PoliciesWithoutInstance(team.policies)).to.only.include([{
          id: policies[0].id,
          name: policies[0].name,
          version: policies[0].version,
          variables: {}
        }, {
          id: policies[1].id,
          name: policies[1].name,
          version: policies[1].version,
          variables: {}
        }])

        udaru.teams.addPolicies({ id: team.id, policies: [{id: policies[1].id}], organizationId: 'WONKA' }, (err, team) => {
          expect(err).to.exist()
          expect(err.output.statusCode).to.equal(409)
          done()
        })
      })
    })

    lab.test('same policy instances with different variables add twice', (done) => {
      const policiesParam = [{
        id: policies[0].id,
        variables: { var1: 'value1' }
      }, {
        id: policies[1].id,
        variables: { var2: 'value2' }
      }]

      udaru.teams.addPolicies({ id: testTeam.id, policies: policiesParam, organizationId: 'WONKA' }, (err, team) => {
        expect(err).to.not.exist()
        expect(team).to.exist()
        expect(team.policies).to.have.length(2)
        expect(u.PoliciesWithoutInstance(team.policies)).to.only.include([{
          id: policies[0].id,
          name: policies[0].name,
          version: policies[0].version,
          variables: { var1: 'value1' }
        }, {
          id: policies[1].id,
          name: policies[1].name,
          version: policies[1].version,
          variables: { var2: 'value2' }
        }])

        const policiesParam = [{
          id: policies[1].id,
          variables: { var2: 'value3' }
        }]

        udaru.teams.addPolicies({ id: team.id, policies: policiesParam, organizationId: 'WONKA' }, (err, team) => {
          expect(err).to.not.exist()
          expect(team).to.exist()
          expect(team.policies).to.have.length(3)
          expect(u.PoliciesWithoutInstance(team.policies)).to.only.include([{
            id: policies[0].id,
            name: policies[0].name,
            version: policies[0].version,
            variables: { var1: 'value1' }
          }, {
            id: policies[1].id,
            name: policies[1].name,
            version: policies[1].version,
            variables: { var2: 'value2' }
          }, {
            id: policies[1].id,
            name: policies[1].name,
            version: policies[1].version,
            variables: { var2: 'value3' }
          }])
          done()
        })
      })
    })

    lab.test('test policy instance addition and removal from teams', (done) => {
      const policiesParam = [{
        id: policies[0].id,
        variables: { var1: 'value1' }
      }]

      udaru.teams.addPolicies({ id: testTeam.id, policies: policiesParam, organizationId: 'WONKA' }, (err, team) => {
        expect(err).to.not.exist()
        expect(team).to.exist()
        expect(team.policies).to.have.length(1)
        expect(u.PoliciesWithoutInstance(team.policies)).to.only.include([{
          id: policies[0].id,
          name: policies[0].name,
          version: policies[0].version,
          variables: { var1: 'value1' }
        }])

        const firstInstance = team.policies[0].instance

        // now add two more

        const policiesParam = [{
          id: policies[0].id,
          variables: { var2: 'value2' }
        }, {
          id: policies[0].id,
          variables: {}
        }]

        udaru.teams.addPolicies({ id: team.id, policies: policiesParam, organizationId: 'WONKA' }, (err, team) => {
          expect(err).to.not.exist()
          expect(team).to.exist()
          expect(team.policies).to.have.length(3)
          expect(u.PoliciesWithoutInstance(team.policies)).to.only.include([{
            id: policies[0].id,
            name: policies[0].name,
            version: policies[0].version,
            variables: { var1: 'value1' }
          }, {
            id: policies[0].id,
            name: policies[0].name,
            version: policies[0].version,
            variables: {}
          }, {
            id: policies[0].id,
            name: policies[0].name,
            version: policies[0].version,
            variables: { var2: 'value2' }
          }])
          udaru.teams.deletePolicy({ teamId: team.id,
            policyId: policies[0].id,
            instance: firstInstance,
            organizationId: 'WONKA'
          }, (err, team) => {
            expect(err).to.not.exist()
            expect(team).to.exist()
            expect(team.policies).to.have.length(2)
            expect(u.PoliciesWithoutInstance(team.policies)).to.only.include([{
              id: policies[0].id,
              name: policies[0].name,
              version: policies[0].version,
              variables: {}
            }, {
              id: policies[0].id,
              name: policies[0].name,
              version: policies[0].version,
              variables: { var2: 'value2' }
            }])

            udaru.teams.deletePolicy({ teamId: team.id,
              policyId: policies[0].id,
              organizationId: 'WONKA'
            }, (err, team) => {
              expect(err).to.not.exist()
              expect(team).to.exist()
              expect(team.policies).to.have.length(0)
              done()
            })
          })
        })
      })
    })

    lab.test('amend policies', (done) => {
      const policiesParam = [{
        id: policies[0].id,
        variables: { var1: 'value1' }
      }, {
        id: policies[0].id,
        variables: { var2: 'value2' }
      }]

      udaru.teams.addPolicies({ id: testTeam.id, policies: policiesParam, organizationId: 'WONKA' }, (err, team) => {
        expect(err).to.not.exist()
        expect(team).to.exist()
        expect(team.policies).to.have.length(2)
        expect(u.PoliciesWithoutInstance(team.policies)).to.only.include([{
          id: policies[0].id,
          name: policies[0].name,
          version: policies[0].version,
          variables: { var1: 'value1' }
        }, {
          id: policies[0].id,
          name: policies[0].name,
          version: policies[0].version,
          variables: { var2: 'value2' }
        }])

        const instance1 = team.policies[0].instance
        const instance2 = team.policies[1].instance
        const policiesParam = [{
          id: policies[0].id,
          instance: instance1,
          variables: { var1: 'valuex' }
        }, {
          id: policies[0].id,
          instance: instance2,
          variables: { var2: 'valuey' }
        }]

        udaru.teams.amendPolicies({ id: team.id, policies: policiesParam, organizationId: 'WONKA' }, (err, team) => {
          expect(err).to.not.exist()
          expect(team).to.exist()
          expect(team.policies).to.have.length(2)
          expect(team.policies).to.only.include([{
            id: policies[0].id,
            name: policies[0].name,
            version: policies[0].version,
            variables: { var1: 'valuex' },
            instance: instance1
          }, {
            id: policies[0].id,
            name: policies[0].name,
            version: policies[0].version,
            variables: { var2: 'valuey' },
            instance: instance2
          }])
          done()
        })
      })
    })

    lab.test('amend policies 409 conflict', (done) => {
      const policiesParam = [{
        id: policies[0].id,
        variables: { var1: 'value1' }
      }, {
        id: policies[0].id,
        variables: { var2: 'value2' }
      }]

      udaru.teams.addPolicies({ id: testTeam.id, policies: policiesParam, organizationId: 'WONKA' }, (err, team) => {
        expect(err).to.not.exist()
        expect(team).to.exist()
        expect(team.policies).to.have.length(2)
        expect(u.PoliciesWithoutInstance(team.policies)).to.only.include([{
          id: policies[0].id,
          name: policies[0].name,
          version: policies[0].version,
          variables: { var1: 'value1' }
        }, {
          id: policies[0].id,
          name: policies[0].name,
          version: policies[0].version,
          variables: { var2: 'value2' }
        }])

        const instance1 = team.policies[0].instance
        const instance2 = team.policies[1].instance
        const policiesParam = [{
          id: policies[0].id,
          instance: instance1,
          variables: { var1: 'value1' }
        }, {
          id: policies[0].id,
          instance: instance2,
          variables: { var1: 'value1' }
        }]

        udaru.teams.amendPolicies({ id: team.id, policies: policiesParam, organizationId: 'WONKA' }, (err, team) => {
          expect(err).to.exist()
          expect(err.output.statusCode).to.equal(409)
          done()
        })
      })
    })

    lab.test('get policies list from team,', (done) => {
      const policiesParam = [{
        id: policies[0].id,
        variables: { var1: 'value1' }
      }, {
        id: policies[0].id,
        variables: { var2: 'value2' }
      }, {
        id: policies[0].id,
        variables: {}
      }]

      udaru.teams.addPolicies({ id: testTeam.id, policies: policiesParam, organizationId: 'WONKA' }, (err, team) => {
        expect(err).to.not.exist()
        expect(team).to.exist()
        expect(team.policies).to.have.length(3)

        udaru.teams.listPolicies({ id: team.id, organizationId: 'WONKA' }, (err, list) => {
          expect(err).to.not.exist()
          expect(list.data).to.exist()
          expect(list.data.length).to.equal(3)
          expect(u.PoliciesWithoutInstance(list.data)).to.only.include([{
            id: policies[0].id,
            name: policies[0].name,
            version: policies[0].version,
            variables: { var1: 'value1' }
          }, {
            id: policies[0].id,
            name: policies[0].name,
            version: policies[0].version,
            variables: {}
          }, {
            id: policies[0].id,
            name: policies[0].name,
            version: policies[0].version,
            variables: { var2: 'value2' }
          }])

          // again with pagination params
          udaru.teams.listPolicies({ id: team.id, organizationId: 'WONKA', limit: 100, page: 1 }, (err, list) => {
            expect(err).to.not.exist()
            expect(list.data).to.exist()
            expect(list.data.length).to.equal(3)
            expect(u.PoliciesWithoutInstance(list.data)).to.only.include([{
              id: policies[0].id,
              name: policies[0].name,
              version: policies[0].version,
              variables: { var1: 'value1' }
            }, {
              id: policies[0].id,
              name: policies[0].name,
              version: policies[0].version,
              variables: {}
            }, {
              id: policies[0].id,
              name: policies[0].name,
              version: policies[0].version,
              variables: { var2: 'value2' }
            }])

            udaru.teams.deletePolicy({ teamId: team.id,
              policyId: policies[0].id,
              organizationId: 'WONKA'
            }, (err, team) => {
              expect(err).to.not.exist()
              expect(team).to.exist()
              expect(team.policies).to.have.length(0)
              done()
            })
          })
        })
      })
    })

    lab.test('get policies list from non existant team', (done) => {
      udaru.teams.listPolicies({ id: 'doesntexist', organizationId: 'WONKA' }, (err, list) => {
        expect(err).to.not.exist()
        expect(list.data).to.exist()
        expect(list.data).to.have.length(0)
        done()
      })
    })

    lab.test('with same variables 409 conflict', (done) => {
      const policiesParam = [{
        id: policies[0].id,
        variables: { var1: 'value1' }
      }, {
        id: policies[1].id,
        variables: { var2: 'value2' }
      }]

      udaru.teams.addPolicies({ id: testTeam.id, policies: policiesParam, organizationId: 'WONKA' }, (err, team) => {
        expect(err).to.not.exist()
        expect(team).to.exist()
        expect(team.policies).to.have.length(2)
        expect(u.PoliciesWithoutInstance(team.policies)).to.only.include([{
          id: policies[0].id,
          name: policies[0].name,
          version: policies[0].version,
          variables: { var1: 'value1' }
        }, {
          id: policies[1].id,
          name: policies[1].name,
          version: policies[1].version,
          variables: { var2: 'value2' }
        }])

        const policiesParam = [{
          id: policies[1].id,
          variables: { var2: 'value2' }
        }]

        udaru.teams.addPolicies({ id: team.id, policies: policiesParam, organizationId: 'WONKA' }, (err, team) => {
          expect(err).to.exist()
          expect(err.output.statusCode).to.equal(409)
          done()
        })
      })
    })
  })

  lab.test('with system context variable overload fail', (done) => {
    let policiesParam = [{
      id: policies[0].id,
      variables: { udaru: 'userId' }
    }]

    udaru.teams.addPolicies({ id: testTeam.id, policies: policiesParam, organizationId: 'WONKA' }, (err) => {
      expect(err).to.exist()
      expect(err.message).include('"udaru" is not allowed')

      policiesParam = [{
        id: policies[0].id,
        variables: { request: 'time' }
      }]
      udaru.teams.addPolicies({ id: testTeam.id, policies: policiesParam, organizationId: 'WONKA' }, (err) => {
        expect(err).to.exist()
        expect(err.message).include('"request" is not allowed')
        done()
      })
    })
  })

  lab.experiment('nested teams', () => {
    lab.test('list an existing nested team', (done) => {
      udaru.teams.listNestedTeams({ organizationId: 'WONKA', id: '4' }, (err, result, total) => {
        expect(err).to.not.exist()
        expect(result).to.exist()
        expect(total).to.exist()
        expect(total).to.equal(1)

        expect(_.map(result, 'name')).contains(['Personnel Managers'])
        done()
      })
    })

    lab.test('list an existing nested team with paging', (done) => {
      udaru.teams.listNestedTeams({ organizationId: 'WONKA', id: '4', page: 1, limit: 1 }, (err, result, total) => {
        expect(err).to.not.exist()
        expect(result).to.exist()
        expect(total).to.exist()
        expect(total).to.equal(1)

        expect(_.map(result, 'name')).contains(['Personnel Managers'])
        done()
      })
    })

    lab.test('nested team with bad page param', (done) => {
      udaru.teams.listNestedTeams({ organizationId: 'WONKA', id: '4', page: 0, limit: 1 }, (err, result, total) => {
        expect(err).to.exist()

        done()
      })
    })

    lab.test('nested team with bad limit param', (done) => {
      udaru.teams.listNestedTeams({ organizationId: 'WONKA', id: '4', page: 1, limit: 0 }, (err, result, total) => {
        expect(err).to.exist()

        done()
      })
    })

    lab.test('nested team not found', (done) => {
      udaru.teams.listNestedTeams({ organizationId: 'WONKA', id: 'IDONTEXIST' }, (err, result, total) => {
        expect(err).to.not.exist()
        expect(result).to.exist()
        expect(total).to.exist()
        expect(total).to.equal(0)
        expect(result.length).to.equal(0)

        done()
      })
    })

    lab.test('nested team with bad organization', (done) => {
      udaru.teams.listNestedTeams({ organizationId: 'IDONTEXIST', id: '4' }, (err, result, total) => {
        expect(err).to.not.exist()
        expect(result).to.exist()
        expect(total).to.exist()
        expect(total).to.equal(0)
        expect(result.length).to.equal(0)

        done()
      })
    })

    lab.test('nested team with bad team id', (done) => {
      udaru.teams.listNestedTeams({ organizationId: 'WONKA', id: 4 }, (err, result, total) => {
        expect(err).to.exist()

        done()
      })
    })

    lab.test('nested team sql injection org_id sanity check', (done) => {
      udaru.teams.listNestedTeams({ organizationId: 'WONKA||org_id<>-1', id: '4' }, (err, result, total) => {
        expect(err).to.exist()

        done()
      })
    })

    lab.test('Search sql injection query sanity check', (done) => {
      udaru.teams.listNestedTeams({ id: '4\'); drop database authorization;', organizationId: 'WONKA' }, (err, result, total) => {
        expect(err).to.exist()

        done()
      })
    })
  })
  lab.test('Search for Authors', (done) => {
    udaru.teams.search({ query: 'Authors', organizationId: 'WONKA' }, (err, data, total) => {
      expect(err).to.not.exist()
      expect(total).to.exist()
      expect(total).to.equal(3)
      expect(data.length).to.equal(3)

      done()
    })
  })

  lab.test('Wildcard search for Authors', (done) => {
    udaru.teams.search({ query: 'Auth', organizationId: 'WONKA' }, (err, data, total) => {
      expect(err).to.not.exist()
      expect(total).to.exist()
      expect(total).to.equal(3)
      expect(data.length).to.equal(3)

      done()
    })
  })

  lab.test('Search for common words phrase', (done) => {
    udaru.teams.search({ query: 'Managers', organizationId: 'WONKA' }, (err, data, total) => {
      expect(err).to.not.exist()
      expect(total).to.exist()
      expect(total).to.equal(2)
      expect(data.length).to.equal(2)
    })

    done()
  })

  lab.test('Search for multiple words phrase', (done) => {
    udaru.teams.search({ query: 'Personnel Managers', organizationId: 'WONKA' }, (err, data, total) => {
      expect(err).to.not.exist()
      expect(total).to.exist()
      expect(total).to.equal(1)
      expect(data.length).to.equal(1)
    })

    done()
  })

  lab.test('Search with empty query', (done) => {
    udaru.teams.search({ query: '', organizationId: 'WONKA' }, (err, data, total) => {
      expect(err).to.exist()

      done()
    })
  })

  lab.test('Search with no match', (done) => {
    udaru.teams.search({ query: 'idontexist', organizationId: 'WONKA' }, (err, data, total) => {
      expect(err).to.not.exist()
      expect(total).to.exist()
      expect(total).to.equal(0)
      expect(data.length).to.equal(0)

      done()
    })
  })

  lab.test('Search with bad org id', (done) => {
    udaru.teams.search({ query: 'Auth', organizationId: 'IDONTEXIST' }, (err, data, total) => {
      expect(err).to.not.exist()
      expect(total).to.exist()
      expect(total).to.equal(0)
      expect(data.length).to.equal(0)

      done()
    })
  })

  lab.test('Search expect error with bad params', (done) => {
    udaru.teams.search({ querty: 'Bad query param', orId: 'Bad organizationId param' }, (err, data, total) => {
      expect(err).to.exist()

      done()
    })
  })

  lab.test('Search sql injection org_id sanity check', (done) => {
    udaru.teams.search({ query: 'Authors', organizationId: 'WONKA||org_id<>-1' }, (err, data, total) => {
      expect(err).to.exist()

      done()
    })
  })

  lab.test('Search sql injection query sanity check', (done) => {
    udaru.teams.search({ query: 'Authors\'); drop database authorization;', organizationId: 'WONKA' }, (err, data, total) => {
      expect(err).to.exist()

      done()
    })
  })

  lab.experiment('Team: search for users', () => {
    lab.test('Search for Wonka', (done) => {
      udaru.teams.searchUsers({ id: '4', query: 'wonka', organizationId: 'WONKA' }, (err, data, total) => {
        expect(err).to.not.exist()
        expect(total).to.exist()
        expect(data).to.exist()
        expect(total).to.equal(1)
        expect(data.length).to.equal(1)

        done()
      })
    })

    lab.test('Wildcard search for Willy Wonka', (done) => {
      udaru.teams.searchUsers({ id: '4', query: 'will', organizationId: 'WONKA' }, (err, data, total) => {
        expect(err).to.not.exist()
        expect(total).to.exist()
        expect(data).to.exist()
        expect(total).to.equal(1)
        expect(data.length).to.equal(1)

        done()
      })
    })

    lab.test('Search for common phrase', (done) => {
      udaru.teams.searchUsers({ id: '2', query: 'id', organizationId: 'WONKA' }, (err, data, total) => {
        expect(err).to.not.exist()
        expect(total).to.exist()
        expect(data).to.exist()
        expect(total).to.equal(2)
        expect(data.length).to.equal(2)

        done()
      })
    })

    lab.test('Search with empty query', (done) => {
      udaru.teams.searchUsers({ id: '1', query: '', organizationId: 'WONKA' }, (err, data, total) => {
        expect(err).to.exist()
        expect(err.name).to.exist()
        expect(err.message).include('not allowed to be empty')

        done()
      })
    })

    lab.test('Search with no match', (done) => {
      udaru.teams.searchUsers({ id: '1', query: 'idontexist', organizationId: 'WONKA' }, (err, data, total) => {
        expect(err).to.not.exist()
        expect(total).to.exist()
        expect(data).to.exist()

        expect(total).to.equal(0)
        expect(data.length).to.equal(0)

        done()
      })
    })

    lab.test('Search with bad org id', (done) => {
      udaru.teams.searchUsers({
        id: '1',
        query: 'Auth',
        organizationId: 'IDONTEXIST'
      }, (err, data, total) => {
        expect(err).to.not.exist()
        expect(total).to.exist()
        expect(data).to.exist()

        expect(total).to.equal(0)
        expect(data.length).to.equal(0)

        done()
      })
    })

    lab.test('Search expect error with bad params', (done) => {
      udaru.teams.searchUsers({
        ib: '1',
        querty: 'Bad query param',
        orId: 'Bad organizationId param'
      }, (err, data, total) => {
        expect(err).to.exist()

        done()
      })
    })

    lab.test('Search expect error with missing id', (done) => {
      udaru.teams.searchUsers({
        querty: 'Bad query param',
        orgId: 'Bad organizationId param'
      }, (err, data, total) => {
        expect(err).to.exist()

        done()
      })
    })

    lab.test('Search sql injection org_id sanity check', (done) => {
      udaru.teams.searchUsers({
        id: '1',
        query: 'wonka',
        organizationId: 'WONKA||org_id<>-1'
      }, (err, data, total) => {
        expect(err).to.exist()
        done()
      })
    })

    lab.test('Search sql injection query sanity check', (done) => {
      udaru.teams.searchUsers({
        id: '1',
        query: 'Wonka\'); drop database authorization;',
        organizationId: 'WONKA'
      }, (err, data, total) => {
        expect(err).to.exist()

        done()
      })
    })

    lab.test('Search sql injection id sanity check', (done) => {
      udaru.teams.searchUsers({
        id: '1\'); drop database authorization;',
        query: 'Willy Wonka',
        organizationId: 'WONKA'
      }, (err, data, total) => {
        expect(err).to.exist()

        done()
      })
    })
  })
})
