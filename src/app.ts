import dotenv from 'dotenv'
import BatchServer from './batchserver'
import express from 'express'

dotenv.config({path: `${process.cwd()}/.env.${process.env.NODE_ENV}`})

const PORT = process.env.PORT || 3000

const app = new BatchServer(
  PORT,
  []
)

const server = app.start()

const SIGNALS = ['SIGTERM', 'SIGINT']

SIGNALS.forEach((signal: string) => {
  process.on(signal, () => {
    console.warn(`${signal} received shutdown started`)
    server.close(() => {
      console.warn('Express server process terminated')
    })
  })
})
