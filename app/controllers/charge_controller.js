require('array.prototype.find');
var logger = require('winston');
var luhn = require('luhn');

var Client = require('node-rest-client').Client;
var response = require('../utils/response.js').response;
var client = new Client();

module.exports.bindRoutesTo = function(app) {
  var CHARGE_PATH = '/charge';
  var CONFIRM_PATH = '/confirm';
  var CARD_DETAILS_PATH = '/card_details';

  var CHARGE_VIEW = 'charge';
  var ERROR_VIEW = 'error';

  var REQUIRED_FORM_FIELDS = {
    'cardNo': 'Card number',
    'cvc': 'CVC',
    'expiryDate': 'Expiry date',
    'cardholderName': 'Name on card',
    'addressLine1': 'Building name/number and street',
    'addressPostcode': 'Postcode'
  };

  app.get(CHARGE_PATH + '/:chargeId', function(req, res) {
    logger.info('GET ' + CHARGE_PATH + '/:chargeId');

    req.session_state.chargeId = req.params.chargeId;

    res.redirect(303, CARD_DETAILS_PATH);
  });

  app.get(CARD_DETAILS_PATH, function(req, res) {
    var chargeId = req.session_state.chargeId

    var connectorUrl = process.env.CONNECTOR_URL.replace('{chargeId}', chargeId);

    client.get(connectorUrl, function(connectorData, connectorResponse) {

      if(connectorResponse.statusCode === 200) {
        logger.info('connector data = ', connectorData);
        var uiAmount = (connectorData.amount / 100).toFixed(2);
        var authLink = findLinkForRelation(connectorData.links, 'cardAuth');

        req.session_state.cardAuthUrl = authLink.href;

        response(req.headers.accept, res, CHARGE_VIEW, {
          'amount' : uiAmount,
          'service_url' : connectorData.service_url,
          'post_card_action' : CARD_DETAILS_PATH
        });
        return;
      }

      renderErrorView(req,res, 'There is a problem with the payments platform');
    }).on('error', function(err) {
      logger.error('Exception raised calling connector: ' + err);
      response(req.headers.accept, res, ERROR_VIEW, {
        'message': 'There is a problem with the payments platform'
      });
    });

  });

  app.post(CARD_DETAILS_PATH, function(req, res) {
    logger.info('POST ' + CARD_DETAILS_PATH);
    var chargeId = req.session_state.chargeId

    var checkResult = validateNewCharge(req.body);
    if (checkResult.hasError) {
      renderErrorView(req, res, checkResult.errorMessage);
      return;
    }

    var payload = {
      headers:{"Content-Type": "application/json"},
      data: {
        'card_number': cleanCardNumber(req.body.cardNo),
        'cvc': req.body.cvc,
        'expiry_date': req.body.expiryDate,
        'cardholder_name': req.body.cardholderName,
        'address': addressFrom(req.body)
      }
    };

    var cardAuthUrl = req.session_state.cardAuthUrl

    client.post(cardAuthUrl, payload, function(data, connectorResponse) {

      if(connectorResponse.statusCode === 204) {
        res.redirect(303, CARD_DETAILS_PATH + '/' + chargeId + CONFIRM_PATH);
        return;
      }

      renderErrorView(req,res, 'Payment could not be processed, please contact your issuing bank');
    }).on('error', function(err) {
      logger.error('Exception raised calling connector');
      response(req.headers.accept, res, ERROR_VIEW, {
        'message': 'There is a problem with the payments platform'
      });
    });
  });

  function findLinkForRelation(links, rel) {
    return links.find(function(link) {
      return link.rel === rel;
    });
  }

  function validateNewCharge(body) {
    var checkResult = {
      hasError: false,
      errorMessage: "The following fields are required:\n"
    };
    for (var key in REQUIRED_FORM_FIELDS) {
      if (!body[key]) {
        checkResult.hasError = true;
        checkResult.errorMessage += "* " + REQUIRED_FORM_FIELDS[key] + "\n";
      }
    }
    if (body['cardNo']) {
      if (!luhn.validate(body.cardNo)) {
        checkResult.hasError = true;
        checkResult.errorMessage = "You probably mistyped the card number. Please check and try again."
      }
    }

    return checkResult
  }

  function cleanCardNumber(cardNumber) {
    return cardNumber.replace(/\s/g, "")
  }

  function renderErrorView(req, res, msg) {
    logger.error('An error occurred: ' + msg);
    response(req.headers.accept, res, ERROR_VIEW, {
      'message': msg
    });
  }

  function addressFrom(body) {
    return {
      'line1': body.addressLine1,
      'line2': body.addressLine2,
      'line3': body.addressLine3,
      'city': body.addressCity,
      'county': body.addressCounty,
      'postcode': body.addressPostcode,
      'country': 'GB'
    };
  }
};
