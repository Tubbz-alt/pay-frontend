'use strict'

// NPM dependencies
const csrf = require('csrf')

// Local dependencies
const logger = require('../utils/logger')(__filename)
const { getLoggingFields } = require('../utils/logging_fields_helper')
const session = require('../utils/session')
const responseRouter = require('../utils/response_router')
const chargeParam = require('../services/charge_param_retriever')

exports.csrfTokenGeneration = (req, res, next) => {
  const chargeId = chargeParam.retrieve(req)
  const chargeSession = session.retrieve(req, chargeId)
  res.locals.csrf = csrf().create(chargeSession.csrfSecret)
  next()
}

exports.csrfCheck = (req, res, next) => {
  const chargeId = chargeParam.retrieve(req)
  if (!chargeId) {
    logger.info('Session cookie is not present, rendering unauthorised page', getLoggingFields(req))
    return responseRouter.response(req, res, 'UNAUTHORISED')
  }

  const chargeSession = session.retrieve(req, chargeId) || {}
  const csrfToken = req.body.csrfToken
  chargeSession.csrfTokens = chargeSession.csrfTokens || []

  if (!chargeSession.csrfSecret) {
    responseRouter.response(req, res, 'UNAUTHORISED')
    logger.error('CSRF secret is not defined', {
      ...getLoggingFields(req),
      referrer: req.get('Referrer'),
      url: req.originalUrl,
      method: req.method
    })
  } else if (!csrfValid(csrfToken, chargeSession, req)) {
    responseRouter.systemErrorResponse(req, res, 'CSRF is invalid')
  } else {
    chargeSession.csrfTokens.push(csrfToken)
    next()
  }
}

function csrfValid (csrfToken, chargeSession, req) {
  if (!['put', 'post'].includes(req.method.toLowerCase())) {
    return true
  } else if (chargeSession.csrfTokens.includes(csrfToken)) {
    logger.error('CSRF token was already used', getLoggingFields(req))
    return false
  } else {
    return csrf().verify(chargeSession.csrfSecret, csrfToken)
  }
}
