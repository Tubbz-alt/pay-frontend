process.env.SESSION_ENCRYPTION_KEY = 'naskjwefvwei72rjkwfmjwfi72rfkjwefmjwefiuwefjkbwfiu24fmjbwfk';

var EMPTY_BODY='';

var request = require('supertest');
var portfinder = require('portfinder');
var nock = require('nock');
var app = require(__dirname + '/../server.js').getApp;
var createCookieValue = require(__dirname + '/utils/session.js').createCookieValue;

portfinder.getPort(function(err, connectorPort) {
  
  var localServer = 'http://localhost:' + connectorPort;

  var connectorChargePath = '/v1/api/charge/';
  var chargeId = '23144323';
  var frontendCardDetailsPath = '/card_details';

  var connectorAuthUrl = localServer + connectorChargePath + chargeId + '/cards';

  var connectorMock = nock(localServer);

  process.env.CONNECTOR_URL = localServer + connectorChargePath + '{chargeId}';

  function connector_responds_with(charge) {
    connectorMock.get(connectorChargePath + chargeId).reply(200, charge);
  }

  function connector_expects(data) {
    return connectorMock.post(connectorChargePath + chargeId + '/cards', data);
  }

  function get_charge_request(cookieValue, chargeId) {
    return request(app)
        .get(frontendCardDetailsPath + '/' + chargeId)
        .set('Cookie', ['session_state=' + cookieValue])
        .set('Accept', 'application/json');
  }

  function post_charge_request(cookieValue, data) {
    return request(app)
        .post(frontendCardDetailsPath)
        .set('Content-Type', 'application/x-www-form-urlencoded')
        .set('Cookie', ['session_state=' + cookieValue])
        .set('Accept', 'application/json')
        .send(data);
  }

  function minimum_connector_card_data(card_number) {
    return {
      'card_number': card_number,
      'cvc': '234',
      'expiry_date': '11/99',
      'cardholder_name': 'Jimi Hendrix',
      'address': {
        'line1': '32 Whip Ma Whop Ma Avenue',
        'postcode': 'Y1 1YN',
        'country': 'GB'
      }
    };
  }

  function minimum_form_card_data(card_number) {
    console.log('chargeId=' + chargeId);
    return {
      'cardUrl': connectorAuthUrl,
      'chargeId': chargeId,
      'cardNo': card_number,
      'cvc': '234',
      'expiryDate': '11/99',
      'cardholderName': 'Jimi Hendrix',
      'addressLine1': '32 Whip Ma Whop Ma Avenue',
      'addressPostcode': 'Y1 1YN'
    };
  }

  function default_connector_response_for_get_charge() {
    var serviceUrl = 'http://www.example.com/service';
    connector_responds_with({
      'amount': 2345,
      'service_url': serviceUrl,
      'links': [{
        'href': connectorAuthUrl,
        'rel': 'cardAuth',
        'method': 'POST'
      }]
    });
  }

  describe('The /charge endpoint', function() {
    it('should include the data required for the frontend', function(done) {
      var cookieValue = createCookieValue(
        'ch_' + chargeId, true
      );

      default_connector_response_for_get_charge();

      var serviceUrl = 'http://www.example.com/service';
      get_charge_request(cookieValue, chargeId).expect(200, {
        'amount': '23.45',
        'charge_id': chargeId,
        'service_url': serviceUrl,
        'post_card_action': frontendCardDetailsPath
      }).end(done);
    });

    it('should send clean card data to connector', function(done) {
      var cookieValue = createCookieValue(
        'cardAuthUrl', connectorAuthUrl,
        'ch_' + chargeId, true
      );

      default_connector_response_for_get_charge();

      connector_expects(minimum_connector_card_data('5105105105105100'))
          .reply(204);

      post_charge_request(cookieValue, minimum_form_card_data('5105 1051 0510 5100'))
          .expect(303)
          .expect('Location', frontendCardDetailsPath + '/' + chargeId + '/confirm')
          .end(done);
    });

    it('should send card data including optional fields to connector', function (done) {
      var cookieValue = createCookieValue(
        'cardAuthUrl', connectorAuthUrl,
        'ch_' + chargeId, true
      );

      default_connector_response_for_get_charge();

      var card_data = minimum_connector_card_data('5105105105105100');
      card_data.address.line2 = 'bla bla';
      card_data.address.line3 = 'blublu';
      card_data.address.city = 'London';
      card_data.address.county = 'Greater London';
      card_data.address.country = 'GB';

      connector_expects(card_data).reply(204);

      var form_data = minimum_form_card_data('5105105105105100');
      form_data.addressLine2 = card_data.address.line2;
      form_data.addressLine3 = card_data.address.line3;
      form_data.addressCity = card_data.address.city;
      form_data.addressCounty = card_data.address.county;

      post_charge_request(cookieValue, form_data)
          .expect(303)
          .expect('Location', frontendCardDetailsPath + '/' + chargeId + '/confirm')
          .end(done);
    });

    it('show an error page when authorization was refused', function(done) {
      var cookieValue = createCookieValue(
        'cardAuthUrl', connectorAuthUrl,
        'ch_' + chargeId, true
      );

      default_connector_response_for_get_charge();

      connector_expects(minimum_connector_card_data('5105105105105100'))
          .reply(400, {'message': 'This transaction was declined.'});

      post_charge_request(cookieValue, minimum_form_card_data('5105105105105100'))
          .expect(200, {'message': 'Payment could not be processed, please contact your issuing bank'})
          .end(done);
    });

    it('show an error page when the chargeId is not found on the session', function(done) {
      var cookieValue = createCookieValue(
        'cardAuthUrl', connectorAuthUrl
      );

      var card_data = minimum_connector_card_data('5105105105105100');
      card_data.address.line2 = 'bla bla';
      card_data.address.line3 = 'blublu';
      card_data.address.city = 'London';
      card_data.address.county = 'Greater London';
      card_data.address.country = 'GB';

      connector_expects(card_data).reply(204);

      var form_data = minimum_form_card_data('5105105105105100');
      form_data.addressLine2 = card_data.address.line2;
      form_data.addressLine3 = card_data.address.line3;
      form_data.addressCity = card_data.address.city;
      form_data.addressCounty = card_data.address.county;

      post_charge_request(cookieValue, form_data)
        .expect(200, {
          'message' : 'There is a problem with the payments platform'
        }, done);
    });

    it('shows an error when a card is submitted that does not pass the luhn algorithm', function (done) {
      var cookieValue = createCookieValue(
        'cardAuthUrl', connectorAuthUrl,
        'ch_' + chargeId, true
      );
      post_charge_request(cookieValue, minimum_form_card_data('1111111111111111'))
          .expect(200, {'message': 'You probably mistyped the card number. Please check and try again.'})
          .end(done);
    });

    it('should ignore empty/null address lines when second address line populated', function (done) {
      var cookieValue = createCookieValue(
        'cardAuthUrl', connectorAuthUrl,
        'ch_' + chargeId, true
      );

      var card_data = minimum_connector_card_data('5105105105105100');
      card_data.address.line1 = 'bla bla';
      card_data.address.line2 = 'blublu';
      delete card_data.address.line3;

      default_connector_response_for_get_charge();
      connector_expects(card_data).reply(204);
      var form_data = minimum_form_card_data('5105105105105100');
      form_data.addressLine1 = '';
      form_data.addressLine2 = card_data.address.line1;
      form_data.addressLine3 = card_data.address.line2;

      post_charge_request(cookieValue, form_data)
                .expect(303, EMPTY_BODY)
                .expect('Location', frontendCardDetailsPath + '/' + chargeId + '/confirm')
                .end(done);
    });

    it('should ignore empty/null address lines when only third address line populated', function (done) {
      var cookieValue = createCookieValue(
        'cardAuthUrl', connectorAuthUrl,
        'ch_' + chargeId, true
      );

      var card_data = minimum_connector_card_data('5105105105105100');
      card_data.address.line1 = 'bla bla';
      delete card_data.address.line2;
      delete card_data.address.line3;

      default_connector_response_for_get_charge();

      connector_expects(card_data).reply(204);
      var form_data = minimum_form_card_data('5105105105105100');
      form_data.addressLine1 = '';
      form_data.addressLine2 = '';
      form_data.addressLine3 = card_data.address.line1;

      post_charge_request(cookieValue, form_data)
                .expect(303, EMPTY_BODY)
                .expect('Location', frontendCardDetailsPath + '/' + chargeId + '/confirm')
                .end(done);
    });

    it('should pass through empty address lines when the first and third address line are populated', function (done) {
      var cookieValue = createCookieValue(
        'cardAuthUrl', connectorAuthUrl,
        'ch_' + chargeId, true
      );
      var card_data = minimum_connector_card_data('5105105105105100');
      card_data.address.line1 = '31 gated avenue';
      card_data.address.line2 = 'Hampshire';
      delete card_data.address.line3;

      default_connector_response_for_get_charge();

      connector_expects(card_data).reply(204); 
      var form_data = minimum_form_card_data('5105105105105100');
      form_data.addressLine1 = card_data.address.line1;
      form_data.addressLine2 = '';
      form_data.addressLine3 = card_data.address.line2;

      post_charge_request(cookieValue, form_data)
                .expect(303, EMPTY_BODY)
                .expect('Location', frontendCardDetailsPath + '/' + chargeId + '/confirm')
                .end(done);
    });
  });
});