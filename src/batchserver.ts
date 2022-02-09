import express, {Application} from 'express'
import helmet from 'helmet'
import cors from 'cors'
import compression from 'compression'
import Sentry from '@sentry/node'
import {RouteConifg} from './baseroute'
import {Electrs} from './electrs'
import bodyParser = require('body-parser')
import httpError = require('../http-error.js')

class App {
  private app: Application
  private routes: Array<RouteConifg> = []

  constructor(private port: string | number, private middlewares: any[]) {
    this.app = express()
    this.port = port

    console.log('init config')
    // this.initMiddlewares(middlewares)
    this.initConifg()
    this.initRoutes()

    //init error handler should be added last
    this.app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
      const status = err.statusCode || 500
      const message = err.message || err.toString()
      if (process.env.NODE_ENV !== 'production') {
        console.error(err)
      }

      return httpError(req, res, status, message)
    })

    this.app.all('/*')
  }

  private initRoutes() {
    this.routes.push(new Electrs(this.app))
  }

  private initConifg() {
    if (process.env.NODE_ENV === 'production') {
      this.app.set('trust proxy', 1)
      this.initSentry()
    }

    this.app.use(bodyParser.urlencoded({extended: false}))
    this.app.use(bodyParser.json())
    this.app.use(helmet({contentSecurityPolicy: false}))
    this.app.use(cors())
    this.app.use(compression())
    this.app.set('etag', false)
  }

  private initMiddlewares(middlewaresArr: any[]) {
    middlewaresArr.forEach((middleware) => {
      this.app.use(middleware)
    })
  }

  private initSentry() {
    const sentryDSN: string = process.env.SENTRY_DSN!

    if (!sentryDSN) throw new Error('Invalid Sentry DSN URL')

    Sentry.init({
      dsn: sentryDSN,
      integrations: [new Sentry.Integrations.Http({tracing: true})],
      tracesSampleRate: 1.0
    })

    this.app.use(Sentry.Handlers.requestHandler())
    this.app.use(Sentry.Handlers.tracingHandler())
    this.app.use(Sentry.Handlers.errorHandler())
  }

  public start() {
    this.routes.forEach((route: RouteConifg) => {
      route.configureRoutes()
    })
    return this.app.listen(this.port, () => {
      console.log(`App is running on port ${this.port}`)
    })
  }
}

export default App
