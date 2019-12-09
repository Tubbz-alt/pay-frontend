'use strict'

// Local dependencies
const requestLogger = require('../utils/request_logger')

// Constants
const SUCCESS_CODES = [200, 201, 202, 204, 206]

exports.createCallbackToPromiseConverter = createCallbackToPromiseConverter
exports.successCodes = () => SUCCESS_CODES

/**
 * Creates a callback that can be used to log the stuff we're interested
 * in and converts the response/error into a promise.
 *
 * @private
 * @param {Object} context
 * @param {function} transformer
 * @returns {function}
 */
function createCallbackToPromiseConverter (context, transformer, loggingFields = {}) {
  const defer = context.defer

  return (error, response, body) => {
    requestLogger.logRequestEnd(context, loggingFields)

    if (error) {
      requestLogger.logRequestError(context, error, loggingFields)
      defer.reject({ error: error })
    } else if (response && SUCCESS_CODES.includes(response.statusCode)) {
      if (body && typeof transformer === 'function') {
        defer.resolve(transformer(body))
      } else {
        defer.resolve(body)
      }
    } else {
      requestLogger.logRequestFailure(context, response, loggingFields)
      defer.reject({
        errorCode: response.statusCode,
        message: response.body
      })
    }
  }
}
