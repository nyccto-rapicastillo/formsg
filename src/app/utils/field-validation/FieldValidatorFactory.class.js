const {
  AnswerNotAllowedValidator,
  DropdownValidator,
  RadiobuttonValidator,
  CheckboxValidator,
  NricValidator,
  EmailValidator,
  TableValidator,
  NumberValidator,
  YesNoValidator,
  TextValidator,
  MobileValidator,
  HomeNoValidator,
  BaseFieldValidator,
  DecimalValidator,
  AttachmentValidator,
  DateValidator,
  RatingValidator,
} = require('./validators')

const myInfoTypes = require('../../../shared/resources/myinfo').types
/**
 *
 *  Factory for creating validators based on the field type found in the response
 *
 * @class FieldValidatorFactory
 */
class FieldValidatorFactory {
  /**
   * Creates a field validator for the appropriate form field type
   * @param {String} formId id of form for logging
   * @param {Object} formField Any form field retrieved from the database
   * @param {BaseFieldValidator} validator An instance of BaseFieldValidator class
   */
  createFieldValidator(formId, formField, response) {
    const { fieldType, myInfo } = response
    if (myInfo) {
      this._injectMyInfo(formField)
    }

    // 'statement' and 'image' are rejected prior to the creation of a field validator
    switch (fieldType) {
      case 'section':
        // Answers are disallowed for these fields
        return new AnswerNotAllowedValidator(...arguments)
      case 'radiobutton':
        return new RadiobuttonValidator(...arguments)
      case 'dropdown':
        return new DropdownValidator(...arguments)
      case 'checkbox':
        return new CheckboxValidator(...arguments)
      case 'nric':
        return new NricValidator(...arguments)
      case 'email':
        return new EmailValidator(...arguments)
      case 'table':
        return new TableValidator(...arguments)
      case 'number':
        return new NumberValidator(...arguments)
      case 'rating':
        return new RatingValidator(...arguments)
      case 'yes_no':
        return new YesNoValidator(...arguments)
      case 'decimal':
        return new DecimalValidator(...arguments)
      case 'textfield': // short text
      case 'textarea': // long text
        return new TextValidator(...arguments)
      case 'attachment':
        return new AttachmentValidator(...arguments)
      case 'date':
        return new DateValidator(...arguments)
      case 'homeno':
        return new HomeNoValidator(...arguments)
      case 'mobile':
        return new MobileValidator(...arguments)
      default:
        // Checks if answer is optional or required, but will throw an error when there is an answer
        // since _isFilledAnswerValid is not implemented
        return new BaseFieldValidator(...arguments)
    }
  }

  /**
   * Helper function to inject MyInfo data. This is necessary because the
   * client strips out MyInfo data to keep each form submission lightweight
   * @param {*} formField Any form field retrieved from the database
   */
  _injectMyInfo(formField) {
    const [myInfoField] = myInfoTypes.filter(
      (x) => x.name === formField.myInfo.attr,
    )
    if (!myInfoField)
      throw new Error(
        `Could not find myInfoField for attr: ${formField.myInfo.attr}`,
      )
    const { fieldType, fieldOptions, ValidationOptions } = myInfoField
    if (fieldType) formField.fieldType = fieldType
    if (fieldOptions) formField.fieldOptions = fieldOptions
    if (ValidationOptions) formField.ValidationOptions = ValidationOptions
  }
}

module.exports = FieldValidatorFactory
