'use strict'

// Local dependencies
const charge = require('./controllers/charge_controller.js')
const threeDS = require('./controllers/three_d_secure_controller.js')
const secure = require('./controllers/secure_controller.js')
const statik = require('./controllers/static_controller.js')
const applePayMerchantValidation = require('./controllers/web-payments/apple-pay/merchant-validation-controller')
const webPaymentsMakePayment = require('./controllers/web-payments/payment-auth-request-controller')
const webPaymentsHandlePaymentResponse = require('./controllers/web-payments/handle-auth-response-controller')
const returnCont = require('./controllers/return_controller.js')
const { healthcheck } = require('./controllers/healthcheck_controller.js')
const paths = require('./paths.js')

// Express middleware
const { csrfCheck, csrfTokenGeneration } = require('./middleware/csrf.js')
const csp = require('./middleware/csp')
const actionName = require('./middleware/action_name.js')
const stateEnforcer = require('./middleware/state_enforcer.js')
const retrieveCharge = require('./middleware/retrieve_charge.js')
const resolveService = require('./middleware/resolve_service.js')
const resolveLanguage = require('./middleware/resolve_language.js')
const decryptCardData = require('./middleware/decrypt_card_data')(process.env)

// Import AB test when we need to use it
// const abTest = require('./utils/ab_test.js')
// const AB_TEST_THRESHOLD = process.env.AB_TEST_THRESHOLD

exports.paths = paths

exports.bind = function (app) {
  app.get('/healthcheck', healthcheck)

  // charges
  const card = paths.card

  const middlewareStack = [
    csrfCheck,
    csrfTokenGeneration,
    actionName,
    retrieveCharge,
    resolveLanguage,
    resolveService,
    stateEnforcer,
    decryptCardData
  ]

  app.get(card.new.path, middlewareStack, csp.cardDetails, charge.new)
  app.get(card.authWaiting.path, middlewareStack, charge.authWaiting)
  app.get(card.captureWaiting.path, middlewareStack, charge.captureWaiting)
  app.post(card.create.path, middlewareStack, charge.create)
  app.get(card.confirm.path, middlewareStack, charge.confirm)
  app.post(card.capture.path, middlewareStack, charge.capture)
  app.post(card.cancel.path, middlewareStack, charge.cancel)
  app.post(card.checkCard.path, retrieveCharge, resolveLanguage, decryptCardData, charge.checkCard)
  app.get(card.return.path, retrieveCharge, resolveLanguage, returnCont.return)

  app.get(card.auth3dsRequired.path, middlewareStack, threeDS.auth3dsRequired)
  app.get(card.auth3dsRequiredOut.path, middlewareStack, threeDS.auth3dsRequiredOut)
  app.post(card.auth3dsRequiredInEpdq.path, [retrieveCharge, resolveLanguage], threeDS.auth3dsRequiredInEpdq)
  app.get(card.auth3dsRequiredInEpdq.path, [retrieveCharge, resolveLanguage], threeDS.auth3dsRequiredInEpdq)
  app.post(card.auth3dsRequiredIn.path, [retrieveCharge, resolveLanguage], threeDS.auth3dsRequiredIn)
  app.get(card.auth3dsRequiredIn.path, [retrieveCharge, resolveLanguage], threeDS.auth3dsRequiredIn)
  app.post(card.auth3dsHandler.path, [actionName, retrieveCharge, resolveLanguage, resolveService, stateEnforcer], threeDS.auth3dsHandler)

  // Apple Pay endpoints
  app.post(paths.applePay.session.path, applePayMerchantValidation)

  // Generic Web payments endpoint
  app.post(paths.webPayments.authRequest.path, retrieveCharge, resolveLanguage, webPaymentsMakePayment)
  app.get(paths.webPayments.handlePaymentResponse.path, retrieveCharge, resolveLanguage, webPaymentsHandlePaymentResponse)

  // secure controller
  app.get(paths.secure.get.path, secure.new)
  app.post(paths.secure.post.path, secure.new)

  // static controller
  app.get(paths.static.humans.path, statik.humans)
  app.all(paths.static.naxsi_error.path, statik.naxsi_error)

  // route to gov.uk 404 page
  // this has to be the last route registered otherwise it will redirect other routes
  app.all('*', (req, res) => res.redirect('https://www.gov.uk/404'))
}
