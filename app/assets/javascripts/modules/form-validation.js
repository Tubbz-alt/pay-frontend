'use strict'
var formValidation = function () {
  var form = $('form#card-details'),
    formInputs = form.find('input'),
    countryAutocomplete = form.find('.autocomplete__input'),
    countrySelect = form.find('#address-country'),
    postcodeInput = form.find('#address-postcode'),
    cardInput = form.find('#card-no'),
    errorSummary = $('.govuk-error-summary'),
    logger = { info: function () {} }, // replace with console to see output
    // window.card comes from the view
    chargeValidations = module.chargeValidation(
      i18n.chargeController.fieldErrors,
      logger,
      $.extend({}, window.Card)
    ),
    required = chargeValidations.required

  var init = function () {
      form.on('submit', checkFormSubmission)
      formInputs.on('blur', checkPreviousFocused)
      countrySelect.on('change', function () {
        checkValidation(postcodeInput)
      })
    },
    checkFormSubmission = function (e) {
      var validations = allValidations()
      var form = this
      e.preventDefault()
      if ($('.autocomplete__input').val() === '') {
        $('.autocomplete__input').val($('#address-country-select option:selected').text())
      }

      showCardType().checkCardtypeIsAllowed().then(
        function () {
          if (!validations.hasError) {
            $('#submit-card-details').attr('disabled', 'disabled')
            return form.submit()
          }
          addValidationsErrors()
        },
        function (error) {
          addValidationsErrors()
        }
      )
    },
    addValidationsErrors = function () {
      addAllValidations()
      generateHighlightBlock()
    },
    addCardError = function (error) {
      var formGroup = getFormGroup(cardInput)
      replaceLabel(error.text, formGroup)
      prependHighlightError({ cssKey: 'card-no', value: error.text })
      $(formGroup).addClass('govuk-form-group--error')
    },
    addAllValidations = function () {
      var fields = allFields()
      for (var field in fields) {
        checkValidation(fields[field])
      }
    },
    generateHighlightBlock = function () {
      errorSummary.removeClass('hidden').attr('aria-hidden', 'false')
      $('.govuk-error-summary__list').empty()
      appendHighlightErrors()

      location.hash = ''
      setTimeout(function () {
        location.hash = '#error-summary'
      }, 10)
    },
    appendHighlightErrors = function () {
      var errors = allValidations().errorFields
      for (var key in errors) {
        var error = errors[key]
        appendHighlightError(error)
      }
    },
    appendHighlightError = function (error) {
      addHighlightError('append', error)
    },
    prependHighlightError = function (error) {
      addHighlightError('prepend', error)
    },
    addHighlightError = function (addType, error) {
      $('.govuk-error-summary__list')[addType](
        '<li><a href="#' +
          error.cssKey +
          '-lbl" id="' +
          error.cssKey +
          '-error">' +
          error.value +
          '</a></li>'
      )
    },
    checkPreviousFocused = function () {
      var input = this
      setTimeout(function () {
        // document.activelement is set to body unless you do this
        checkValidationInline(input)
      }, 50)
    },
    checkValidationInline = function (input) {
      var blank = $(input).val().length === 0,
        group = getFormGroup(input),
        // validation happens on blur, check which input the user is on now
        focusedGroup = getFormGroup($(document.activeElement)),
        inGroup = focusedGroup.is(group),
        groupHasError = getFormGroup(input).hasClass('govuk-form-group--error'),
        lastOfgroup = $(input).is('[data-last-of-form-group]'),
        required = $(input).is('[data-required]')
      if ((lastOfgroup && required) || groupHasError) { return checkValidation(input) }
      if (inGroup || blank) return
      checkValidation(input)
    },
    checkValidation = function (input) {
      var formGroup = getFormGroup(input),
        validationName = getFormGroupValidation(formGroup),
        validation = validationFor(validationName)

      if (validation) {
        $(input).addClass('govuk-input--error')
      } else {
        $(input).removeClass('govuk-input--error')
      }

      if ($(input).is(cardInput)) {
        checkCardType(validation, formGroup)
        return
      }

      replaceOnError(validation, formGroup)
    },
    checkCardType = function (validation, formGroup) {
      showCardType().checkCardtypeIsAllowed().then(
        function () {
          replaceOnError(validation, formGroup)
        },
        function (error) {
          addCardError(error)
        }
      )
    },
    replaceOnError = function (validation, formGroup) {
      var validated = validation === undefined
      replaceLabel(validation, formGroup)
      $(formGroup).toggleClass('govuk-form-group--error', !validated)
    },
    replaceLabel = function (validation, formGroup) {
      var label = formGroup.find('[data-label-replace]')

      if (label.length === 0) return
      if (validation) {
        label.text(validation).attr('role', 'alert')
        label.addClass('govuk-error-message')
      } else {
        label.text(label.attr('data-original-label')).removeAttr('role')
        label.removeClass('govuk-error-message')
      }
    },
    validationFor = function (name) {
      var validation = $.grep(allValidations().errorFields, function (
        validation
      ) {
        return validation.key === name
      })
      if (!validation[0]) return
      return validation[0].value
    },
    allFields = function () {
      var fields = {}
      $(required).each(function (index, requiredField) {
        fields[requiredField] = findInputByKey(requiredField)
      })
      return fields
    },
    allFieldValues = function () {
      var values = {}
      $(required).each(function (index, requiredField) {
        values[requiredField] = $.trim(findInputByKey(requiredField).val())
      })
      return values
    },
    allValidations = function () {
      return chargeValidations.verify(allFieldValues())
    },
    getFormGroup = function (input) {
      return $(input).parents('.govuk-form-group')
    },
    getFormGroupValidation = function (formGroup) {
      return $(formGroup).attr('data-validation')
    },
    findInputByKey = function (key) {
      return $('input[name=' + key + '], select[name=' + key + ']').first()
    }

  init()
}
