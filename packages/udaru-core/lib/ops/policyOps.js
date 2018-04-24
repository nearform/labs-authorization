'use strict'

const Boom = require('boom')
const Joi = require('joi')
const async = require('async')
const SQL = require('@nearform/sql')
const asyncify = require('../asyncify')
const mapping = require('../mapping')
const utils = require('./utils')
const uuidV4 = require('uuid/v4')
const validationRules = require('./validation').policies
const _ = require('lodash')

function toArrayWithId (policies) {
  if (Array.isArray(policies)) {
    return policies.map((p) => {
      p.id = p.id || uuidV4()

      return p
    })
  }

  return Object.keys(policies).map((pName) => {
    let p = policies[pName]
    p.id = p.id || uuidV4()

    return p
  })
}

function buildPolicyOps (db, config) {
  function insertPolicies (client, policies, cb) {
    policies = toArrayWithId(policies)

    const sql = SQL`INSERT INTO policies (id, version, name, org_id, statements) VALUES `
    sql.append(SQL`(${policies[0].id}, ${policies[0].version}, ${policies[0].name}, ${policies[0].org_id}, ${policies[0].statements})`)
    policies.slice(1).forEach((policy) => {
      sql.append(SQL`, (${policy.id}, ${policy.version}, ${policy.name}, ${policy.org_id}, ${policy.statements})`)
    })
    sql.append(SQL` RETURNING id`)

    client.query(sql, utils.boomErrorWrapper(cb))
  }

  function insertSharedPolicies (client, policies, cb) {
    policies = toArrayWithId(policies)

    const sql = SQL`INSERT INTO policies (id, version, name, statements) VALUES `
    sql.append(SQL`(${policies[0].id}, ${policies[0].version}, ${policies[0].name}, ${policies[0].statements})`)
    policies.slice(1).forEach((policy) => {
      sql.append(SQL`, (${policy.id}, ${policy.version}, ${policy.name}, ${policy.statements})`)
    })
    sql.append(SQL` RETURNING id`)

    client.query(sql, utils.boomErrorWrapper(cb))
  }

  function deletePolicies (client, ids, orgId, cb) {
    client.query(SQL`DELETE FROM policies WHERE id = ANY (${ids}) AND org_id=${orgId}`, utils.boomErrorWrapper(cb))
  }

  function deleteTeamAssociations (client, ids, orgId, cb) {
    client.query(SQL`
                 DELETE FROM team_policies AS p
                 USING teams AS t
                 WHERE t.id = p.team_id
                   AND p.policy_id = ANY (${ids})`,
    utils.boomErrorWrapper(cb))
  }

  function deleteUserAssociations (client, ids, orgId, cb) {
    client.query(SQL`
                 DELETE FROM user_policies AS p
                 USING users AS u
                 WHERE u.id = p.user_id
                   AND p.policy_id = ANY (${ids})`,
    utils.boomErrorWrapper(cb))
  }

  function deleteOrganizationAssociations (client, ids, orgId, cb) {
    client.query(SQL`
                 DELETE FROM organization_policies AS p
                 USING organizations AS o
                 WHERE o.id = p.org_id
                   AND p.policy_id = ANY (${ids})`,
    utils.boomErrorWrapper(cb))
  }

  function getNames (policies) {
    return Object.keys(policies).map((key) => {
      return policies[key].name
    })
  }

  function removePolicyFromUsers (job, next) {
    const { id, organizationId } = job
    deleteUserAssociations(job.client, [id], organizationId, next)
  }

  function removePolicyFromTeams (job, next) {
    const { id, organizationId } = job
    deleteTeamAssociations(job.client, [id], organizationId, next)
  }

  function removePolicyFromOrganizations (job, next) {
    const { id, organizationId } = job
    deleteOrganizationAssociations(job.client, [id], organizationId, next)
  }

  function removePolicy (job, next) {
    const { id, organizationId } = job

    const sqlQuery = SQL`
      DELETE FROM policies
      WHERE id = ${id}
      AND org_id = ${organizationId}
    `
    job.client.query(sqlQuery, (err, res) => {
      if (err) return next(Boom.badImplementation(err))
      if (res.rowCount === 0) return next(Boom.notFound(`Policy ${id} not found`))

      next()
    })
  }

  function removeSharedPolicy (job, next) {
    const id = job.id

    const sqlQuery = SQL`
      DELETE FROM policies
      WHERE id = ${id}
      AND org_id IS NULL
    `
    job.client.query(sqlQuery, (err, res) => {
      if (err) return next(Boom.badImplementation(err))
      if (res.rowCount === 0) return next(Boom.notFound(`Policy ${id} not found`))

      next()
    })
  }

  const policyOps = {
    /**
     * List all the policies referencing a specific organization (not necessarily attached to it)
     *
     * @param  {Object}   params { organizationId, limit, page }
     * @param  {Function} cb
     */
    listByOrganization: function listByOrganization (params, cb) {
      let promise = null
      if (typeof cb !== 'function') [promise, cb] = asyncify('data', 'total')

      const { organizationId, limit, page } = params

      Joi.validate({ organizationId, page, limit }, validationRules.listByOrganization, function (err) {
        if (err) return cb(Boom.badRequest(err))

        const sqlQuery = SQL`
          WITH total AS (
            SELECT COUNT(*) AS cnt FROM policies
            WHERE org_id = ${organizationId}
          )
          SELECT
            p.id,
            p.version,
            p.name,
            p.statements,
            t.cnt::INTEGER AS total
          FROM policies AS p
          INNER JOIN total AS t ON 1=1
          WHERE p.org_id = ${organizationId}
          ORDER BY UPPER(p.name)
        `
        if (limit) {
          sqlQuery.append(SQL` LIMIT ${limit}`)
        }
        if (limit && page) {
          const offset = (page - 1) * limit
          sqlQuery.append(SQL` OFFSET ${offset}`)
        }
        db.query(sqlQuery, function (err, result) {
          if (err) return cb(Boom.badImplementation(err))
          let total = result.rows.length > 0 ? result.rows[0].total : 0
          return cb(null, result.rows.map(mapping.policy), total)
        })
      })

      return promise
    },

    /**
     * fetch specific policy
     *
     * @param  {Object}   params { id, organizationId }
     * @param  {Function} cb
     */
    readPolicy: function readPolicy ({ id, organizationId }, cb) {
      let promise = null
      if (typeof cb !== 'function') [promise, cb] = asyncify()

      Joi.validate({ id, organizationId }, validationRules.readPolicy, function (err) {
        if (err) return cb(Boom.badRequest(err))

        const sqlQuery = SQL`
          SELECT  *
          FROM policies
          WHERE id = ${id}
          AND org_id = ${organizationId}
        `
        db.query(sqlQuery, function (err, result) {
          if (err) return cb(Boom.badImplementation(err))
          if (result.rowCount === 0) return cb(Boom.notFound())

          return cb(null, mapping.policy(result.rows[0]))
        })
      })

      return promise
    },

    /**
     * fetch specific policy variables
     *
     * @param  {Object}   params { id, organizationId, type } "type" is optional, defaults to organization policies
     * @param  {Function} cb
     */
    readPolicyVariables: function readPolicyVariables ({ id, organizationId, type }, cb) {
      let promise = null
      if (typeof cb !== 'function') [promise, cb] = asyncify()

      Joi.validate({ id, organizationId, type }, validationRules.readPolicyVariables, function (err) {
        if (err) return cb(Boom.badRequest(err))

        const sqlQuery = SQL`
          SELECT  *
          FROM policies
          WHERE id = ${id}
        `

        if (type === 'shared') {
          sqlQuery.append(SQL` AND org_id is NULL`)
        } else {
          sqlQuery.append(SQL` AND org_id=${organizationId}`)
        }

        db.query(sqlQuery, function (err, result) {
          if (err) return cb(Boom.badImplementation(err))
          if (result.rowCount === 0) return cb(Boom.notFound())

          let variables = []

          _.each(result.rows[0].statements.Statement, function (statement) {
            if (statement.Resource) {
              _.map(statement.Resource, function (resource) {
                // ignore context vars but list all others, should match validation.js
                let variableMatches = resource.match(/\${((?!(udaru)|(request)).*)(.+?)}/g)
                _.each(variableMatches, function (variable) {
                  variables.push(variable)
                })
              })
            }
          })

          return cb(null, variables)
        })
      })

      return promise
    },

    /**
     * list policy instances in their respective entities
     *
     * @param  {Object}   params { id, organizationId, type } "type" is optional, defaults to organization policies
     * @param  {Function} cb
     */
    listPolicyInstances: function listPolicyInstances ({ id, organizationId, type }, cb) {
      let promise = null
      if (typeof cb !== 'function') [promise, cb] = asyncify()

      Joi.validate({ id, organizationId, type }, validationRules.listPolicyInstances, function (err) {
        if (err) return cb(Boom.badRequest(err))

        const sqlQuery = SQL`          
          SELECT entity_type, entity_id, policy_instance, variables, policy_id FROM
          (SELECT 'user' as entity_type, user_id as entity_id, variables, policy_instance, policy_id
          FROM user_policies
          WHERE policy_id = ${id}
          UNION
          SELECT 'team' as entity_type, team_id as entity_id, variables, policy_instance, policy_id
          FROM team_policies
          WHERE policy_id = ${id}
          UNION
          SELECT 'organization' as entity_type, org_id as entity_id, variables, policy_instance, policy_id
          FROM organization_policies
          WHERE policy_id = ${id}) as policy_instances
          INNER JOIN policies 
          ON policies.id = policy_instances.policy_id
        `

        if (type === 'shared') {
          sqlQuery.append(SQL` WHERE org_id is NULL`)
        } else {
          sqlQuery.append(SQL` WHERE org_id=${organizationId}`)
        }
        sqlQuery.append(SQL` ORDER BY entity_type, policy_instance`)

        db.query(sqlQuery, function (err, result) {
          if (err) return cb(Boom.badImplementation(err))
          if (result.rowCount === 0) return cb(null, [])
          return cb(null, result.rows.map(mapping.policy.instances))
        })
      })
      return promise
    },

    /**
     * Creates a new policy
     *
     * @param  {Object}   params { id, version, name, organizationId, statements }
     * @param  {Function} cb
     */
    createPolicy: function createPolicy (params, cb) {
      let promise = null
      if (typeof cb !== 'function') [promise, cb] = asyncify()

      const { id, version, name, organizationId, statements } = params

      Joi.validate({ id, version, name, organizationId, statements }, validationRules.createPolicy, function (err) {
        if (err) return cb(Boom.badRequest(err))
        insertPolicies(db, [{
          id: id,
          version: version,
          name: name,
          org_id: organizationId,
          statements: statements
        }], (err, result) => {
          if (utils.isUniqueViolationError(err)) return cb(Boom.conflict('policy already exists'))
          if (err) return cb(Boom.badImplementation(err))

          policyOps.readPolicy({ id: result.rows[0].id, organizationId }, cb)
        })
      })

      return promise
    },

    /**
     * Update policy values
     *
     * @param  {Object}   params { id, organizationId, version, name, statements }
     * @param  {Function} cb
     */
    updatePolicy: function updatePolicy (params, cb) {
      let promise = null
      if (typeof cb !== 'function') [promise, cb] = asyncify()

      const { id, organizationId, version, name, statements } = params

      Joi.validate({ id, organizationId, version, name, statements }, validationRules.updatePolicy, function (err) {
        if (err) return cb(Boom.badRequest(err))

        const sqlQuery = SQL`
          UPDATE policies
          SET
            version = ${version},
            name = ${name},
            statements = ${statements}
          WHERE
            id = ${id}
            AND org_id = ${organizationId}
        `
        db.query(sqlQuery, function (err, result) {
          if (utils.isUniqueViolationError(err)) return cb(Boom.conflict(err.detail))
          if (err) return cb(Boom.badImplementation(err))
          if (result.rowCount === 0) return cb(Boom.notFound())

          policyOps.readPolicy({ id, organizationId }, cb)
        })
      })

      return promise
    },

    /**
     * Delete a specific policy
     *
     * @param  {Object}   params { id, organizationId }
     * @param  {Function} cb
     */
    deletePolicy: function deletePolicy (params, cb) {
      let promise = null
      if (typeof cb !== 'function') [promise, cb] = asyncify()

      const { id, organizationId } = params
      const tasks = [
        (job, next) => {
          Joi.validate({ id, organizationId }, validationRules.deletePolicy, (err) => {
            if (err) return next(Boom.badRequest(err))

            next()
          })
        },
        (job, next) => {
          job.id = id
          job.organizationId = organizationId
          next()
        },
        removePolicyFromUsers,
        removePolicyFromTeams,
        removePolicyFromOrganizations,
        removePolicy
      ]

      db.withTransaction(tasks, (err, res) => {
        if (err) return cb(err)
        cb()
      })

      return promise
    },

    /**
     * List all user policies
     *
     * @param  {Object}   params { userId, organizationId }
     * @param  {Function} cb
     */
    listAllUserPolicies: function listAllUserPolicies ({ userId, organizationId }, cb) {
      let promise = null
      if (typeof cb !== 'function') [promise, cb] = asyncify()

      const rootOrgId = config.get('authorization.superUser.organization.id')
      const sql = SQL`
        WITH user_teams AS (
          SELECT id FROM teams WHERE path @> (
            SELECT array_agg(path) FROM teams
            INNER JOIN team_members tm
            ON tm.team_id = teams.id
            WHERE tm.user_id = ${userId}
          )
        ),
        policies_from_teams AS (
          SELECT
            policy_id, variables
          FROM
            team_policies
          WHERE
            team_id IN (SELECT id FROM user_teams)
        ),
        policies_from_user AS (
          SELECT
            policy_id, variables
          FROM
            user_policies
          WHERE
            user_id = ${userId}
        ),
        policies_from_organization AS (
          SELECT
            op.policy_id, variables
          FROM
            organization_policies op
          LEFT JOIN
            users u ON u.org_id = op.org_id
          WHERE
            u.id = ${userId}
        ),
        is_root_user AS (
          SELECT FROM users WHERE id=${userId} AND org_id = ${rootOrgId}
        )
        SELECT
          id,
          version,
          name,
          statements,
          policies_from_user.variables AS variables
        FROM
          policies
        INNER JOIN
          policies_from_user
        ON
          policies.id = policies_from_user.policy_id
        WHERE (
            org_id = ${organizationId}
          OR (
              EXISTS (SELECT FROM is_root_user)
            AND
              org_id = ${rootOrgId}
          )
          OR org_id IS NULL
        )
        UNION
        SELECT
          id,
          version,
          name,
          statements,
          policies_from_teams.variables AS variables
        FROM
          policies
        INNER JOIN
          policies_from_teams
        ON
          policies.id = policies_from_teams.policy_id
        WHERE (
            org_id = ${organizationId}
          OR (
              EXISTS (SELECT FROM is_root_user)
            AND
              org_id = ${rootOrgId}
          )
          OR org_id IS NULL
        )
        UNION
        SELECT
          id,
          version,
          name,
          statements,
          policies_from_organization.variables
        FROM
          policies
        INNER JOIN
          policies_from_organization
        ON
          policies.id = policies_from_organization.policy_id
        WHERE (
            org_id = ${organizationId}
          OR (
              EXISTS (SELECT FROM is_root_user)
            AND
              org_id = ${rootOrgId}
          )
          OR org_id IS NULL
        )
      `

      db.query(sql, function (err, result) {
        if (err) return cb(Boom.badImplementation(err))
        cb(null, result.rows.map(mapping.policy.iam))
      })

      return promise
    },

    deleteAllPolicyByIds: function deleteAllPolicyByIds (client, ids, orgId, cb) {
      let promise = null
      if (typeof cb !== 'function') [promise, cb] = asyncify()

      async.applyEachSeries([
        deleteTeamAssociations,
        deleteUserAssociations,
        deletePolicies
      ], client, ids, orgId, cb)

      return promise
    },

    /**
     * Search for policies
     *
     * @param {Object} params { organizationId, query, type } "type" is optional, default is organization wide search
     * @param {Function} cb
     */
    search: function search (params, cb) {
      let promise = null
      if (typeof cb !== 'function') [promise, cb] = asyncify('data', 'total')

      const { organizationId, query, type } = params
      Joi.validate({ organizationId, query, type }, validationRules.searchPolicy, function (err) {
        if (err) {
          return cb(Boom.badRequest(err))
        }

        const sqlQuery = SQL`
          SELECT *
          FROM policies
          WHERE (
            to_tsvector(name) @@ to_tsquery(${query.split(' ').join(' & ') + ':*'})
            OR name LIKE(${'%' + query + '%'})
          )      
        `

        if (type === 'shared') {
          sqlQuery.append(SQL` AND org_id is NULL`)
        } else if (type === 'all') {
          sqlQuery.append(SQL` AND (org_id is NULL OR org_id=${organizationId})`)
        } else {
          sqlQuery.append(SQL` AND org_id=${organizationId}`)
        }

        sqlQuery.append(SQL` ORDER BY name;`)

        db.query(sqlQuery, (err, result) => {
          if (err) return cb(Boom.badImplementation(err))
          return cb(null, result.rows.map(mapping.policy), result.rows.length)
        })
      })

      return promise
    },

    createOrgDefaultPolicies: function createOrgDefaultPolicies (client, organizationId, cb) {
      let promise = null
      if (typeof cb !== 'function') [promise, cb] = asyncify()

      const defaultPolicies = config.get('authorization.organizations.defaultPolicies', {'organizationId': organizationId})
      insertPolicies(client, defaultPolicies, function (err, result) {
        if (err) return cb(Boom.badImplementation(err))

        const name = config.get('authorization.organizations.defaultPolicies.orgAdmin.name', {'organizationId': organizationId})
        const sqlQuery = SQL`
          SELECT id
          FROM policies
          WHERE org_id = ${organizationId}
            AND name = ${name}
        `
        client.query(sqlQuery, function (err, result) {
          if (err) return cb(Boom.badImplementation(err))
          if (result.rowCount === 0) return cb(Boom.notFound(`No policy found for org ${organizationId} with name ${name}`))

          cb(null, result.rows[0].id)
        })
      })

      return promise
    },

    createTeamDefaultPolicies: function createTeamDefaultPolicies (client, organizationId, teamId, cb) {
      const defaultPolicies = config.get('authorization.teams.defaultPolicies', { organizationId, teamId })
      return insertPolicies(client, defaultPolicies, cb)
    },

    readTeamDefaultPolicies: function readTeamDefaultPolicies (client, organizationId, teamId, cb) {
      let promise = null
      if (typeof cb !== 'function') [promise, cb] = asyncify()

      const defaultPolicies = config.get('authorization.teams.defaultPolicies', {organizationId, teamId})
      const names = getNames(defaultPolicies)
      client.query(SQL`SELECT id FROM policies WHERE name = ANY(${names}) AND org_id = ${organizationId}`, utils.boomErrorWrapper(cb))

      return promise
    },

    /**
     * List all the policies referencing a specific organization (not necessarily attached to it)
     *
     * @param  {Object}   params { limit, page }
     * @param  {Function} cb
     */
    listSharedPolicies: function listSharedPolicies (params, cb) {
      let promise = null
      if (typeof cb !== 'function') [promise, cb] = asyncify('data', 'total')

      const { limit, page } = params

      Joi.validate({ page, limit }, validationRules.listSharedPolicies, function (err) {
        if (err) return cb(Boom.badRequest(err))

        const sqlQuery = SQL`
          WITH total AS (
            SELECT COUNT(*) AS cnt FROM policies
            WHERE org_id IS NULL
          )
          SELECT
            p.id,
            p.version,
            p.name,
            p.statements,
            t.cnt::INTEGER AS total
          FROM policies AS p
          INNER JOIN total AS t ON 1=1
          WHERE p.org_id IS NULL
          ORDER BY UPPER(p.name)
        `
        if (limit) {
          sqlQuery.append(SQL` LIMIT ${limit}`)
        }
        if (limit && page) {
          const offset = (page - 1) * limit
          sqlQuery.append(SQL` OFFSET ${offset}`)
        }
        db.query(sqlQuery, function (err, result) {
          if (err) return cb(Boom.badImplementation(err))
          let total = result.rows.length > 0 ? result.rows[0].total : 0
          return cb(null, result.rows.map(mapping.policy), total)
        })
      })

      return promise
    },

    /**
     * fetch specific shared policy
     *
     * @param  {Object}   params { id }
     * @param  {Function} cb
     */
    readSharedPolicy: function readSharedPolicy ({ id }, cb) {
      let promise = null
      if (typeof cb !== 'function') [promise, cb] = asyncify()

      Joi.validate({ id }, validationRules.readSharedPolicy, function (err) {
        if (err) return cb(Boom.badRequest(err))

        const sqlQuery = SQL`
          SELECT  *
          FROM policies
          WHERE id = ${id}
          AND org_id IS NULL
        `
        db.query(sqlQuery, function (err, result) {
          if (err) return cb(Boom.badImplementation(err))
          if (result.rowCount === 0) return cb(Boom.notFound())

          return cb(null, mapping.policy(result.rows[0]))
        })
      })

      return promise
    },

    /**
     * Creates a new shared policy
     *
     * @param  {Object}   params { id, version, name, statements }
     * @param  {Function} cb
     */
    createSharedPolicy: function createSharedPolicy (params, cb) {
      let promise = null
      if (typeof cb !== 'function') [promise, cb] = asyncify()

      Joi.validate(params, validationRules.createSharedPolicy, function (err) {
        if (err) return cb(Boom.badRequest(err))

        const { id, version, name, statements } = params

        insertSharedPolicies(db, [{
          id: id,
          version: version,
          name: name,
          statements: statements
        }], (err, result) => {
          if (utils.isUniqueViolationError(err)) return cb(Boom.conflict('policy already exists'))
          if (err) return cb(err)

          policyOps.readSharedPolicy({ id: result.rows[0].id }, cb)
        })
      })

      return promise
    },

    /**
     * Update shared policy values
     *
     * @param  {Object}   params { id, organizationId, version, name, statements }
     * @param  {Function} cb
     */
    updateSharedPolicy: function updateSharedPolicy (params, cb) {
      let promise = null
      if (typeof cb !== 'function') [promise, cb] = asyncify()

      const { id, version, name, statements } = params

      Joi.validate({ id, version, name, statements }, validationRules.updateSharedPolicy, function (err) {
        if (err) return cb(Boom.badRequest(err))

        const sqlQuery = SQL`
          UPDATE policies
          SET
            version = ${version},
            name = ${name},
            statements = ${statements}
          WHERE
            id = ${id}
            AND org_id IS NULL
        `
        db.query(sqlQuery, function (err, result) {
          if (utils.isUniqueViolationError(err)) return cb(Boom.conflict(err.detail))
          if (err) return cb(Boom.badImplementation(err))
          if (result.rowCount === 0) return cb(Boom.notFound())

          policyOps.readSharedPolicy({ id }, cb)
        })
      })

      return promise
    },

    /**
     * Delete a specific shared policy
     *
     * @param  {Object}   params { id }
     * @param  {Function} cb
     */
    deleteSharedPolicy: function deleteSharedPolicy (params, cb) {
      let promise = null
      if (typeof cb !== 'function') [promise, cb] = asyncify()

      const id = params.id
      const tasks = [
        (job, next) => {
          Joi.validate({ id }, validationRules.deleteSharedPolicy, (err) => {
            if (err) return next(Boom.badRequest(err))

            next()
          })
        },
        (job, next) => {
          job.id = id
          next()
        },
        removePolicyFromUsers,
        removePolicyFromTeams,
        removePolicyFromOrganizations,
        removeSharedPolicy
      ]

      db.withTransaction(tasks, (err, res) => {
        if (err) return cb(err)
        cb()
      })

      return promise
    }
  }

  policyOps.listByOrganization.validate = validationRules.listByOrganization
  policyOps.readPolicy.validate = validationRules.readPolicy
  policyOps.createPolicy.validate = validationRules.createPolicy
  policyOps.updatePolicy.validate = validationRules.updatePolicy
  policyOps.deletePolicy.validate = validationRules.deletePolicy
  policyOps.search.validate = validationRules.searchPolicy
  policyOps.readPolicyVariables.validate = validationRules.readPolicyVariables
  policyOps.listPolicyInstances.validate = validationRules.listPolicyInstances

  policyOps.listSharedPolicies.validate = validationRules.listSharedPolicies
  policyOps.readSharedPolicy.validate = validationRules.readSharedPolicy
  policyOps.createSharedPolicy.validate = validationRules.createSharedPolicy
  policyOps.updateSharedPolicy.validate = validationRules.updateSharedPolicy
  policyOps.deleteSharedPolicy.validate = validationRules.deleteSharedPolicy

  return policyOps
}

module.exports = buildPolicyOps
