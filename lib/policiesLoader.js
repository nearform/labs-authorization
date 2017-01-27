'use strict'

const jsonfile = require('jsonfile')
const config = require('./server/lib/config')
const udaru = require('./module')(config._rawConfig)

function exit (message) {
  console.log(message)
  process.exit(1)
}

function load (organizationId, source, callback, closeDb = true) {
  if (!organizationId) {
    return callback(new Error('Please provide the organization id'))
  }

  if (!source) {
    return callback(new Error('Please provide a json file'))
  }

  const input = jsonfile.readFileSync(source, { throws: false })
  if (!input || !input.policies) {
    return callback(new Error('Invalid json file'))
  }

  udaru.organizations.read(organizationId, (error, organization) => {
    if (error || !organization) {
      return callback(new Error(`There was a problem finding organization ${organizationId}`))
    }

    const tasks = input.policies.map((policy) => {
      const policyData = {
        id: policy.id,
        version: policy.version,
        name: policy.name,
        organizationId: policy.organizationId || organizationId,
        statements: JSON.stringify({ Statement: policy.statements })
      }

      return (job, next) => { udaru.policies.create(policyData, next) }
    })

    udaru.db.withTransaction(tasks, (err) => {
      if (closeDb) udaru.db.shutdown(() => {})
      callback(err)
    })
  })
}

module.exports = {
  load: load,
  exit: exit
}
