'use strict'
/* eslint-disable handle-callback-err */
const Boom = require('boom')
const iam = require('iam-js')
const policyOps = require('./policyOps')

module.exports = {
  /**
   * Return if a user can perform an action on a certain resource
   *
   * @param  {Object}   options { resource, action, userId,  }
   * @param  {Function} cb
   */
  isUserAuthorized: function isUserAuthorized ({ resource, action, userId, organizationId }, cb) {
    policyOps.listAllUserPolicies({ userId, organizationId }, (err, policies) => {
      if (err) {
        return cb(err)
      }

      iam(policies, ({ process }) => {
        process(resource, action, (err, access) => {
          if (err) {
            return cb(err)
          }

          cb(null, { access })
        })
      })
    })
  },

  //
  // TODO: Note: this needs to take 'Deny' into account and also deal with wildcards.
  // as would be worth looking into the pbac module code for reuse opportunity
  //
  // build the set of actions in the user's policy set
  // can't check per resource as requires wildcard processing
  /**
   * List all user's actions on a given resource
   *
   * @param  {Object}   options { userId, resource }
   * @param  {Function} cb
   */
  listAuthorizations: function listAuthorizations ({ userId, resource, organizationId }, cb) {
    const data = []
    var actions = []
    var errors = []

    policyOps.listAllUserPolicies({ userId, organizationId }, (err, policies) => {
      if (err) return cb(Boom.wrap(err))

      policies.forEach(p => {
        p.Statement.forEach(s => {
          if (s.Effect === 'Deny') {
            return
          }

          s.Action.forEach(a => {
            actions.push(a)
          })
        })
      })

      actions = Array.from(new Set(actions)) // dedupe
      // check each action aginst the resource for this user
      iam(policies, ({ process }) => {
        actions.forEach(action => {
          process(resource, action, (err, access) => {
            if (err) return errors.push(err)
            if (access) {
              data.push(action)
            }
          })
        })
      })

      if (errors.length > 0) return cb(Boom.wrap(errors.shift()))
      // return thE allowable actions
      cb(null, { actions: data })
    })
  }
}
