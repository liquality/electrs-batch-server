const _ = require('lodash')
const Sentry = require('@sentry/node')

const {
  PORT,
  NODE_ENV,
  ELECTRS_URL,
  CONCURRENCY,
  SENTRY_DSN
} = process.env

if (NODE_ENV === 'production' && SENTRY_DSN) {
  Sentry.init({ dsn: SENTRY_DSN })
}

const Bluebird = require('bluebird')
const axios = require('axios')
const express = require('express')
const helmet = require('helmet')
const compression = require('compression')
const bodyParser = require('body-parser')
const asyncHandler = require('express-async-handler')

const httpError = require('./http-error')

if (!PORT) throw new Error('Invalid PORT')
if (!ELECTRS_URL) throw new Error('Invalid ELECTRS_URL')
if (!CONCURRENCY) throw new Error('Invalid CONCURRENCY')

const app = express()
const electrs = axios.create({ baseURL: ELECTRS_URL })

if (NODE_ENV === 'production') {
  app.use(Sentry.Handlers.requestHandler())
}

app.use(helmet())
app.use(compression())
app.use(bodyParser.json({ limit: '5mb' }))
app.set('etag', false)

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

app.listen(PORT, () => console.log(`API is running on ${PORT}`))
