'use strict'

const expect = require('code').expect
const Lab = require('lab')
const lab = exports.lab = Lab.script()
const Boom = require('boom')
var proxyquire = require('proxyquire')
var utils = require('./../../utils')

var userOps = {}
var usersRoutes = proxyquire('./../../../routes/public/users', { './../../lib/ops/userOps': userOps })
var server = proxyquire('./../../../wiring-hapi', { './routes/public/users': usersRoutes })

lab.experiment('Users', () => {

  lab.test('get user list should return error for error case', (done) => {
    userOps.listOrgUsers = function (params, cb) {
      expect(params).to.equal({ organizationId: 'WONKA' })
      process.nextTick(() => {
        cb(Boom.badImplementation())
      })
    }

    const options = utils.requestOptions({
      method: 'GET',
      url: '/authorization/users'
    })

    server.inject(options, (response) => {
      const result = response.result

      expect(response.statusCode).to.equal(500)
      expect(result).to.be.undefined

      done()
    })
  })

  lab.test('get single user should return error for error case', (done) => {
    userOps.getIdFromToken = function (token, cb) {
      expect(token).to.equal('AugustusToken')
      process.nextTick(() => {
        cb(null, 12)
      })
    }

    userOps.readUser = function (params, cb) {
      expect(params).to.equal({ id: 12, organizationId: 'WONKA' })
      process.nextTick(() => {
        cb(Boom.badImplementation())
      })
    }

    const options = utils.requestOptions({
      method: 'GET',
      url: '/authorization/users/AugustusToken'
    })

    server.inject(options, (response) => {
      const result = response.result

      expect(response.statusCode).to.equal(500)
      expect(result).to.be.undefined

      done()
    })
  })

  lab.test('create user should return error for error case', (done) => {
    userOps.createUser = function (params, cb) {
      process.nextTick(() => {
        cb(Boom.badImplementation())
      })
    }

    const options = utils.requestOptions({
      method: 'POST',
      url: '/authorization/users',
      payload: {
        name: 'Salman',
        token: 'U2FsbWFu'
      }
    })

    server.inject(options, (response) => {
      const result = response.result

      expect(response.statusCode).to.equal(500)
      expect(result).to.be.undefined

      done()
    })
  })

  lab.test('delete user should return error for error case', (done) => {
    userOps.deleteUser = function (params, cb) {
      expect(params).to.equal({ token: '1', organizationId: 'WONKA' })
      process.nextTick(() => {
        cb(Boom.badImplementation())
      })
    }

    const options = utils.requestOptions({
      method: 'DELETE',
      url: '/authorization/users/1'
    })

    server.inject(options, (response) => {
      const result = response.result

      expect(response.statusCode).to.equal(500)
      expect(result).to.be.undefined

      done()
    })
  })

  lab.test('update user should return error for error case', (done) => {
    userOps.updateUser = function (params, cb) {
      expect(params.token).to.equal('U2FsbWFu')
      expect(params.name).to.equal('Joe')
      expect(params.organizationId).to.equal('WONKA')
      expect(params.teams).to.equal([])

      process.nextTick(() => {
        cb(Boom.badImplementation())
      })
    }

    const options = utils.requestOptions({
      method: 'PUT',
      url: '/authorization/users/U2FsbWFu',
      payload: {
        name: 'Joe',
        teams: []
      }
    })

    server.inject(options, (response) => {
      const result = response.result

      expect(response.statusCode).to.equal(500)
      expect(result).to.be.undefined

      done()
    })
  })
})
