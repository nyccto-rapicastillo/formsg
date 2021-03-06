'use strict'

/**
 * Module dependencies.
 */
const { celebrate, Joi } = require('celebrate')
const verifiedFieldsFactory = require('../factories/verified-fields.factory')

module.exports = function (app) {
  const formatOfId = Joi.string().length(24).hex().required()
  app.route('/transaction').post(
    celebrate({
      body: Joi.object({
        formId: formatOfId,
      }),
    }),
    verifiedFieldsFactory.createTransaction,
  )
  app.route('/transaction/:transactionId').get(
    celebrate({
      params: Joi.object({
        transactionId: formatOfId,
      }),
    }),
    verifiedFieldsFactory.getTransactionMetadata,
  )
  app.route('/transaction/:transactionId/reset').post(
    celebrate({
      params: Joi.object({
        transactionId: formatOfId,
      }),
      body: Joi.object({
        fieldId: formatOfId,
      }),
    }),
    verifiedFieldsFactory.resetFieldInTransaction,
  )
  app.route('/transaction/:transactionId/otp').post(
    celebrate({
      params: Joi.object({
        transactionId: formatOfId,
      }),
      body: Joi.object({
        fieldId: formatOfId,
        answer: Joi.string().required(),
      }),
    }),
    verifiedFieldsFactory.getNewOtp,
  )

  app.route('/transaction/:transactionId/otp/verify').post(
    celebrate({
      params: Joi.object({
        transactionId: formatOfId,
      }),
      body: Joi.object({
        fieldId: formatOfId,
        otp: Joi.string()
          .regex(/^\d{6}$/)
          .required()
          .error(() => 'Please enter a valid otp'),
      }),
    }),
    verifiedFieldsFactory.verifyOtp,
  )
}
