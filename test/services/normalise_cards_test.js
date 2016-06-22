var expect = require('chai').expect;
var normalise = require(__dirname + '/../../app/services/normalise_cards.js');
var testCards = [{ id: 'b29c58d8-2ab4-4ac7-adbe-f8f46ba1c27c',
        brand: 'visa',
        label: 'Visa',
        type: 'DEBIT' },
      { id: '11ff6653-adea-460f-9987-1658a05280ce',
        brand: 'visa',
        label: 'Visa',
        type: 'CREDIT' },
      { id: '0332336e-61df-4108-8f40-51c9789256dd',
        brand: 'diners-club',
        label: 'Diners Club',
        type: 'CREDIT' }];


describe('normalise cards', function () {
  it('shoudl return the correct format for the model', function () {
    expect(normalise(testCards)).to.eql([
      { brand: 'visa',
        debit: true,
        credit: true
      },
      { brand: 'diners-club',
        debit: false,
        credit: true
      }
    ]);
  });
});

