const validateField = require('../../../../../dist/backend/app/utils/field-validation')

describe('NRIC field validation', () => {
  it('should allow valid NRIC with S prefix', () => {
    const formField = {
      _id: 'abc123',
      fieldType: 'nric',
      required: true,
    }
    const response = {
      _id: 'abc123',
      fieldType: 'nric',
      answer: 'S9912345A',
    }
    const testFunc = () => validateField('formId', formField, response)
    expect(testFunc).not.toThrow()
  })

  it('should allow valid NRIC with T prefix', () => {
    const formField = {
      _id: 'abc123',
      fieldType: 'nric',
      required: true,
    }
    const response = {
      _id: 'abc123',
      fieldType: 'nric',
      answer: 'T1394524H',
    }
    const testFunc = () => validateField('formId', formField, response)
    expect(testFunc).not.toThrow()
  })

  it('should allow valid NRIC with F prefix', () => {
    const formField = {
      _id: 'abc123',
      fieldType: 'nric',
      required: true,
    }
    const response = {
      _id: 'abc123',
      fieldType: 'nric',
      answer: 'F0477844T',
    }
    const testFunc = () => validateField('formId', formField, response)
    expect(testFunc).not.toThrow()
  })

  it('should allow valid NRIC with G prefix', () => {
    const formField = {
      _id: 'abc123',
      fieldType: 'nric',
      required: true,
    }
    const response = {
      _id: 'abc123',
      fieldType: 'nric',
      answer: 'G9592927W',
    }
    const testFunc = () => validateField('formId', formField, response)
    expect(testFunc).not.toThrow()
  })

  it('should disallow invalid NRIC with S prefix', () => {
    const formField = {
      _id: 'abc123',
      fieldType: 'nric',
      required: true,
    }
    const response = {
      _id: 'abc123',
      fieldType: 'nric',
      answer: 'S9912345B',
    }
    const testFunc = () => validateField('formId', formField, response)
    expect(testFunc).toThrow()
  })

  it('should disallow invalid NRIC with T prefix', () => {
    const formField = {
      _id: 'abc123',
      fieldType: 'nric',
      required: true,
    }
    const response = {
      _id: 'abc123',
      fieldType: 'nric',
      answer: 'T1394524I',
    }
    const testFunc = () => validateField('formId', formField, response)
    expect(testFunc).toThrow()
  })

  it('should disallow invalid NRIC with F prefix', () => {
    const formField = {
      _id: 'abc123',
      fieldType: 'nric',
      required: true,
    }
    const response = {
      _id: 'abc123',
      fieldType: 'nric',
      answer: 'F0477844U',
    }
    const testFunc = () => validateField('formId', formField, response)
    expect(testFunc).toThrow()
  })

  it('should disallow invalid NRIC with G prefix', () => {
    const formField = {
      _id: 'abc123',
      fieldType: 'nric',
      required: true,
    }
    const response = {
      _id: 'abc123',
      fieldType: 'nric',
      answer: 'G9592927X',
    }
    const testFunc = () => validateField('formId', formField, response)
    expect(testFunc).toThrow()
  })

  it('should allow empty string for optional NRIC', () => {
    const formField = {
      _id: 'abc123',
      fieldType: 'nric',
      required: false,
    }
    const response = {
      _id: 'abc123',
      fieldType: 'nric',
      answer: '',
    }
    const testFunc = () => validateField('formId', formField, response)
    expect(testFunc).not.toThrow()
  })

  it('should disallow empty string for required NRIC', () => {
    const formField = {
      _id: 'abc123',
      fieldType: 'nric',
      required: true,
    }
    const response = {
      _id: 'abc123',
      fieldType: 'nric',
      answer: '',
      isVisible: true,
    }
    const testFunc = () => validateField('formId', formField, response)
    expect(testFunc).toThrow()
  })
})
