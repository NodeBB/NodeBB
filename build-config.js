require('dotenv').config()
const fs = require('fs')

const {
  MONGO_DATABASE_NAME: database,
  MONGO_DB_URI: uri,
  PORT: port,
  SECRET: secret,
  URL: url
} = process.env

const config = {
  url,
  secret,
  database: 'mongo',
  mongo: {
    database,
    uri
  },
  port
}

fs.writeFileSync('config.json', JSON.stringify(config))
