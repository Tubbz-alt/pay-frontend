require('array.prototype.find');
var logger = require('winston');
var luhn = require('luhn');

var Client = require('node-rest-client').Client;
var client = new Client();

var response = require('../utils/response.js').response;

var ERROR_MESSAGE = require('../utils/response.js').ERROR_MESSAGE;
var ERROR_VIEW = require('../utils/response.js').ERROR_VIEW;
var PAGE_NOT_FOUND_ERROR_MESSAGE = require('../utils/response.js').PAGE_NOT_FOUND_ERROR_MESSAGE;
var renderErrorView = require('../utils/response.js').renderErrorView;
var renderErrorViewWithReturnUrl = require('../utils/response.js').renderErrorViewWithReturnUrl;
var hashOutCardNumber = require('../utils/charge_utils.js').hashOutCardNumber;
var ENTERING_CARD_DETAILS_STATUS = 'ENTERING CARD DETAILS';


module.exports.bindRoutesTo = function (app) {
    var CONFIRM_PATH = '/confirm';
    var CONFIRMED_PATH = '/confirmed';
    var CARD_DETAILS_PATH = '/card_details';

    var CHARGE_VIEW = 'charge';
    var CONFIRM_VIEW = 'confirm';

    var REQUIRED_FORM_FIELDS = {
        'cardNo': 'Card number',
        'cvc': 'CVC',
        'expiryDate': 'Expiry date',
        'cardholderName': 'Name on card',
        'addressLine1': 'Building name/number and street',
        'addressPostcode': 'Postcode'
    };

    var UPDATE_STATUS_PAYLOAD = {
        headers: {"Content-Type": "application/json"},
        data: {'new_status': ENTERING_CARD_DETAILS_STATUS}
    };

    function createChargeIdSessionKey(chargeId) {
        return 'ch_' + chargeId;
    }

    function chargeState(req, chargeId) {
        return req.session_state[createChargeIdSessionKey(chargeId)];
    }

    function validChargeIdInTheRequest(req, res, chargeId) {
        if (!chargeId) {
            logger.error('Unexpected: chargeId was not found in request.');
            response(req.headers.accept, res, ERROR_VIEW, {
                'message': ERROR_MESSAGE
            });
            return false;
        }

        return true;
    }

    function validChargeIdOnTheSession(req, res, chargeId) {
        if (!req.session_state[createChargeIdSessionKey(chargeId)]) {
            logger.error('Unexpected: chargeId=' + chargeId + ' could not be found on the session');
            response(req.headers.accept, res, ERROR_VIEW, {
                'message': ERROR_MESSAGE
            });
            return false;
        }

        return true;
    }

    app.get(CARD_DETAILS_PATH + '/:chargeId', function (req, res) {
        logger.info('GET ' + CARD_DETAILS_PATH + '/:chargeId');
        var chargeId = req.params.chargeId;
        if (!validChargeIdInTheRequest(req, res, chargeId) || !validChargeIdOnTheSession(req, res, chargeId)) {
            return;
        }
        var connectorUrl = process.env.CONNECTOR_URL.replace('{chargeId}', chargeId);
        logger.info("connectorUrl from env var: " + connectorUrl);

        //update charge status to 'ENTERING CARD DETAILS' {chargeId}/status/{newStatus}
        client.put(connectorUrl + '/status', UPDATE_STATUS_PAYLOAD, function(data, putResponse) {
            logger.debug('set charge status to: '+ ENTERING_CARD_DETAILS_STATUS);
            logger.debug('response from the connector=' + putResponse.statusCode);

            if (putResponse.statusCode === 204) {
                getChargeAndBuildResponse(chargeId, req, res);
                return;
            }
            logger.error('Failed to update charge status to ' +ENTERING_CARD_DETAILS_STATUS+ ', response code from connector=' + putResponse.statusCode);
            response(req.headers.accept, res.status(404), ERROR_VIEW, {
                'message': PAGE_NOT_FOUND_ERROR_MESSAGE
            });
        })
        .on('error', function(err) {
            logger.error('Exception raised calling connector for put' + err);
            response(req.headers.accept, res, ERROR_VIEW, {
              'message': ERROR_MESSAGE
            });
        });
    });

    function getCharge(chargeId, req, res) {
        //now get the charge
        var connectorUrl = process.env.CONNECTOR_URL.replace('{chargeId}', chargeId);
        client.get(connectorUrl, function (connectorData, connectorResponse) {
            if (connectorResponse.statusCode === 200) {
                logger.info('connector data = ', connectorData);
                if (connectorData.status != enteringCardDetailsStatus) {
                    response(req.headers.accept, res.status(404), ERROR_VIEW, {
                        'message': PAGE_NOT_FOUND_ERROR_MESSAGE
                    });
                    return;
                }
                var amountInPence = connectorData.amount;
                var uiAmount = (amountInPence / 100).toFixed(2);
                var chargeSession = chargeState(req, chargeId);
                chargeSession.amount = amountInPence;

                response(req.headers.accept, res, CHARGE_VIEW, {
                    'charge_id': chargeId,
                    'amount': uiAmount,
                    'return_url': connectorData.return_url,
                    'post_card_action': CARD_DETAILS_PATH
                });
                return;
            }
            renderErrorView(req, res, ERROR_MESSAGE);
        })
        .on('error', function (err) {
            logger.error('Exception raised calling connector for get: ' + err);
            response(req.headers.accept, res, ERROR_VIEW, {
                'message': ERROR_MESSAGE
            });
        });
    }

    app.post(CARD_DETAILS_PATH, function (req, res) {
        logger.info('POST ' + CARD_DETAILS_PATH);
        var chargeId = req.body.chargeId;
        if (!validChargeIdInTheRequest(req, res, chargeId) || !validChargeIdOnTheSession(req, res, chargeId)) {
            return;
        }
        var checkResult = validateNewCharge(normaliseAddress(req.body));
        if (checkResult.hasError) {
            checkResult.charge_id = chargeId;
            logger.info('post errors: '+JSON.stringify(checkResult, null, 2));
            response(req.headers.accept, res, CHARGE_VIEW, checkResult);
            return;
        }

        var plainCardNumber = removeWhitespaces(req.body.cardNo);
        var expiryDate = req.body.expiryDate;
        var payload = {
            headers: {"Content-Type": "application/json"},
            data: {
                'card_number': plainCardNumber,
                'cvc': req.body.cvc,
                'expiry_date': expiryDate,
                'cardholder_name': req.body.cardholderName,
                'address': addressFrom(req.body)
            }
        };

        var connectorUrl = process.env.CONNECTOR_URL.replace('{chargeId}', chargeId);
        client.get(connectorUrl, function (chargeData, chargeResponse) {
            var authLink = findLinkForRelation(chargeData.links, 'cardAuth');
            var cardAuthUrl = authLink.href;

            client.post(cardAuthUrl, payload, function (data, connectorResponse) {

                if (connectorResponse.statusCode === 204) {
                    var chargeSession = chargeState(req, chargeId);
                    chargeSession.cardNumber = hashOutCardNumber(plainCardNumber);
                    chargeSession.expiryDate = expiryDate;
                    chargeSession.cardholderName = req.body.cardholderName;
                    chargeSession.address = buildAddressLine(req.body);
                    chargeSession.serviceName = "Demo Service";
                    res.redirect(303, CARD_DETAILS_PATH + '/' + chargeId + CONFIRM_PATH);
                    return;
                }

                renderErrorView(req, res, 'Payment could not be processed, please contact your issuing bank');
            }).on('error', function (err) {
                logger.error('Exception raised calling connector: ' + err);
                response(req.headers.accept, res, ERROR_VIEW, {
                    'message': ERROR_MESSAGE
                });
            });
        }).on('error', function (err) {
            logger.error('Exception raised calling connector: ' + err);
            response(req.headers.accept, res, ERROR_VIEW, {
                'message': ERROR_MESSAGE
            });
        });
    });

    app.get(CARD_DETAILS_PATH + '/:chargeId' + CONFIRM_PATH, function (req, res) {

        logger.info('GET ' + CARD_DETAILS_PATH + '/:chargeId' + CONFIRM_PATH);

        var chargeId = req.params.chargeId;

        if (!validChargeIdInTheRequest(req, res, chargeId) || !validChargeIdOnTheSession(req, res, chargeId)) {
            return;
        }

        var chargeSession = chargeState(req, chargeId);

        if (!('amount' in chargeSession) || !('expiryDate' in chargeSession) || !('cardNumber' in chargeSession) || !('cardholderName' in chargeSession) || !('address' in chargeSession) || !('serviceName' in chargeSession)) {
            renderErrorView(req, res, 'Session expired');
            return;
        }

        var connectorUrl = process.env.CONNECTOR_URL.replace('{chargeId}', chargeId);
        client.get(connectorUrl, function (connectorData, connectorResponse) {
            if (connectorResponse.statusCode === 200) {
                if (connectorData.status != 'AUTHORISATION SUCCESS') {
                    response(req.headers.accept, res.status(404), ERROR_VIEW, {
                        'message': PAGE_NOT_FOUND_ERROR_MESSAGE
                    });
                    return;
                }

                var amountInPence = chargeSession.amount;
                var uiAmount = (amountInPence / 100).toFixed(2);

                response(req.headers.accept, res, CONFIRM_VIEW, {
                    'charge_id': chargeId,
                    'amount': uiAmount,
                    'expiryDate': chargeSession.expiryDate,
                    'cardNumber': chargeSession.cardNumber,
                    'cardholderName': chargeSession.cardholderName,
                    'address': chargeSession.address,
                    'serviceName': chargeSession.serviceName,
                    'backUrl': CARD_DETAILS_PATH + '/' + req.params.chargeId,
                    'confirmUrl': CARD_DETAILS_PATH + '/' + req.params.chargeId + CONFIRM_PATH
                });
            }
        });

    });

    app.post(CARD_DETAILS_PATH + '/:chargeId' + CONFIRM_PATH, function (req, res) {

        logger.info('POST ' + CARD_DETAILS_PATH + '/:chargeId' + CONFIRM_PATH);

        var chargeId = req.params.chargeId;

        if (!validChargeIdInTheRequest(req, res, chargeId) || !validChargeIdOnTheSession(req, res, chargeId)) {
            return;
        }

        var connectorUrl = process.env.CONNECTOR_URL.replace('{chargeId}', chargeId);
        client.get(connectorUrl, function (chargeData, chargeResponse) {
            if (chargeResponse.statusCode === 200) {
                var captureLink = findLinkForRelation(chargeData.links, 'cardCapture');
                var cardCaptureUrl = captureLink.href;

                var payload = {headers: {"Content-Type": "application/json"}, data: {}};
                client.post(cardCaptureUrl, payload, function (data, connectorResponse) {
                    switch (connectorResponse.statusCode) {
                        case 204:
                            res.redirect(303, CARD_DETAILS_PATH + '/' + req.params.chargeId + CONFIRMED_PATH);
                            return;
                        case 500:
                            renderErrorViewWithReturnUrl(
                                req,
                                res,
                                'There was a problem processing your payment. Please contact the service.',
                                chargeData.return_url
                            );
                            return;
                    }

                    renderErrorView(req, res, ERROR_MESSAGE);
                }).on('error', function (err) {
                    logger.error('Exception raised calling connector: ' + err);
                    response(req.headers.accept, res, ERROR_VIEW, {
                        'message': ERROR_MESSAGE
                    });
                });
                return;
            }
            renderErrorView(req, res, ERROR_MESSAGE);
        }).on('error', function (err) {
            logger.error('Exception raised calling connector: ' + err);
            response(req.headers.accept, res, ERROR_VIEW, {
                'message': ERROR_MESSAGE
            });
        });
    });

    app.get(CARD_DETAILS_PATH + '/:chargeId' + CONFIRMED_PATH, function (req, res) {
        res.send("The payment has been confirmed. :)");
    });

    function getChargeAndBuildResponse(chargeId, req, res) {
        //now get the charge
        var connectorUrl = process.env.CONNECTOR_URL.replace('{chargeId}', chargeId);
        client.get(connectorUrl, function (connectorData, connectorResponse) {
            if (connectorResponse.statusCode === 200) {
                logger.info('connector data = ', connectorData);
                if (connectorData.status != ENTERING_CARD_DETAILS_STATUS) {
                    response(req.headers.accept, res.status(404), ERROR_VIEW, {
                        'message': PAGE_NOT_FOUND_ERROR_MESSAGE
                    });
                    return;
                }
                var amountInPence = connectorData.amount;
                var uiAmount = (amountInPence / 100).toFixed(2);
                var chargeSession = chargeState(req, chargeId);
                chargeSession.amount = amountInPence;

                response(req.headers.accept, res, CHARGE_VIEW, {
                    'charge_id': chargeId,
                    'amount': uiAmount,
                    'return_url': connectorData.return_url,
                    'post_card_action': CARD_DETAILS_PATH
                });
                return;
            }
            renderErrorView(req, res, ERROR_MESSAGE);
        })
        .on('error', function (err) {
            logger.error('Exception raised calling connector for get: ' + err);
            response(req.headers.accept, res, ERROR_VIEW, {
                'message': ERROR_MESSAGE
            });
        });
    }

    function findLinkForRelation(links, rel) {
        return links.find(function (link) {
            return link.rel === rel;
        });
    }

    function validateNewCharge(body) {
        var checkResult = {
            hasError: false,
            errorMessage: "The following fields are required:"
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

    function removeWhitespaces(s) {
        return s.replace(/\s/g, "")
    }

    function normaliseAddress(body) {
        if (!body.addressLine1 && body.addressLine2) {
            body.addressLine1 = body.addressLine2;
            delete body.addressLine2;
        }
        return body;
    }

    function addressFrom(body) {
        return {
            'line1': body.addressLine1,
            'line2': body.addressLine2,
            'city': body.addressCity,
            'county': body.addressCounty,
            'postcode': body.addressPostcode,
            'country': 'GB'
        };
    }

    function buildAddressLine(body) {
        return [body.addressLine1,
            body.addressLine2,
            body.addressCity,
            body.addressCounty,
            body.addressPostcode].filter(notNullOrEmpty).join(", ");
    }

    function notNullOrEmpty(str) {
        return str;
    }
}
