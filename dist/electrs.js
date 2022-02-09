"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.Electrs = void 0;
const baseroute_1 = require("./baseroute");
const axios_1 = require("axios");
const bluebird_1 = __importDefault(require("bluebird"));
const lodash_1 = __importDefault(require("lodash"));
const Redis = require("ioredis");
class Electrs extends baseroute_1.RouteConifg {
    constructor(app) {
        super(app, 'Electrs');
        this.CONCURRENCY = 10;
        const ELECTRS_URL = process.env.ELECTRS_URL;
        if (!ELECTRS_URL) {
            throw new Error('ELECTRS_URL is not found in ENV');
        }
        const REDIS_URL = process.env.REDIS_URL;
        if (!REDIS_URL) {
            throw new Error('REDIS_URL is not found in ENV');
        }
        const concurrency = process.env.CONCURRENCY;
        if (concurrency)
            this.CONCURRENCY = Number(concurrency);
        this.electrs = new axios_1.Axios({ baseURL: ELECTRS_URL });
        this.redisClient = new Redis(REDIS_URL);
        this.redisClient.set('testing', 'data');
    }
    configureRoutes() {
        console.log("configure routes");
        this.app.route('/status').get(this.getStatus.bind(this));
        this.app.route('/addresses').post(this.getAddresses.bind(this));
        this.app.route('/addresses/transactions').post(this.getTransactions.bind(this));
        return this.app;
    }
    getStatus(req, res) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const payload = yield this.electrs.get('/blocks/tip/height');
                const data = payload && payload.data ? payload.data : 'no data';
                return res.status(200).json(JSON.parse(data));
            }
            catch (err) {
                return res.status(500).json(` ${err}`);
            }
        });
    }
    getAddresses(req, res) {
        return __awaiter(this, void 0, void 0, function* () {
            return this.getElectrsData(req, res, 'addresses');
        });
    }
    getAddressUtxo(req, res) {
        return __awaiter(this, void 0, void 0, function* () {
            return this.getElectrsData(req, res, 'utxo');
        });
    }
    getTransactions(req, res) {
        return __awaiter(this, void 0, void 0, function* () {
            return this.getElectrsData(req, res, 'transactions');
        });
    }
    getElectrsData(req, res, callType) {
        return __awaiter(this, void 0, void 0, function* () {
            let { addresses } = req.body;
            if (!addresses || !lodash_1.default.isArray(addresses) || addresses.length === 0) {
                return res.status(400).json({ error: 'Invalid "addresses" field' });
            }
            const latestBlockData = yield this.electrs.get('/blocks/tip/height');
            const latestBlock = (latestBlockData && latestBlockData.data) ? latestBlockData.data : '';
            addresses = lodash_1.default.uniq(addresses);
            let response = yield this.callRedis(latestBlock, addresses, callType);
            if (!response || response[0] == null || response.length < addresses.length) {
                response = yield this.callElectrs(addresses, callType);
                yield this.populateRedis(latestBlock, response, callType);
            }
            res.json(JSON.parse(response));
        });
    }
    populateRedis(latestBlock, data, callType) {
        return __awaiter(this, void 0, void 0, function* () {
            console.log('Populating redis cache');
            data.forEach((responseData) => __awaiter(this, void 0, void 0, function* () {
                let redisKey = '';
                let address = JSON.parse(responseData).address;
                switch (callType) {
                    case 'addresses':
                        redisKey = latestBlock + `:/address/${address}`;
                        break;
                    case 'utxo':
                        redisKey = latestBlock + `:/address/${address}/utxo`;
                        break;
                    case 'transactions':
                        redisKey = latestBlock + `:/address/${address}/txs/chain`;
                        break;
                }
                const response = yield this.redisClient.set(redisKey, responseData);
            }));
        });
    }
    callRedis(latestBlock, addresses, callType) {
        return __awaiter(this, void 0, void 0, function* () {
            console.log('Getting data from redis cache');
            const response = yield bluebird_1.default.map(addresses, (address) => __awaiter(this, void 0, void 0, function* () {
                let redisKey = '';
                let electrsPath = '';
                switch (callType) {
                    case 'addresses':
                        redisKey = latestBlock + `:/address/${address}`;
                        break;
                    case 'utxo':
                        redisKey = latestBlock + `:/address/${address}/utxo`;
                        break;
                    case 'transactions':
                        redisKey = latestBlock + `:/address/${address}/txs/chain`;
                        break;
                }
                const response = yield this.redisClient.get(redisKey);
                return response ? response : null;
            }), { concurrency: Number(this.CONCURRENCY) });
            return response;
        });
    }
    callElectrs(addresses, callType) {
        return __awaiter(this, void 0, void 0, function* () {
            console.log('Getting data from electrs server');
            const response = yield bluebird_1.default.map(addresses, (address) => __awaiter(this, void 0, void 0, function* () {
                let electrsPath = '';
                switch (callType) {
                    case 'addresses':
                        electrsPath = `/address/${address}`;
                        break;
                    case 'utxo':
                        electrsPath = `/address/${address}/utxo`;
                        break;
                    case 'transactions':
                        electrsPath = `/address/${address}/txs/chain`;
                        break;
                }
                const response = yield this.electrs.get(electrsPath);
                return response.data;
            }), { concurrency: Number(this.CONCURRENCY) });
            return response;
        });
    }
}
exports.Electrs = Electrs;
