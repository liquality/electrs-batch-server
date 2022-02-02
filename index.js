const _ = require('lodash')
const Bluebird = require('bluebird')
const axios = require('axios')
const express = require('express')
const helmet = require('helmet')
const compression = require('compression')
const bodyParser = require('body-parser')
const asyncHandler = require('express-async-handler')
const Sentry = require('@sentry/node')
const Tracing = require('@sentry/tracing')
const httpError = require('./http-error')
const systemDefaults = require('./systemDefaults')

const { NODE_ENV, ELECTRS_URL, SENTRY_DSN } = process.env
const PORT = process.env.PORT || systemDefaults.port
const CONCURRENCY = process.env.CONCURRENCY || systemDefaults.concurrency

const app = express()

if (NODE_ENV === 'production' && SENTRY_DSN) {
  Sentry.init({
    dsn: SENTRY_DSN,
    integrations: [
      // enable HTTP calls tracing
      new Sentry.Integrations.Http({ tracing: true }),
      // enable Express.js middleware tracing
      new Tracing.Integrations.Express({ app })
    ],

    // Set tracesSampleRate to 1.0 to capture 100%
    // of transactions for performance monitoring.
    // We recommend adjusting this value in production
    tracesSampleRate: 1.0
  })
}

if (!ELECTRS_URL) throw new Error('Invalid ELECTRS_URL')

const electrs = axios.create({ baseURL: ELECTRS_URL })

app.use(helmet())
app.use(compression())
app.use(bodyParser.json({ limit: '5mb' }))
app.set('etag', false)

// GET /status
// A status endpoint for monitoring the batch API
//   (on success) Returns status 200 and the latest indexed block
//   (on error)   Returns the underlying error message with error status
app.get('/status', async (req, res, next) => {
  try {
    const payload = await electrs.get('/blocks/tip/height')
    const data = payload && payload.data ? payload.data : 'no data'
    return res.status(200).json(data)
  } catch (err) {
    const message = err.response && err.response.data ? err.response.data : err.message
    const status = err.status || 500
    return res.status(status).json(`${status}: ${message}`)
  }
})

app.post(
  '/addresses',
  asyncHandler(async (req, res, next) => {
    let { addresses } = req.body
    if (!addresses || !_.isArray(addresses) || addresses.length === 0) {
      return res.status(400).json({ error: 'Invalid "addresses" field' })
    }

    addresses = _.uniq(addresses)

    const response = await Bluebird.map(
      addresses,
      (address) => {
        return electrs.get(`/address/${address}`).then((response) => response.data)
      },
      { concurrency: Number(CONCURRENCY) }
    )

    res.json(response)
  })
)

app.post(
  '/addresses/utxo',
  asyncHandler(async (req, res, next) => {
    let { addresses } = req.body
    if (!addresses || !_.isArray(addresses) || addresses.length === 0) {
      return res.status(400).json({ error: 'Invalid "addresses" field' })
    }

    addresses = _.uniq(addresses)

    const response = await Bluebird.map(
      addresses,
      (address) => {
        return electrs.get(`/address/${address}/utxo`).then((response) => ({
          address,
          utxo: response.data
        }))
      },
      { concurrency: Number(CONCURRENCY) }
    )

    res.json(response)
  })
)

app.post(
  '/addresses/transactions',
  asyncHandler(async (req, res, next) => {
    let { addresses } = req.body
    if (!addresses || !_.isArray(addresses) || addresses.length === 0) {
      return res.status(400).json({ error: 'Invalid "addresses" field' })
    }

    addresses = _.uniq(addresses)

    const response = await Bluebird.map(
      addresses,
      (address) => {
        return electrs.get(`/address/${address}/txs/chain`).then((response) => ({
          address,
          transaction: response.data
        }))
      },
      { concurrency: Number(CONCURRENCY) }
    )
    res.json(response)
  })
)

app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*')
  res.header('Access-Control-Allow-Methods', 'HEAD, GET, POST, OPTIONS')
  next()
})

app.all('/*', function (req, res) {
  res.setHeader('Content-Type', 'text/html')
  res.send('Electrs Batch API is running')
  // res.status(404).json({
  //   error: '404'
  // })
})

if (NODE_ENV === 'production') {
  console.log('Setting production config')
  app.use(Sentry.Handlers.requestHandler())
  app.use(Sentry.Handlers.tracingHandler())
  app.use(Sentry.Handlers.errorHandler())
}

app.use((err, req, res, next) => {
  const status = err.statusCode || 500
  const message = err.message || err.toString()

  if (NODE_ENV !== 'production') {
    console.error(err)
  }

  return httpError(req, res, status, message)
})

app.listen(PORT, () => console.log(`Electrs Batch API is running on ${PORT}`))
