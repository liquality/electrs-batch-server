## ⚡️ Electrs Batch Server [![JavaScript Style Guide](https://img.shields.io/badge/code_style-standard-brightgreen.svg)](https://standardjs.com)


> 🚨 Experimental tool


### Why?

* https://github.com/Blockstream/electrs/pull/20


### Run your own server

```bash
export PORT=5000
export ELECTRS_URL=http://localhost:3000
export CONCURRENCY=10

npm start
```

### 🐳 Docker

Build the image

```sh
docker buildx build --tag electrs-batch-server --load .
```

Run the container

```sh
docker run -it -p 5000:5000 -e PORT=5000 -e ELECTRS_URL=https://blockstream.info/liquid/api -e CONCURRENCY=10 -t electrs-batch-server
```


### License

[MIT](./LICENSE.md)
