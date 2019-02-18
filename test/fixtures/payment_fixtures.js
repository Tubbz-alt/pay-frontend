// @TODO(sfount) split payment charge requests from service request
// @TODO(sfount) allow tests to override IDs or names they would expect from stubs
// @TODO(sfount) a lot of duplication between initial charge created and status updates
// token is be88a908-3b99-4254-9807-c855d53f6b2b
// Order
// -> visits secure/:uuid
// 1. valid charge token created
//    /v1/frontend/tokens/:uuid/charge
const fixtures = {

  // GET to http://connector:9300/v1/frontend/tokens/be88a908-3b99-4254-9807-c855d53f6b2b/charge
  validChargeCreatedByToken: () => {
    const data = {
      'amount': 1000,
      'cardDetails': null,
      'corporateSurcharge': null,
      'createdDate': 1549994011.307, // is this needed?
      'delayedCapture': false,
      'description': 'Example fixture payment',
      'email': null,
      'events': [
        {
          'gatewayEventDate': null,
          'status': 'CREATED',
          'updated': 1549994011.309, // will this need to be dynamically set?
          'version': 1
        }
      ],
      'externalId': 'ub8de8r5mh4pb49rgm1ismaqfv',
      'gatewayAccount': {
        'allowWebPayments': false,
        'allow_apple_pay': false,
        'allow_google_pay': false,
        'analytics_id': null,
        'card_types': [
          {
            'brand': 'visa',
            'id': 'b9dae820-0d11-4280-b8bb-6a3a320b7e7a',
            'label': 'Visa',
            'requires3ds': false,
            'type': 'DEBIT'
          },
          {
            'brand': 'visa',
            'id': 'b2c53a34-8566-4050-963f-7f20b43f3650',
            'label': 'Visa',
            'requires3ds': false,
            'type': 'CREDIT'
          },
          {
            'brand': 'master-card',
            'id': 'e33c7b30-f2f5-4d9d-ac00-a61d598d353e',
            'label': 'Mastercard',
            'requires3ds': false,
            'type': 'DEBIT'
          },
          {
            'brand': 'master-card',
            'id': 'f9adcba5-3c8e-4bbb-bb29-3d8f1cf152fc',
            'label': 'Mastercard',
            'requires3ds': false,
            'type': 'CREDIT'
          },
          {
            'brand': 'american-express',
            'id': '9cb3f107-391b-4ca9-a42e-27e8a0b277a2',
            'label': 'American Express',
            'requires3ds': false,
            'type': 'CREDIT'
          },
          {
            'brand': 'diners-club',
            'id': 'c36f5a66-ce27-462f-a971-76783eed40e7',
            'label': 'Diners Club',
            'requires3ds': false,
            'type': 'CREDIT'
          },
          {
            'brand': 'discover',
            'id': 'e0f2590d-219f-4627-b693-43fa8bb41583',
            'label': 'Discover',
            'requires3ds': false,
            'type': 'CREDIT'
          },
          {
            'brand': 'jcb',
            'id': '45714fbd-ca7b-4900-9777-084fe5b223be',
            'label': 'Jcb',
            'requires3ds': false,
            'type': 'CREDIT'
          },
          {
            'brand': 'unionpay',
            'id': 'acd5ca07-d27d-43b6-9e2a-bb42699dc644',
            'label': 'Union Pay',
            'requires3ds': false,
            'type': 'CREDIT'
          }
        ],
        'corporate_credit_card_surcharge_amount': 0, // are these needed?
        'corporate_debit_card_surcharge_amount': 0,
        'corporate_prepaid_credit_card_surcharge_amount': 0,
        'corporate_prepaid_debit_card_surcharge_amount': 0,
        'email_collection_mode': 'MANDATORY',
        'email_notifications': {
          'PAYMENT_CONFIRMED': {
            'enabled': true,
            'template_body': null,
            'version': 1
          },
          'REFUND_ISSUED': {
            'enabled': true,
            'template_body': null,
            'version': 1
          }
        },
        'gateway_account_id': 6,
        'gateway_merchant_id': null,
        'live': false,
        'notifySettings': null,
        'payment_provider': 'sandbox',
        'requires3ds': false,
        'service_name': 'My service',
        'type': 'test',
        'version': 1
      },
      'gatewayTransactionId': null,
      'language': 'ENGLISH',
      'paymentGatewayName': 'SANDBOX',
      'providerSessionId': null,
      'reference': 'my payment reference',
      'refunds': [],
      'returnUrl': 'https://www.payments.service.gov.uk',
      'status': 'CREATED',
      'version': 1,
      'walletType': null
    }
    return data
  },

  // DELETE to http://connector:9300/v1/frontend/tokens/be88a908-3b99-4254-9807-c855d53f6b2b
  // should return 204
  validDeleteToken: () => {
    // returns a valid repsonse with no body
    return undefined
  },

  // GET to http://connector:9300/v1/frontend/charges/ub8de8r5mh4pb49rgm1ismaqfv
  validInitialCharge: () => {
    const data = {
      'amount': 1000,
      'state': {
        'finished': false,
        'status': 'created'
      },
      'description': 'my payment',
      'language': 'en',
      'status': 'CREATED',
      'links': [
        {
          'rel': 'self',
          'method': 'GET',
          'href': 'https://connector:9300/v1/frontend/charges/ub8de8r5mh4pb49rgm1ismaqfv'
        },
        {
          'rel': 'cardAuth',
          'method': 'POST',
          'href': 'https://connector:9300/v1/frontend/charges/ub8de8r5mh4pb49rgm1ismaqfv/cards'
        },
        {
          'rel': 'cardCapture',
          'method': 'POST',
          'href': 'https://connector:9300/v1/frontend/charges/ub8de8r5mh4pb49rgm1ismaqfv/capture'
        }
      ],
      'charge_id': 'ub8de8r5mh4pb49rgm1ismaqfv',
      'return_url': 'https://www.payments.service.gov.uk',
      'created_date': '2019-02-12T17:53:31.307Z',
      'delayed_capture': false,
      'gateway_account': {
        'version': 1,
        'requires3ds': false,
        'allowWebPayments': false,
        'notifySettings': null,
        'live': false,
        'gateway_account_id': 6,
        'payment_provider': 'sandbox',
        'type': 'test',
        'service_name': 'My service',
        'analytics_id': null,
        'allow_google_pay': false,
        'allow_apple_pay': false,
        'corporate_prepaid_credit_card_surcharge_amount': 0,
        'corporate_prepaid_debit_card_surcharge_amount': 0,
        'email_notifications': {
          'REFUND_ISSUED': {
            'version': 1,
            'enabled': true,
            'template_body': null
          },
          'PAYMENT_CONFIRMED': {
            'version': 1,
            'enabled': true,
            'template_body': null
          }
        },
        'email_collection_mode': 'MANDATORY',
        'card_types': [
          {
            'id': 'b9dae820-0d11-4280-b8bb-6a3a320b7e7a',
            'brand': 'visa',
            'label': 'Visa',
            'type': 'DEBIT',
            'requires3ds': false
          },
          {
            'id': 'b2c53a34-8566-4050-963f-7f20b43f3650',
            'brand': 'visa',
            'label': 'Visa',
            'type': 'CREDIT',
            'requires3ds': false
          },
          {
            'id': 'e33c7b30-f2f5-4d9d-ac00-a61d598d353e',
            'brand': 'master-card',
            'label': 'Mastercard',
            'type': 'DEBIT',
            'requires3ds': false
          },
          {
            'id': 'f9adcba5-3c8e-4bbb-bb29-3d8f1cf152fc',
            'brand': 'master-card',
            'label': 'Mastercard',
            'type': 'CREDIT',
            'requires3ds': false
          },
          {
            'id': '9cb3f107-391b-4ca9-a42e-27e8a0b277a2',
            'brand': 'american-express',
            'label': 'American Express',
            'type': 'CREDIT',
            'requires3ds': false
          },
          {
            'id': 'c36f5a66-ce27-462f-a971-76783eed40e7',
            'brand': 'diners-club',
            'label': 'Diners Club',
            'type': 'CREDIT',
            'requires3ds': false
          },
          {
            'id': 'e0f2590d-219f-4627-b693-43fa8bb41583',
            'brand': 'discover',
            'label': 'Discover',
            'type': 'CREDIT',
            'requires3ds': false
          },
          {
            'id': '45714fbd-ca7b-4900-9777-084fe5b223be',
            'brand': 'jcb',
            'label': 'Jcb',
            'type': 'CREDIT',
            'requires3ds': false
          },
          {
            'id': 'acd5ca07-d27d-43b6-9e2a-bb42699dc644',
            'brand': 'unionpay',
            'label': 'Union Pay',
            'type': 'CREDIT',
            'requires3ds': false
          }
        ],
        'gateway_merchant_id': null,
        'corporate_credit_card_surcharge_amount': 0,
        'corporate_debit_card_surcharge_amount': 0
      }
    }

    return data
  },

  putValidInitialChargeUpdate: () => {
    return undefined
  },

  // GET to http://adminusers:9700/v1/api/services
  // likely qs = ?external_id=
  // @TODO(sfount) all requests that are related to services should use this
  validInitialService: () => {
    const data = {
      'id': 6,
      'external_id': 'c0e046482d034c2e8392e543d5f4914e',
      'name': 'System Generated',
      'gateway_account_ids': [
        '6'
      ],
      '_links': [
        {
          'rel': 'self',
          'method': 'GET',
          'href': 'http://localhost:8080/v1/api/services/c0e046482d034c2e8392e543d5f4914e'
        }
      ],
      'service_name': {
        'en': 'System Generated'
      },
      'redirect_to_service_immediately_on_terminal_state': false,
      'collect_billing_address': true,
      'current_go_live_stage': 'NOT_STARTED'
    }
    return data
  },

  // update service status - what does it actually send in this case? - shouldn't matter
  // PUT to http://connector:9300/v1/frontend/charges/ub8de8r5mh4pb49rgm1ismaqfv/status
  // no body
  // status code 204
  validUpdateInitialCharge: () => {
    return undefined
  },

  // @TODO(sfount) a huge amount of this is duplicated between the first charge request and the second
  validEnteringCardDetailsCharge: () => {
    const data = {
      'amount': 1000,
      'state': {
        'finished': false,
        'status': 'started'
      },
      'description': 'my payment',
      'language': 'en',
      'status': 'ENTERING CARD DETAILS',
      'links': [
        {
          'rel': 'self',
          'method': 'GET',
          'href': 'https://connector:9300/v1/frontend/charges/qon9unbgccbemeuo7kr1hb66c5'
        },
        {
          'rel': 'cardAuth',
          'method': 'POST',
          'href': 'https://connector:9300/v1/frontend/charges/qon9unbgccbemeuo7kr1hb66c5/cards'
        },
        {
          'rel': 'cardCapture',
          'method': 'POST',
          'href': 'https://connector:9300/v1/frontend/charges/qon9unbgccbemeuo7kr1hb66c5/capture'
        }
      ],
      'charge_id': 'qon9unbgccbemeuo7kr1hb66c5',
      'return_url': 'https://www.payments.service.gov.uk',
      'created_date': '2019-02-13T13:13:28.153Z',
      'delayed_capture': false,
      'gateway_account': {
        'version': 1,
        'requires3ds': false,
        'allowWebPayments': false,
        'notifySettings': null,
        'live': false,
        'gateway_account_id': 9,
        'payment_provider': 'sandbox',
        'type': 'test',
        'service_name': 'My service',
        'analytics_id': null,
        'allow_google_pay': false,
        'allow_apple_pay': false,
        'corporate_prepaid_credit_card_surcharge_amount': 0,
        'corporate_prepaid_debit_card_surcharge_amount': 0,
        'email_notifications': {
          'REFUND_ISSUED': {
            'version': 1,
            'enabled': true,
            'template_body': null
          },
          'PAYMENT_CONFIRMED': {
            'version': 1,
            'enabled': true,
            'template_body': null
          }
        },
        'email_collection_mode': 'MANDATORY',
        'card_types': [
          {
            'id': 'b9dae820-0d11-4280-b8bb-6a3a320b7e7a',
            'brand': 'visa',
            'label': 'Visa',
            'type': 'DEBIT',
            'requires3ds': false
          },
          {
            'id': 'b2c53a34-8566-4050-963f-7f20b43f3650',
            'brand': 'visa',
            'label': 'Visa',
            'type': 'CREDIT',
            'requires3ds': false
          },
          {
            'id': 'e33c7b30-f2f5-4d9d-ac00-a61d598d353e',
            'brand': 'master-card',
            'label': 'Mastercard',
            'type': 'DEBIT',
            'requires3ds': false
          },
          {
            'id': 'f9adcba5-3c8e-4bbb-bb29-3d8f1cf152fc',
            'brand': 'master-card',
            'label': 'Mastercard',
            'type': 'CREDIT',
            'requires3ds': false
          },
          {
            'id': '9cb3f107-391b-4ca9-a42e-27e8a0b277a2',
            'brand': 'american-express',
            'label': 'American Express',
            'type': 'CREDIT',
            'requires3ds': false
          },
          {
            'id': 'c36f5a66-ce27-462f-a971-76783eed40e7',
            'brand': 'diners-club',
            'label': 'Diners Club',
            'type': 'CREDIT',
            'requires3ds': false
          },
          {
            'id': 'e0f2590d-219f-4627-b693-43fa8bb41583',
            'brand': 'discover',
            'label': 'Discover',
            'type': 'CREDIT',
            'requires3ds': false
          },
          {
            'id': '45714fbd-ca7b-4900-9777-084fe5b223be',
            'brand': 'jcb',
            'label': 'Jcb',
            'type': 'CREDIT',
            'requires3ds': false
          },
          {
            'id': 'acd5ca07-d27d-43b6-9e2a-bb42699dc644',
            'brand': 'unionpay',
            'label': 'Union Pay',
            'type': 'CREDIT',
            'requires3ds': false
          }
        ],
        'gateway_merchant_id': null,
        'corporate_credit_card_surcharge_amount': 0,
        'corporate_debit_card_surcharge_amount': 0
      }
    }
    return data
  },

  validCardDetails: () => {
    const data = {
      'brand': 'visa',
      'type': 'C',
      'label': 'VISA CREDIT',
      'corporate': false,
      'prepaid': 'UNKNOWN'
    }
    return data
  }
}

module.exports = fixtures
