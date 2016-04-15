var showCardType = function(){
  var form          = $('form#card-details'),
  acceptedCards     = form.find('.accepted-cards'),
  cardInput         = form.find('input#card-no'),
  cards             = form.find('.accepted-cards > li'),
  cardNoLabel       = form.find('.card-no-label'),
  cardNoFormGroup   = form.find('.card-no-group'),
  notSupportedString= i18n.chargeController.fieldErrors.fields.cardNo.card_not_supported,
  validations       = module.chargeValidation(i18n.chargeController.fieldErrors,console),
  cardValidation    = validations.creditCardType,
  cardTypes         = validations.allowedCards;

  var init = function(){
    cardInput.on('keyup',showCardType);
  },

  showCardType = function(){
    var number = $(this).val().replace(/\D/g,'');
    var cardType = cardValidation(number);
    unSelectAll();
    checkEmpty();
    checkAllowed(cardType);
    if (cardType.length !== 1) return;
    selectCard(cardType[0].type);
  },

  unSelectAll = function(){
    cards.removeClass('selected');
  },

  selectCard = function(name){
    cards.filter('.' + name).addClass('selected');
  },

  checkEmpty = function(){
    acceptedCards.toggleClass('field-empty',cardInput.val().length === 0);
  },

  checkAllowed = function(cardType){
    if (cardType.length !== 1) return replaceCardLabelWithOriginal();
    var supported = $.inArray(cardType[0].type,cardTypes) !== -1;

    if (supported) return replaceCardLabelWithOriginal();
    cardNoFormGroup.addClass('error');
    cardNoLabel.text(notSupportedString);
  },

  replaceCardLabelWithOriginal = function(){
    cardNoFormGroup.removeClass('error');
    cardNoLabel.text(cardNoLabel.attr('data-original-label'));
  };


  init();
}();
