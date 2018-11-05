'use strict'

// npm dependencies
const logger = require('winston')

// local dependencies
const views = require('../utils/views')
const withAnalyticsError = require('../utils/analytics').withAnalyticsError

exports.humans = (req, res) => views.display(req, res, 'HUMANS', withAnalyticsError())

exports.naxsi_error = (req, res) => {
  logger.error('NAXSI ERROR:- ' + req.headers['x-naxsi_sig'])
  views.display(req, res, 'NAXSI_SYSTEM_ERROR', withAnalyticsError())
}
