/* eslint-disable */

// BEFORE

  // Total number of form fields with isFutureOnly === true
  const beforeScriptFormFieldsWithIsFutureOnlyTrue = [
    { '$match': { 'form_fields': { '$elemMatch': { 'isFutureOnly': true } } } },
    { '$project': { 'form_fields': 1 } },
    { '$unwind': '$form_fields' },
    { '$match': { 'form_fields.isFutureOnly': true } },
    { '$count': 'numFormFields' }
  ]
  db.getCollection('forms').aggregate(beforeScriptFormFieldsWithIsFutureOnlyTrue)

  
// UPDATE
  db.forms.update(
    {"form_fields.isFutureOnly": true}, 
    {"$set": {"form_fields.$[elem].dateValidation.selectedDateValidation": "Disallow past dates"}}, 
    {"arrayFilters": [{"elem.isFutureOnly": true}], "multi" : true }
    )
  
// AFTER

// Total number of form fields with dateValidation.selectedDateValidation === 'Disallow past dates'

  const afterScriptWithDateValidationDisallowPastDates = [
    { '$unwind': '$form_fields' },
    { '$match': { 'form_fields.dateValidation.selectedDateValidation': 'Disallow past dates' } },
    { '$count': 'numFormFields' }
  ]  
  
  db.getCollection('forms').aggregate(afterScriptWithDateValidationDisallowPastDates)

  // Total number of form fields with dateValidation.selectedDateValidation
  // Should be the same as afterScriptWithDateValidationDisallowPastDates
  // Which means there are no erronous selectedDatevalidation values

  const afterScriptWithDateValidationSelectedDateVal = [
    { '$unwind': '$form_fields' },
    { '$match': { 'form_fields.dateValidation.selectedDateValidation': { '$exists': true } } },
    { '$count': 'numFormFields' }
  ]  
  
  db.getCollection('forms').aggregate(afterScriptWithDateValidationSelectedDateVal)

  // Check that the total number of form fields with isFutureOnly === true has not changed

  const afterScriptFormFieldsWithIsFutureOnlyTrue = [
    { '$match': { 'form_fields': { '$elemMatch': { 'isFutureOnly': true } } } },
    { '$project': { 'form_fields': 1 } },
    { '$unwind': '$form_fields' },
    { '$match': { 'form_fields.isFutureOnly': true } },
    { '$count': 'numFormFields' }
  ]
  db.getCollection('forms').aggregate(afterScriptFormFieldsWithIsFutureOnlyTrue)

  