'use strict'

// NPM dependencies
const AWSXRay = require('aws-xray-sdk')
const { getNamespace } = require('continuation-local-storage')

// Local dependencies
const logging = require('../utils/logging')
const responseRouter = require('../utils/response_router')
const Charge = require('../models/charge')
const chargeParam = require('../services/charge_param_retriever')
const { CORRELATION_HEADER } = require('../../config/correlation_header')
const withAnalyticsError = require('../utils/analytics').withAnalyticsError

// Constants
const clsXrayConfig = require('../../config/xray-cls')

module.exports = (req, res, next) => {
  const chargeId = chargeParam.retrieve(req)
  const namespace = getNamespace(clsXrayConfig.nameSpaceName)
  const clsSegment = namespace.get(clsXrayConfig.segmentKeyName)
  if (!chargeId) {
    responseRouter.response(req, res, 'UNAUTHORISED', withAnalyticsError())
  } else {
    req.chargeId = chargeId
    AWSXRay.captureAsyncFunc('Charge_find', (subsegment) => {
      Charge(req.headers[CORRELATION_HEADER]).find(chargeId)
        .then(data => {
          subsegment.close()
          req.chargeData = data
          next()
        })
        .catch(() => {
          subsegment.close('error')
          logging.systemError('Charge search middleware, finding charge', req.headers && req.headers[CORRELATION_HEADER], chargeId)
          responseRouter.response(req, res, 'SYSTEM_ERROR', withAnalyticsError())
        })
    }, clsSegment)
  }
}
