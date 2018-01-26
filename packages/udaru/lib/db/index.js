'use strict'

const async = require('async')
const pg = require('pg')
const pino = require('pino')

function connect (job, next) {
  job.client.connect((err, conn, release) => {
    if (err) return next(err)
    job.client = conn
    job.release = release
    next()
  })
}

function beginTransaction (job, next) {
  job.client.query('BEGIN TRANSACTION', next)
}

function runTasks (job, next) {
  async.applyEachSeries(job.tasks, job, next)
}

function commitTransaction (job, next) {
  job.client.query('COMMIT', (err) => {
    job.release()
    next(err)
  })
}

function rollbackTransaction (job, originalError, next) {
  job.client.query('ROLLBACK', (err) => {
    job.release && job.release()
    next(err || originalError)
  })
}

function buildTransactionClient (job, next) {
  job.client = new TransactionClient(job.client)
  next()
}

function TransactionClient (client) {
  return {
    query: function query (...args) {
      client.query(...args)
    },

    withTransaction: function withTransaction (tasks, done) {
      const job = {
        client: client,
        tasks: tasks
      }

      runTasks(job, done)
    }
  }
}

function buildDb (pool, config) {
  const logger = pino(config.get('logger.pino') || {})
  let releasePool = false

  if (!pool) {
    /** @see https://github.com/brianc/node-pg-pool#a-note-on-instances */
    pool = new pg.Pool(config.get('pgdb'))
    releasePool = true
    pool.on('error', function (err, client) {
      // if an error is encountered by a client while it sits idle in the pool
      // the pool itself will emit an error event with both the error and
      // the client which emitted the original error
      // this is a rare occurrence but can happen if there is a network partition
      // between your application and the database, the database restarts, etc.
      // and so you might want to handle it and at least log it out
      logger.error(err, 'idle client error')
    })
  }

  function query (...args) {
    pool.query(...args)
  }

  function withTransaction (tasks, done) {
    const job = {
      client: pool,
      tasks: tasks
    }

    async.applyEachSeries([
      connect,
      beginTransaction,
      buildTransactionClient,
      runTasks,
      commitTransaction
    ], job, (err, res) => {
      if (err) return rollbackTransaction(job, err, done)
      done(null, job)
    })
  }

  function shutdown (cb) {
    if (!releasePool) {
      return cb()
    }

    pool.connect(function (err, client, done) {
      if (err) return cb(err)
      client.query('SELECT now()', function (err, result) {
        if (err) logger.error(err) // log and carry on regardless
        if (client.release) client.release()
        pool.end(cb)
      })
    })
  }

  return {
    shutdown: shutdown,
    query: query,
    withTransaction: withTransaction
  }
}

module.exports = buildDb
