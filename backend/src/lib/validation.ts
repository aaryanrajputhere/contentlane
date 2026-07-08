import type { RequestHandler } from 'express';
import type { ParamsDictionary } from 'express-serve-static-core';
import type { ParsedQs } from 'qs';
import type { ZodTypeAny } from 'zod';

export const validate = (schemas: { body?: ZodTypeAny; params?: ZodTypeAny; query?: ZodTypeAny }): RequestHandler => (req, _res, next) => {
  if (schemas.body) req.body = schemas.body.parse(req.body);
  if (schemas.params) req.params = schemas.params.parse(req.params) as ParamsDictionary;
  if (schemas.query) {
    const parsedQuery = schemas.query.parse(req.query) as ParsedQs;
    for (const key of Object.keys(req.query)) delete req.query[key];
    Object.assign(req.query, parsedQuery);
  }
  next();
};
