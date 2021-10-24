FROM node:15.7.0-alpine

# -------------------
# Build app directory
# -------------------
WORKDIR /app

# Build dependencies
COPY package*.json ./
RUN npm ci

# Bundle app source
COPY . .

# -------------
# Start Service
# -------------
EXPOSE 9090

CMD ["node", "./bin/electrs-batch-server"]
