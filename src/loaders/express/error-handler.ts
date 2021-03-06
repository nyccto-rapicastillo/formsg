import { isCelebrate } from 'celebrate'
import { ErrorRequestHandler, RequestHandler } from 'express'
import HttpStatus from 'http-status-codes'
import get from 'lodash/get'

import { createLoggerWithLabel } from '../../config/logger'

const expressLogger = createLoggerWithLabel('express')

const errorHandlerMiddlewares = () => {
  // Assume 'not found' in the error msgs is a 404. this is somewhat silly, but valid, you can do whatever you like, set properties, use instanceof etc.
  const genericErrorHandlerMiddleware: ErrorRequestHandler = function (
    err,
    req,
    res,
    next,
  ) {
    // If headers have already been sent, don't send again
    if (res.headersSent) {
      return
    }

    // If the error object doesn't exists
    if (!err) {
      return next()
    } else {
      const genericErrorMessage =
        'Apologies, something odd happened. Please try again later!'
      // Error page
      if (isCelebrate(err)) {
        let errorMessage = get(
          err,
          'joi.details[0].message',
          genericErrorMessage,
        )
        // formId is only present for Joi validated routes that require it
        let formId = get(req, 'form._id', null)
        expressLogger.error(
          `Joi validation error: form=${formId} error=${errorMessage}`,
        )
        return res.status(HttpStatus.BAD_REQUEST).send(errorMessage)
      }
      expressLogger.error(err)
      return res
        .status(HttpStatus.INTERNAL_SERVER_ERROR)
        .send({ message: genericErrorMessage })
    }
  }

  // Assume 404 since no middleware responded
  const catchNonExistentRoutesMiddleware: RequestHandler = function (
    _req,
    res,
  ) {
    res.status(HttpStatus.NOT_FOUND).send()
  }

  return [genericErrorHandlerMiddleware, catchNonExistentRoutesMiddleware]
}

export default errorHandlerMiddlewares
