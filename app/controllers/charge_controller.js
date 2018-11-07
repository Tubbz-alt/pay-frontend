'use strict'

// npm dependencies
const logger = require('winston')
const _ = require('lodash')
const i18n = require('i18n')
const {getNamespace} = require('continuation-local-storage')
const AWSXRay = require('aws-xray-sdk')

// local dependencies
const logging = require('../utils/logging')
const responseRouter = require('../utils/response_router')
const normalise = require('../services/normalise_charge')
const chargeValidator = require('../utils/charge_validation_backend')
const Charge = require('../models/charge')
const Card = require('../models/card')
const State = require('../../config/state')
const paths = require('../paths')
const CORRELATION_HEADER = require('../utils/correlation_header').CORRELATION_HEADER
const {countries} = require('../services/countries')
const {commonTypos} = require('../utils/email_tools')
const {withAnalyticsError, withAnalytics} = require('../utils/analytics')
const connectorClient = require('../services/clients/connector_client')

// constants
const CHARGE_VIEW = 'charge'
const CONFIRM_VIEW = 'confirm'
const AUTH_WAITING_VIEW = 'auth_waiting'
const AUTH_3DS_REQUIRED_VIEW = 'auth_3ds_required'
const AUTH_3DS_REQUIRED_OUT_VIEW = 'auth_3ds_required_out'
const AUTH_3DS_REQUIRED_HTML_OUT_VIEW = 'auth_3ds_required_html_out'
const AUTH_3DS_REQUIRED_IN_VIEW = 'auth_3ds_required_in'
const CAPTURE_WAITING_VIEW = 'capture_waiting'
const preserveProperties = ['cardholderName', 'addressLine1', 'addressLine2', 'addressCity', 'addressPostcode', 'addressCountry', 'email']
const AUTH_3DS_EPDQ_RESULTS = {
  success: 'AUTHORISED',
  declined: 'DECLINED',
  error: 'ERROR'
}
const clsXrayConfig = require('../../config/xray-cls')

function appendChargeForNewView (charge, req, chargeId) {
  const cardModel = Card(charge.gatewayAccount.cardTypes, req.headers[CORRELATION_HEADER])
  charge.withdrawalText = cardModel.withdrawalTypes.join('_')
  charge.allowedCards = cardModel.allowed
  charge.cardsAsStrings = JSON.stringify(cardModel.allowed)
  charge.corporateCardSurchargeAmountsAsStrings = JSON.stringify({
    credit: charge.gatewayAccount.corporateCreditCardSurchargeAmount,
    debit: charge.gatewayAccount.corporateDebitCardSurchargeAmount
  })
  charge.post_card_action = routeFor('create', chargeId)
  charge.id = chargeId
  charge.post_cancel_action = routeFor('cancel', chargeId)
  charge.allowWebPayments = charge.gatewayAccount.allowWebPayments
}

function routeFor (resource, chargeId) {
  return paths.generateRoute(`card.${resource}`, {chargeId: chargeId})
}

function redirect (res) {
  return {
    toAuth3dsRequired: (chargeId) => res.redirect(303, routeFor('auth3dsRequired', chargeId)),
    toAuthWaiting: (chargeId) => res.redirect(303, routeFor('authWaiting', chargeId)),
    toConfirm: (chargeId) => res.redirect(303, routeFor('confirm', chargeId)),
    toNew: (chargeId) => res.redirect(303, routeFor('new', chargeId)),
    toReturn: (chargeId) => res.redirect(303, routeFor('return', chargeId))
  }
}

function build3dsPayload (req) {
  let auth3dsPayload = {}
  const paRes = _.get(req, 'body.PaRes')
  if (!_.isUndefined(paRes)) {
    auth3dsPayload.pa_response = paRes
  }

  const providerStatus = AUTH_3DS_EPDQ_RESULTS[_.get(req, 'body.providerStatus', '')]
  if (!_.isUndefined(providerStatus)) {
    auth3dsPayload.auth_3ds_result = providerStatus
  }

  const md = _.get(req, 'body.MD')
  if (!_.isUndefined(md)) {
    auth3dsPayload.md = md
  }

  return auth3dsPayload
}

module.exports = {
  new: (req, res) => {
    const charge = normalise.charge(req.chargeData, req.chargeId)
    appendChargeForNewView(charge, req, charge.id)
    charge.countries = countries
    if (charge.status === State.ENTERING_CARD_DETAILS) return responseRouter.response(req, res, CHARGE_VIEW, withAnalytics(charge, charge))
    Charge(req.headers[CORRELATION_HEADER]).updateToEnterDetails(charge.id).then(
      () => responseRouter.response(req, res, CHARGE_VIEW, withAnalytics(charge, charge)),
      () => responseRouter.response(req, res, 'NOT_FOUND', withAnalyticsError()))
  },
  create: (req, res) => {
    const namespace = getNamespace(clsXrayConfig.nameSpaceName)
    const clsSegment = namespace.get(clsXrayConfig.segmentKeyName)
    const charge = normalise.charge(req.chargeData, req.chargeId)
    const cardModel = Card(req.chargeData.gateway_account.card_types, req.headers[CORRELATION_HEADER])
    const chargeOptions = {email_collection_mode: charge.gatewayAccount.emailCollectionMode}
    const validator = chargeValidator(i18n.__('fieldErrors'), logger, cardModel, chargeOptions)
    let card

    normalise.addressLines(req.body)
    normalise.whitespace(req.body)

    if (charge.status === State.AUTH_READY) return redirect(res).toAuthWaiting(req.chargeId)

    AWSXRay.captureAsyncFunc('chargeValidator_verify', function (subSegment) {
      validator.verify(req)
        .catch(() => {
          subSegment.close('error')
          redirect(res).toNew(req.chargeId)
        })
        .then(data => {
          subSegment.close()
          card = data.card

          let emailTypos = false
          let emailPatch
          let userEmail

          if (
            charge.gatewayAccount.emailCollectionMode === 'OFF' ||
            (charge.gatewayAccount.emailCollectionMode === 'OPTIONAL' && (!req.body.email || req.body.email === ''))
          ) {
            emailPatch = Promise.resolve('Charge patch skipped as email collection mode was toggled off, or optional and not supplied')
          } else {
            userEmail = req.body.email
            emailPatch = Charge(req.headers[CORRELATION_HEADER]).patch(req.chargeId, 'replace', 'email', userEmail, subSegment)
            let emailChanged = false
            if (req.body.originalemail) {
              emailChanged = req.body.originalemail !== userEmail
            }
            emailTypos = commonTypos(userEmail)
            if (req.body['email-typo-sugestion']) {
              userEmail = emailChanged ? req.body.email : req.body['email-typo-sugestion']
              emailTypos = req.body['email-typo-sugestion'] !== req.body.originalemail ? commonTypos(userEmail) : null
            }
          }

          if (data.validation.hasError || emailTypos) {
            if (emailTypos) {
              data.validation.hasError = true
              data.validation.errorFields.push({
                cssKey: 'email-typo',
                value: i18n.__('fieldErrors.fields.email.typo')
              })
              data.validation.typos = emailTypos
              data.validation.originalEmail = userEmail
            }
            charge.countries = countries
            appendChargeForNewView(charge, req, charge.id)
            _.merge(data.validation, withAnalytics(charge, charge), _.pick(req.body, preserveProperties))
            return responseRouter.response(req, res, CHARGE_VIEW, data.validation)
          }
          AWSXRay.captureAsyncFunc('Charge_email_patch', function (subSegment) {
            emailPatch
              .then(() => {
                subSegment.close()
                const correlationId = req.headers[CORRELATION_HEADER] || ''
                const payload = normalise.apiPayload(req, card)
                connectorClient({correlationId}).chargeAuth({chargeId: req.chargeId, payload})
                  .then(response => {
                    switch (response.statusCode) {
                      case 202:
                      case 409:
                        logging.failedChargePost(409)
                        redirect(res).toAuthWaiting(req.chargeId)
                        break
                      case 200:
                        if (_.get(response.body, 'status') === State.AUTH_3DS_REQUIRED) {
                          redirect(res).toAuth3dsRequired(req.chargeId)
                        } else {
                          redirect(res).toConfirm(req.chargeId)
                        }
                        break
                      case 500:
                        logging.failedChargePost(409)
                        responseRouter.response(req, res, 'SYSTEM_ERROR', withAnalytics(charge, {returnUrl: routeFor('return', charge.id)}))
                        break
                      default:
                        redirect(res).toNew(req.chargeId)
                    }
                  })
              })
              .catch(err => {
                subSegment.close(err.message)
                logging.failedChargePatch(err.message)
                responseRouter.response(req, res, 'ERROR', withAnalyticsError())
              })
          }, clsSegment)
        })
    }, clsSegment)
  },
  createPaymentRequest: (req, res) => {
    const namespace = getNamespace(clsXrayConfig.nameSpaceName)
    const clsSegment = namespace.get(clsXrayConfig.segmentKeyName)
    const charge = normalise.charge(req.chargeData, req.chargeId)

    const convertedPayload = {
      body: {
        cardNo: req.body.details.cardNumber,
        cvc: req.body.details.cardSecurityCode,
        expiryMonth: req.body.details.expiryMonth,
        expiryYear: req.body.details.expiryYear,
        cardholderName: req.body.details.cardholderName,
        addressLine1: req.body.details.billingAddress.addressLine[0],
        addressLine2: req.body.details.billingAddress.addressLine[1] || '',
        addressCity: req.body.details.billingAddress.city,
        addressPostcode: req.body.details.billingAddress.postalCode,
        addressCountry: req.body.details.billingAddress.country
      }
    }

    if (charge.status === State.AUTH_READY) return redirect(res).toAuthWaiting(req.chargeId)

    AWSXRay.captureAsyncFunc('Charge_patch', function (subSegment) {
      Charge(req.headers[CORRELATION_HEADER]).patch(req.chargeId, 'replace', 'email', req.body.payerEmail, subSegment)
        .then(() => {
          subSegment.close()
          const correlationId = req.headers[CORRELATION_HEADER] || ''
          const payload = normalise.apiPayload(_.merge(req, convertedPayload), 'visa')
          connectorClient({correlationId}).chargeAuth({chargeId: req.chargeId, payload}).then(response => {
            switch (response.statusCode) {
              case 202:
              case 409:
                logging.failedChargePost(409)
                redirect(res).toAuthWaiting(req.chargeId)
                break
              case 200:
                if (_.get(response.body, 'status') === State.AUTH_3DS_REQUIRED) {
                  redirect(res).toAuth3dsRequired(req.chargeId)
                } else {
                  Charge(req.headers[CORRELATION_HEADER])
                    .capture(req.chargeId)
                    .then(
                      () => redirect(res).toReturn(req.chargeId),
                      err => {
                        if (err.message === 'CAPTURE_FAILED') return responseRouter.response(req, res, 'CAPTURE_FAILURE', withAnalytics(charge))
                        responseRouter.response(req, res, 'SYSTEM_ERROR', withAnalytics(
                          charge,
                          {returnUrl: routeFor('return', charge.id)}
                        ))
                      }
                    )
                }
                break
              case 500:
                logging.failedChargePost(409)
                responseRouter.response(req, res, 'SYSTEM_ERROR', withAnalytics(charge, {returnUrl: routeFor('return', charge.id)}))
                break
              default:
                redirect(res).toNew(req.chargeId)
            }
          }).on('error', err => {
            subSegment.close(err)
            logging.failedChargePostException(err)
            responseRouter.response(req, res, 'ERROR', withAnalytics(charge))
          })
        })
        .catch(err => {
          subSegment.close(err)
          logging.failedChargePatch(err)
          responseRouter.response(req, res, 'ERROR', withAnalyticsError())
        })
    }, clsSegment)
  },
  checkCard: (req, res) => {
    const namespace = getNamespace(clsXrayConfig.nameSpaceName)
    const clsSegment = namespace.get(clsXrayConfig.segmentKeyName)
    AWSXRay.captureAsyncFunc('Card_checkCard', function (subSegment) {
      Card(req.chargeData.gateway_account.card_types, req.headers[CORRELATION_HEADER])
        .checkCard(normalise.creditCard(req.body.cardNo), req.chargeData.language, subSegment)
        .then(
          card => {
            subSegment.close()
            return res.json({
              accepted: true,
              type: card.type,
              corporate: card.corporate
            })
          },
          error => {
            subSegment.close(error.message)
            return res.json({'accepted': false, message: error.message})
          }
        )
    }, clsSegment)
  },
  authWaiting: (req, res) => {
    const charge = normalise.charge(req.chargeData, req.chargeId)
    switch (charge.status) {
      case (State.AUTH_READY):
      case (State.AUTH_3DS_READY):
        responseRouter.response(req, res, AUTH_WAITING_VIEW, withAnalytics(charge))
        break
      case (State.AUTH_3DS_REQUIRED):
        redirect(res).toAuth3dsRequired(req.chargeId)
        break
      default:
        redirect(res).toConfirm(req.chargeId)
    }
  },
  auth3dsHandler (req, res) {
    const charge = normalise.charge(req.chargeData, req.chargeId)
    const correlationId = req.headers[CORRELATION_HEADER] || ''
    const payload = build3dsPayload(req)
    connectorClient({correlationId}).threeDs({chargeId: charge.id, payload})
      .then(response => {
        switch (response.statusCode) {
          case 200:
          case 400:
            redirect(res).toConfirm(charge.id)
            break
          case 202:
          case 409:
            redirect(res).toAuthWaiting(charge.id)
            break
          case 500:
            responseRouter.response(req, res, 'SYSTEM_ERROR', withAnalytics(charge))
            break
          default:
            responseRouter.response(req, res, 'ERROR', withAnalytics(charge))
        }
      })
      .catch(() => {
        responseRouter.response(req, res, 'ERROR', withAnalytics(charge))
      })
  },
  auth3dsRequired: (req, res) => {
    const charge = normalise.charge(req.chargeData, req.chargeId)
    responseRouter.response(req, res, AUTH_3DS_REQUIRED_VIEW, withAnalytics(charge))
  },
  auth3dsRequiredOut: (req, res) => {
    const charge = normalise.charge(req.chargeData, req.chargeId)
    const issuerUrl = _.get(charge, 'auth3dsData.issuerUrl')
    const paRequest = _.get(charge, 'auth3dsData.paRequest')
    const md = _.get(charge, 'auth3dsData.md')
    const htmlOut = _.get(charge, 'auth3dsData.htmlOut')

    if (issuerUrl && paRequest) {
      let data = {
        issuerUrl: issuerUrl,
        paRequest: paRequest,
        threeDSReturnUrl: `${req.protocol}://${req.hostname}${paths.generateRoute('external.card.auth3dsRequiredIn', {chargeId: charge.id})}`
      }
      if (md) {
        data.md = md
      }
      responseRouter.response(req, res, AUTH_3DS_REQUIRED_OUT_VIEW, data)
    } else if (htmlOut) {
      responseRouter.response(req, res, AUTH_3DS_REQUIRED_HTML_OUT_VIEW, {
        htmlOut: Buffer.from(htmlOut, 'base64').toString('utf8')
      })
    } else {
      responseRouter.response(req, res, 'ERROR', withAnalytics(charge))
    }
  },
  auth3dsRequiredIn: (req, res) => {
    const charge = normalise.charge(req.chargeData, req.chargeId)
    responseRouter.response(req, res, AUTH_3DS_REQUIRED_IN_VIEW, {
      threeDsHandlerUrl: routeFor('auth3dsHandler', charge.id),
      paResponse: _.get(req, 'body.PaRes'),
      md: _.get(req, 'body.MD')
    })
  },
  auth3dsRequiredInEpdq: (req, res) => {
    const charge = normalise.charge(req.chargeData, req.chargeId)
    responseRouter.response(req, res, AUTH_3DS_REQUIRED_IN_VIEW, {
      threeDsHandlerUrl: routeFor('auth3dsHandler', charge.id),
      providerStatus: _.get(req, 'query.status', 'success')
    })
  },
  confirm: (req, res) => {
    const charge = normalise.charge(req.chargeData, req.chargeId)
    const confirmPath = routeFor('confirm', charge.id)
    responseRouter.response(req, res, CONFIRM_VIEW, withAnalytics(charge, {
      hitPage: routeFor('new', charge.id) + '/success',
      charge: charge,
      confirmPath: confirmPath,
      post_cancel_action: routeFor('cancel', charge.id)
    }, confirmPath))
  },
  capture: (req, res) => {
    const charge = normalise.charge(req.chargeData, req.chargeId)
    Charge(req.headers[CORRELATION_HEADER])
      .capture(req.chargeId)
      .then(
        () => redirect(res).toReturn(req.chargeId),
        err => {
          if (err.message === 'CAPTURE_FAILED') return responseRouter.response(req, res, 'CAPTURE_FAILURE', withAnalytics(charge))
          responseRouter.response(req, res, 'SYSTEM_ERROR', withAnalytics(
            charge,
            {returnUrl: routeFor('return', charge.id)}
          ))
        }
      )
  },
  captureWaiting: (req, res) => {
    const charge = normalise.charge(req.chargeData, req.chargeId)
    if (charge.status === State.CAPTURE_READY) {
      responseRouter.response(req, res, CAPTURE_WAITING_VIEW, withAnalytics(charge))
    } else {
      responseRouter.response(req, res, 'CAPTURE_SUBMITTED', withAnalytics(charge, {returnUrl: routeFor('return', charge.id)}))
    }
  },
  cancel: (req, res) => {
    const charge = normalise.charge(req.chargeData, req.chargeId)
    Charge(req.headers[CORRELATION_HEADER])
      .cancel(req.chargeId)
      .then(
        () => responseRouter.response(req, res, 'USER_CANCELLED', withAnalytics(charge, {returnUrl: routeFor('return', charge.id)})),
        () => responseRouter.response(req, res, 'SYSTEM_ERROR', withAnalytics(charge, {returnUrl: routeFor('return', charge.id)}))
      )
  }
}
