"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const helmet_1 = __importDefault(require("helmet"));
const cors_1 = __importDefault(require("cors"));
const compression_1 = __importDefault(require("compression"));
const node_1 = __importDefault(require("@sentry/node"));
const electrs_1 = require("./electrs");
const bodyParser = require("body-parser");
const httpError = require("../http-error.js");
class App {
    constructor(port, middlewares) {
        this.port = port;
        this.middlewares = middlewares;
        this.routes = [];
        this.app = (0, express_1.default)();
        this.port = port;
        console.log('init config');
        // this.initMiddlewares(middlewares)
        this.initConifg();
        this.initRoutes();
        //init error handler should be added last
        this.app.use((err, req, res, next) => {
            const status = err.statusCode || 500;
            const message = err.message || err.toString();
            if (process.env.NODE_ENV !== 'production') {
                console.error(err);
            }
            return httpError(req, res, status, message);
        });
        this.app.all('/*');
    }
    initRoutes() {
        this.routes.push(new electrs_1.Electrs(this.app));
    }
    initConifg() {
        if (process.env.NODE_ENV === "production") {
            this.app.set('trust proxy', 1);
            this.initSentry();
        }
        this.app.use(bodyParser.urlencoded({ extended: false }));
        this.app.use(bodyParser.json());
        this.app.use((0, helmet_1.default)({ contentSecurityPolicy: false }));
        this.app.use((0, cors_1.default)());
        this.app.use((0, compression_1.default)());
        this.app.set('etag', false);
    }
    initMiddlewares(middlewaresArr) {
        middlewaresArr.forEach((middleware) => {
            this.app.use(middleware);
        });
    }
    initSentry() {
        var sentryDSN = process.env.SENTRY_DSN;
        if (!sentryDSN)
            throw new Error('Invalid Sentry DSN URL');
        node_1.default.init({
            dsn: sentryDSN,
            integrations: [
                new node_1.default.Integrations.Http({ tracing: true }),
            ],
            tracesSampleRate: 1.0
        });
        this.app.use(node_1.default.Handlers.requestHandler());
        this.app.use(node_1.default.Handlers.tracingHandler());
        this.app.use(node_1.default.Handlers.errorHandler());
    }
    start() {
        this.routes.forEach((route) => {
            route.configureRoutes();
        });
        return this.app.listen(this.port, () => {
            console.log(`App is running on port ${this.port}`);
        });
    }
}
exports.default = App;
