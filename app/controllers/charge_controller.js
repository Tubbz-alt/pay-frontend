require('array.prototype.find');
var logger          = require('winston');
var luhn            = require('luhn');
var Client          = require('node-rest-client').Client;
var client          = new Client();
var views           = require('../utils/views.js');
var chargeParam     = require('../services/charge_param_retriever.js');
var normalise       = require('../services/normalise.js');
var Charge          = require('../models/charge.js');
var _               = require('lodash');
var paths           = require('../paths.js');

var hashOutCardNumber = require('../utils/charge_utils.js').hashOutCardNumber;
var ENTERING_CARD_DETAILS_STATUS = 'ENTERING CARD DETAILS';
var AUTH_SUCCESS_STATE = 'AUTHORISATION SUCCESS';
var CREATED_STATE = 'CREATED';
var CARD_NUMBER_FIELD = 'cardNo';


module.exports.bindRoutesTo = function (app) {

    var CHARGE_VIEW = 'charge';
    var CONFIRM_VIEW = 'confirm';

    var REQUIRED_FORM_FIELDS = {
        cardholderName: {
            id: 'cardholder-name',
            name: 'Name on card',
            message: 'Please enter the name as it appears on the card' },
        cardNo: {
            id: 'card-no',
            name: 'Card number',
            message: 'Please enter the long number on the front of your card' },
        cvc: {
            id: 'cvc',
            name: 'CVC',
            message: 'Please enter your card security code' },
        expiryDate: {
            id: 'expiry-date',
            name: 'Expiry date',
            message: 'Please enter a valid expiry date' },
        addressLine1: {
            id: 'address-line1',
            name: 'Building name/number and street',
            message:'Please enter your address' },
        addressPostcode: {
            id: 'address-postcode',
            name: 'Postcode',
            message: 'Please enter a valid postcode' }
    };

    var UPDATE_STATUS_PAYLOAD = {
        headers: {"Content-Type": "application/json"},
        data: {'new_status': ENTERING_CARD_DETAILS_STATUS}
    };

    function createChargeIdSessionKey(chargeId) {
        return 'ch_' + chargeId;
    }

    function chargeState(req, chargeId) {
        return req.frontend_state[createChargeIdSessionKey(chargeId)];
    }

    function validSession(chargeSession) {
        if (
            !('amount' in chargeSession) ||
            !('paymentDescription' in chargeSession) ||
            !('expiryDate' in chargeSession) ||
            !('cardNumber' in chargeSession) ||
            !('cardholderName' in chargeSession) ||
            !('address' in chargeSession) ||
            !('serviceName' in chargeSession)
        ) {
            return false;
        }
        return true;
    }

    app.get(paths.card.new, function (req, res) {
        var _views = views.create({
            AUTHORISATION_SUCCESS: {
                view: "errors/incorrect_state/auth_success"
            },
            AUTHORISATION_REJECTED: {
                view: "errors/incorrect_state/auth_failure"
            }
        });

        var chargeId = chargeParam.retrieve(req);
        if (!chargeId) return _views.display(res,"NOT_FOUND");

        var init = function(){
            Charge.find(chargeId).then(function(data){
                gotCharge(data,chargeId);
            }, apiFail);
        },

        gotCharge = function(data,chargeId) {
            var incorrectState = !isChargeSessionOK(data.status);
            var stateName = data.status.toUpperCase().replace(" ", "_");
            if (incorrectState) return _views.display(res, stateName, {
                chargeId: chargeId,
                returnUrl: data.return_url
            });

            setChargeSession(req,chargeId,data);
            Charge.updateStatus(chargeId, ENTERING_CARD_DETAILS_STATUS)
            .then(function(){
                statusUpdated(data,chargeId)
            }, apiFail);
        },

        // TODO remove is possible
        setChargeSession = function(req,chargeId,data) {
            var chargeSession = chargeState(req, chargeId);
            chargeSession.amount = normalise.penceToPounds(data.amount);
            chargeSession.paymentDescription = data.description;
        },

        isChargeSessionOK = function(currentState){
            if (currentState == ENTERING_CARD_DETAILS_STATUS) return true;
            if (currentState == CREATED_STATE) return true
            return false
        },

        apiFail = function(error){
            _views.display(res,"NOT_FOUND");
        },

        statusUpdated = function(data,chargeId) {
            res.render(CHARGE_VIEW, normalise.charge(data,chargeId));
        };

        init();
    });

    app.post(paths.card.create, function (req, res) {
        var _views = views.create();
        var chargeId = chargeParam.retrieve(req);
        if (!chargeId) return _views.display(res,"NOT_FOUND");


        var checkResult = validateNewCharge(normaliseAddress(req.body));

        var chargeSession = chargeState(req, chargeId);

        if (checkResult.hasError) {
            checkResult.charge_id = chargeId;
            checkResult.paymentDescription = chargeSession.paymentDescription;
            checkResult.amount = req.body.hiddenAmount;
            checkResult.return_url = req.body.returnUrl;
            checkResult.post_card_action = paths.card.create;
            res.render(CHARGE_VIEW, checkResult);
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

        var connectorUrl = paths.generateRoute(paths.connector.charge.show,{chargeId: chargeId});
        client.get(connectorUrl, function (chargeData, chargeResponse) {
            var authLink = findLinkForRelation(chargeData.links, 'cardAuth');
            var cardAuthUrl = authLink.href;

            client.post(cardAuthUrl, payload, function (data, connectorResponse) {
                logger.info('posting card details');
                switch (connectorResponse.statusCode) {
                    case 204:
                        logger.info('got response code 200 from connector');
                        chargeSession.cardNumber =  hashOutCardNumber(plainCardNumber);
                        chargeSession.expiryDate = expiryDate;
                        chargeSession.cardholderName = req.body.cardholderName;
                        chargeSession.address = buildAddressLine(req.body);
                        chargeSession.serviceName = "Demo Service";
                        res.redirect(303, paths.generateRoute(paths.card.confirm,{chargeId: chargeId}));
                        return;
                    case 500:
                        logger.error('got response code 500 from connector');
                        return _views.display(res,'SYSTEM_ERROR',{returnUrl: chargeData.return_url});
                    default:
                        res.redirect(303,paths.generateRoute(paths.card.new,{chargeId: chargeId}));
                }
            }).on('error', function (err) {
                logger.error('Exception raised calling connector: ' + err);
                _views.display(res,"ERROR");

            });
        }).on('error', function (err) {
            logger.error('Exception raised calling connector: ' + err);
            _views.display(res,"ERROR");
        });
    });

    app.get(paths.card.confirm, function (req, res) {
        var chargeId    = chargeParam.retrieve(req),
        chargeSession   = chargeState(req, chargeId),
        sessionValid    = validSession(chargeSession),
        confirmPath     = paths.generateRoute(paths.card.confirm,{chargeId: chargeId}),
        successLocals   = {
            'charge_id': chargeId,
            'confirmPath': confirmPath,
            session: chargeSession
        },
        _views = views.create({
            success: { view: CONFIRM_VIEW, locals: successLocals },
        });

        var init = function(){
            if (!chargeId) return fail({message: "CHARGE NOT FOUND IN SESSION"});
            if (!sessionValid) return _views.display(res,'SESSION_EXPIRED');
            Charge.find(chargeId).then(gotCharge,fail);
        },

        gotCharge = function(data){
            var stateOK = isChargeStateOK(data.status);
            var stateName = data.status.toUpperCase().replace(" ", "_")
            if (!stateOK) {
                return _views.display(res, stateName,{
                    chargeId: chargeId,
                    returnUrl: data.return_url
                });
            }
            _views.display(res,'success');
        },

        isChargeStateOK = function(currentState){
            if (currentState == AUTH_SUCCESS_STATE) return true;
            return false;
        },

        fail = function(error){
            logger.error(error.message);
            return _views.display(res, "NOT_FOUND");
        };

        init();
    });

    app.post(paths.card.capture, function (req, res) {
        var _views  = views.create(),
        chargeId    = chargeParam.retrieve(req);

        var init = function(){
            if (!chargeId) return _views.display(res, "ERROR");
            Charge.find(chargeId).then(gotCharge ,fail);
        },

        gotCharge = function(data){
            returnUrl = data.return_url;
            Charge.capture(chargeId).
            then(function(){
                res.redirect(303, returnUrl);
            }, function(err){
                captureFail(err, returnUrl)
            });

        },

        captureFail = function(err,returnUrl){
            if (err.message == 'AUTH_FAILED') return _views.display(res, 'ERROR', {
                message: "There was a problem processing your payment. Please contact the service."
            });

            _views.display(res, 'SYSTEM_ERROR', { returnUrl: returnUrl });
        },

        fail = function(err){
            return _views.display(res,'ERROR');
        };

        init();
    });

    function findLinkForRelation(links, rel) {
        return links.find(function (link) {
            return link.rel === rel;
        });
    }

    function validateNewCharge(body) {
        var checkResult = {
            hasError: false,
            errorMessage: "The following fields are missing or contain errors",
            errorFields: [],
            highlightErrorFields: {}
        };
        for (var field in REQUIRED_FORM_FIELDS) {
            var fieldInBody = body[field];
            var cardNoInvalid = (field === CARD_NUMBER_FIELD && !luhn.validate(body[field]));

            if (!fieldInBody || cardNoInvalid) {
                var errorType = !fieldInBody? ' is missing': ' is invalid';
                checkResult.hasError = true;
                checkResult.errorFields.push({
                    key: REQUIRED_FORM_FIELDS[field].id,
                    value: REQUIRED_FORM_FIELDS[field].name + errorType
                });
                checkResult.highlightErrorFields[field] = REQUIRED_FORM_FIELDS[field].message;
            }
        }
        logger.info("Card details check result: "+JSON.stringify(checkResult));
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
            'postcode': body.addressPostcode,
            'country': 'GB'
        };
    }

    function buildAddressLine(body) {
        return [body.addressLine1,
            body.addressLine2,
            body.addressCity,
            body.addressPostcode].filter(notNullOrEmpty).join(", ");
    }

    function notNullOrEmpty(str) {
        return str;
    }
}
