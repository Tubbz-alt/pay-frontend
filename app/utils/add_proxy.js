'use strict'

// npm dependencies
const urlParse = require('url').parse
const _ = require('lodash')

// constants
const {FORWARD_PROXY_URL} = process.env

const _addProxy = function addProxy (url) {
  const parsedUrl = urlParse(url)

  if (FORWARD_PROXY_URL) {
    const parsedProxyUrl = urlParse(FORWARD_PROXY_URL)
    return _.merge(parsedUrl, _.pick(parsedProxyUrl, ['hostname', 'port']))
  }
  return parsedUrl
}

module.exports = {
  addProxy: function (url) {
    return _addProxy(url)
  }
}
