import {RouteConifg} from './baseroute';
import express from 'express';
import {Axios} from 'axios';
import Bluebird from 'bluebird'
import _ from "lodash"
import Redis = require('ioredis')

export class Electrs extends RouteConifg {
  public electrs: Axios
  public redisClient: any
  public CONCURRENCY = 10

  constructor(app: express.Application) {
    super(app, 'Electrs');

    const ELECTRS_URL: string = process.env.ELECTRS_URL!
    if (!ELECTRS_URL) {
      throw new Error('ELECTRS_URL is not found in ENV')
    }

    const REDIS_URL: string = process.env.REDIS_URL!
    if (!REDIS_URL) {
      throw new Error('REDIS_URL is not found in ENV')
    }


    const concurrency = process.env.CONCURRENCY!
    if (concurrency) this.CONCURRENCY = Number(concurrency)

    this.electrs = new Axios({baseURL: ELECTRS_URL})
    this.redisClient = new Redis(REDIS_URL)
    this.redisClient.set('testing', 'data')
  }

  configureRoutes() {
    console.log("configure routes")
    this.app.route('/status').get(this.getStatus.bind(this))
    this.app.route('/addresses').post(this.getAddresses.bind(this))
    this.app.route('/addresses/transactions').post(this.getTransactions.bind(this))
    return this.app;
  }

  async getStatus(req: express.Request, res: express.Response) {
    try {
      const payload = await this.electrs.get('/blocks/tip/height')
      const data = payload && payload.data ? payload.data : 'no data'
      return res.status(200).json(JSON.parse(data))
    } catch (err) {
      return res.status(500).json(` ${err}`)
    }
  }

  async getAddresses(req: express.Request, res: express.Response) {
    return this.getElectrsData(req, res, 'addresses')
  }

  async getAddressUtxo(req: express.Request, res: express.Response) {
    return this.getElectrsData(req, res, 'utxo')
  }

  async getTransactions(req: express.Request, res: express.Response) {
    return this.getElectrsData(req, res, 'transactions')
  }

  async getElectrsData(req: express.Request, res: express.Response, callType: string) {
    let {addresses} = req.body
    if (!addresses || !_.isArray(addresses) || addresses.length === 0) {
      return res.status(400).json({error: 'Invalid "addresses" field'})
    }

    const latestBlockData = await this.electrs.get('/blocks/tip/height')
    const latestBlock: string = (latestBlockData && latestBlockData.data) ? latestBlockData.data : ''

    addresses = _.uniq(addresses)

    let response = await this.callRedis(latestBlock, addresses, callType)
    if (!response || response[0] == null || response.length < addresses.length) {
      response = await this.callElectrs(addresses, callType)
      await this.populateRedis(latestBlock, response, callType)
    }

    res.json(JSON.parse(response))

  }
  async populateRedis(latestBlock: string, data: any[], callType: string) {

    console.log('Populating redis cache')
    data.forEach(async (responseData) => {
      let redisKey = ''
      const address: string = JSON.parse(responseData).address

      switch (callType) {
        case 'addresses':
          redisKey = latestBlock + `:/address/${address}`
          break;
        case 'utxo':
          redisKey = latestBlock + `:/address/${address}/utxo`
          break;
        case 'transactions':
          redisKey = latestBlock + `:/address/${address}/txs/chain`
          break;
      }

      const response = await this.redisClient.set(redisKey, responseData);
    })
  }

  async callRedis(latestBlock: string, addresses: string[], callType: string) {


    console.log('Getting data from redis cache')
    const response: any = await Bluebird.map(
      addresses,
      async (address) => {
        let redisKey = ''
        const electrsPath = ''
        switch (callType) {
          case 'addresses':
            redisKey = latestBlock + `:/address/${address}`
            break;
          case 'utxo':
            redisKey = latestBlock + `:/address/${address}/utxo`
            break;
          case 'transactions':
            redisKey = latestBlock + `:/address/${address}/txs/chain`
            break;
        }
        const response = await this.redisClient.get(redisKey);
        return response ? response : null;
      },
      {concurrency: Number(this.CONCURRENCY)}
    )

    return response
  }

  async callElectrs(addresses: string[], callType: string) {

    console.log('Getting data from electrs server')
    const response: any = await Bluebird.map(
      addresses,
      async (address) => {

        let electrsPath = ''
        switch (callType) {
          case 'addresses':
            electrsPath = `/address/${address}`
            break;
          case 'utxo':
            electrsPath = `/address/${address}/utxo`
            break;
          case 'transactions':
            electrsPath = `/address/${address}/txs/chain`
            break;
        }

        const response = await this.electrs.get(electrsPath);
        return response.data;
      },
      {concurrency: Number(this.CONCURRENCY)}
    )

    return response
  }


}
