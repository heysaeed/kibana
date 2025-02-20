/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */

import { schema } from '@kbn/config-schema';

import { MAX_SPACE_INITIALS } from '../../common';

export const SPACE_ID_REGEX = /^[a-z0-9_\-]+$/;

const spaceSchema = schema.object({
  id: schema.string({
    validate: (value) => {
      if (!SPACE_ID_REGEX.test(value)) {
        return `must be lower case, a-z, 0-9, '_', and '-' are allowed`;
      }
    },
  }),
  name: schema.string({ minLength: 1 }),
  description: schema.maybe(schema.string()),
  initials: schema.maybe(schema.string({ maxLength: MAX_SPACE_INITIALS })),
  color: schema.maybe(
    schema.string({
      validate: (value) => {
        if (!/^#[a-zA-Z0-9]{6}$/.test(value)) {
          return `must be a 6 digit hex color, starting with a #`;
        }
      },
    })
  ),
  disabledFeatures: schema.arrayOf(schema.string(), { defaultValue: [] }),
  _reserved: schema.maybe(schema.boolean()),
  imageUrl: schema.maybe(
    schema.string({
      validate: (value) => {
        if (value !== '' && !/^data:image.*$/.test(value)) {
          return `must start with 'data:image'`;
        }
      },
    })
  ),
});

const solutionSchema = schema.oneOf([
  schema.literal('security'),
  schema.literal('observability'),
  schema.literal('search'),
  schema.literal('classic'),
]);

export const getSpaceSchema = (isServerless: boolean) => {
  if (isServerless) {
    return spaceSchema;
  }

  return spaceSchema.extends({ solution: schema.maybe(solutionSchema) });
};
