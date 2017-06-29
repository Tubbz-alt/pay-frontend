'use strict';

var assert = require('assert');
var expect = require('chai').expect;
var cardTypes = require('../../test_helpers/test_helpers.js').cardTypes();
var Card  = require('../../../app/models/card.js')(cardTypes);
var fields= require('../../../app/utils/charge_validation_fields.js')(Card);

let result;

describe('card validation: cardholder name', function () {
  describe('should validate if does not contain 10 consecutive digits', () => {
    
    it('and it contains only text', () => {
      result = fields.fieldValidations.cardholderName('Mr Peter Griffin');
      expect(result).to.equal(true);
    });
    
    it('and it contains 9 consecutive digits', () => {
      result = fields.fieldValidations.cardholderName('Mr Peter Griffin 123456789');
      expect(result).to.equal(true);
    });

    it('and it contains 10 non-consecutive digits', () => {
      result = fields.fieldValidations.cardholderName('Mr 012345 Peter Griffin 6789');
      expect(result).to.equal(true);
    });
    
  });

  describe('should not validate if it contains 10 consecutive digits', () => {
    it('and it contains only digits', () => {
      result = fields.fieldValidations.cardholderName('0123456789');
      expect(result).to.equal('contains_too_many_digits');
    });

    it('and it contains both digits and text', () => {
      result = fields.fieldValidations.cardholderName('Mr Peter Griffin 0123456789');
      expect(result).to.equal('contains_too_many_digits');
    });
  });

});