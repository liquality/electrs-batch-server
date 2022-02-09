## ⚡️ Electrs Batch Server [![JavaScript Style Guide](https://img.shields.io/badge/code_style-standard-brightgreen.svg)](https://standardjs.com)


> 🚨 Experimental tool


### Why?

* https://github.com/Blockstream/electrs/pull/20


### Run your own server

```bash
export PORT=3000
export ELECTRS_URL=http://localhost:3000
export CONCURRENCY=10
export REDIS_URL="redis://localhost:6379"

tsc
npm run build:run
```


### License

[MIT](./LICENSE.md)
