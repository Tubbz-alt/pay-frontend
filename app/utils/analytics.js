var _ = require('lodash');

const ANALYTICS_ERROR = {
  analytics: {
    analyticsId: "Service unavailable",
    type: "Service unavailable",
    paymentProvider: "Service unavailable"
  }
};

module.exports = function () {
  'use strict';

  var withAnalytics = function(charge, param) {
    return _.merge(
        {
          analytics: {
            analyticsId: charge.gatewayAccount.analyticsId,
            type: charge.gatewayAccount.type,
            paymentProvider: charge.gatewayAccount.paymentProvider
          }}, param);
  };
  return {
    ANALYTICS_ERROR: ANALYTICS_ERROR,
    withAnalytics: withAnalytics
  };
}();

