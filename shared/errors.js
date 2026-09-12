'use strict';

class AppError extends Error {
  constructor(code, message, status = 400, details = undefined) {
    super(message);
    this.name = 'AppError';
    this.code = code;
    this.status = status;
    this.details = details;
  }
}

function errorBody(error, requestId) {
  return {
    ok: false,
    error: {
      code: error.code || 'INTERNAL_ERROR',
      message: error.message || 'An unexpected error occurred.',
      requestId,
      ...(error.details === undefined ? {} : { details: error.details })
    }
  };
}

module.exports = { AppError, errorBody };
