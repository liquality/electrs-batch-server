const _ = require('lodash')
const Bluebird = require('bluebird')
const axios = require('axios')
const express = require('express')
const helmet = require('helmet')
const compression = require('compression')
const bodyParser = require('body-parser')
const asyncHandler = require('express-async-handler')
const Sentry = require('@sentry/node')
const httpError = require('./http-error')
const systemDefaults = require('./systemDefaults')

const {
  NODE_ENV,
  ELECTRS_URL,
  SENTRY_DSN
} = process.env
const PORT = process.env.PORT || systemDefaults.port
const CONCURRENCY = process.env.CONCURRENCY || systemDefaults.concurrency

if (NODE_ENV === 'production' && SENTRY_DSN) {
  Sentry.init({ dsn: SENTRY_DSN })
}

if (!ELECTRS_URL) throw new Error('Invalid ELECTRS_URL')

const app = express()
const electrs = axios.create({ baseURL: ELECTRS_URL })

if (NODE_ENV === 'production') {
  app.use(Sentry.Handlers.requestHandler())
}

app.use(helmet())
app.use(compression())
app.use(bodyParser.json({ limit: '5mb' }))
app.set('etag', false)

// async function performStatusCheck () {
//   console.log(`[API] status check (${ELECTRS_URL}/blocks/tip/height)`)
//   try {
//     const payload = await electrs.get('/blocks/tip/height222')
//     console.log('[DEVING] payload:', payload)
//     return payload.data
//   } catch (error) {
//     console.error(`[API] status check failed ${error.status} =>`, error)
//     throw error
//   }
// }

// GET /status
// A status endpoint for monitoring the batch API
//   (on success) Returns status 200 and the latest block
//   (on error)   Returns the underlying http status as an error
app.get('/status', async (req, res, next) => {
  // console.log(`[API] status check (${ELECTRS_URL}/blocks/tip/height)`)
  // const payload = await electrs.get('/blocks/tip/height')
  // const data = (payload && payload.data) ? payload.data : null
  // if (!data) return res.status(500).json({ error: 'Electrs endpoint did not respond as expected' })
  // console.log(`[API] electrs response: ${data}`)
  // res.set('Access-Control-Allow-Origin', '*')
  // res.json(data)
  return res.status(200).json('ok')
})

app.post('/addresses', asyncHandler(async (req, res, next) => {
  let { addresses } = req.body
  if (!addresses || !_.isArray(addresses) || addresses.length === 0) {
    return res.status(400).json({ error: 'Invalid "addresses" field' })
  }

  addresses = _.uniq(addresses)

  const response = await Bluebird.map(addresses, address => {
    return electrs.get(`/address/${address}`).then(response => response.data)
  }, { concurrency: Number(CONCURRENCY) })

  res.json(response)
}))

app.post('/addresses/utxo', asyncHandler(async (req, res, next) => {
  let { addresses } = req.body
  if (!addresses || !_.isArray(addresses) || addresses.length === 0) {
    return res.status(400).json({ error: 'Invalid "addresses" field' })
  }

  addresses = _.uniq(addresses)

  const response = await Bluebird.map(addresses, address => {
    return electrs.get(`/address/${address}/utxo`).then(response => ({
      address,
      utxo: response.data
    }))
  }, { concurrency: Number(CONCURRENCY) })

  res.json(response)
}))

app.post('/addresses/transactions', asyncHandler(async (req, res, next) => {
  let { addresses } = req.body
  if (!addresses || !_.isArray(addresses) || addresses.length === 0) {
    return res.status(400).json({ error: 'Invalid "addresses" field' })
  }

  addresses = _.uniq(addresses)

  const response = await Bluebird.map(addresses, address => {
    return electrs.get(`/address/${address}/txs/chain`).then(response => ({
      address,
      transaction: response.data
    }))
  }, { concurrency: Number(CONCURRENCY) })
  res.json(response)
}))

app.all('/*', function (req, res) {
  res.status(404).json({
    error: '404'
  })
})

app.use((err, req, res, next) => {
  const status = err.statusCode || 500
  const message = err.message || err.toString()

  if (NODE_ENV !== 'production') {
    console.error(err)
  }

  return httpError(req, res, status, message)
})

app.listen(PORT, () => console.log(`Electrs Batch API is running on ${PORT}`))
