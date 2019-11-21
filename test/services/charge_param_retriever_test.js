var path = require('path')
require(path.join(__dirname, '/../test_helpers/html_assertions.js'))
var assert = require('assert')
var chargeParam = require(path.join(__dirname, '/../../app/services/charge_param_retriever.js'))

describe('charge param retreiver', function () {
  var EMPTY_RESPONSE = { params: {}, body: {}, get: () => null }

  var NO_SESSION_GET_RESPONSE = {
    params: { chargeId: 'foo' },
    body: {},
    method: 'GET',
    get: () => null
  }

  var NO_SESSION_POST_RESPONSE = {
    params: {},
    body: { chargeId: 'foo' },
    method: 'POST',
    get: () => null
  }

  var VALID_GET_RESPONSE = {
    params: { chargeId: 'foo' },
    body: {},
    method: 'GET',
    frontend_state: { ch_foo: true },
    get: () => null
  }

  var VALID_POST_RESPONSE = {
    params: {},
    body: { chargeId: 'foo' },
    method: 'POST',
    frontend_state: { ch_foo: true },
    get: () => null
  }

  it('should return false if the charge param is not present in params or body', function () {
    assert.strictEqual(chargeParam.retrieve(EMPTY_RESPONSE), false)
  })

  it('should return false if the charge param is in params but not in session', function () {
    assert.strictEqual(chargeParam.retrieve(NO_SESSION_GET_RESPONSE), false)
  })

  it('should return false if the charge param is in THE BODY but not in session', function () {
    assert.strictEqual(chargeParam.retrieve(NO_SESSION_POST_RESPONSE), false)
  })

  it('should return THE ID if the charge param is in params and has session', function () {
    assert.strictEqual(chargeParam.retrieve(VALID_GET_RESPONSE), 'foo')
  })

  it('should return false if the charge param is in THE BODY and has session', function () {
    assert.strictEqual(chargeParam.retrieve(VALID_POST_RESPONSE), 'foo')
  })
})
