/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */

import type { IKibanaResponse, Logger } from '@kbn/core/server';

import { transformError } from '@kbn/securitysolution-es-utils';
import { DETECTION_ENGINE_RULES_BULK_UPDATE } from '../../../../../../../common/constants';
import {
  BulkPatchRulesRequestBody,
  BulkCrudRulesResponse,
} from '../../../../../../../common/api/detection_engine/rule_management';

import { buildRouteValidationWithZod } from '../../../../../../utils/build_validation/route_validation';
import type { SecuritySolutionPluginRouter } from '../../../../../../types';
import { transformBulkError, buildSiemResponse } from '../../../../routes/utils';
import { getIdBulkError } from '../../../utils/utils';
import { transformValidateBulkError } from '../../../utils/validate';
import { readRules } from '../../../logic/rule_management/read_rules';
import { getDeprecatedBulkEndpointHeader, logDeprecatedBulkEndpoint } from '../../deprecation';
import { validateRuleDefaultExceptionList } from '../../../logic/exceptions/validate_rule_default_exception_list';
import { validateRulesWithDuplicatedDefaultExceptionsList } from '../../../logic/exceptions/validate_rules_with_duplicated_default_exceptions_list';
import { RULE_MANAGEMENT_BULK_ACTION_SOCKET_TIMEOUT_MS } from '../../timeouts';

/**
 * @deprecated since version 8.2.0. Use the detection_engine/rules/_bulk_action API instead
 */
export const bulkPatchRulesRoute = (router: SecuritySolutionPluginRouter, logger: Logger) => {
  router.versioned
    .patch({
      access: 'public',
      path: DETECTION_ENGINE_RULES_BULK_UPDATE,
      options: {
        tags: ['access:securitySolution'],
        timeout: {
          idleSocket: RULE_MANAGEMENT_BULK_ACTION_SOCKET_TIMEOUT_MS,
        },
      },
    })
    .addVersion(
      {
        version: '2023-10-31',
        validate: {
          request: {
            body: buildRouteValidationWithZod(BulkPatchRulesRequestBody),
          },
        },
      },
      async (context, request, response): Promise<IKibanaResponse<BulkCrudRulesResponse>> => {
        logDeprecatedBulkEndpoint(logger, DETECTION_ENGINE_RULES_BULK_UPDATE);

        const siemResponse = buildSiemResponse(response);

        try {
          const ctx = await context.resolve(['core', 'securitySolution', 'alerting', 'licensing']);
          const rulesClient = ctx.alerting.getRulesClient();
          const rulesManagementClient = ctx.securitySolution.getRulesManagementClient();

          const rules = await Promise.all(
            request.body.map(async (payloadRule) => {
              const idOrRuleIdOrUnknown = payloadRule.id ?? payloadRule.rule_id ?? '(unknown id)';

              try {
                const existingRule = await readRules({
                  rulesClient,
                  ruleId: payloadRule.rule_id,
                  id: payloadRule.id,
                });

                if (!existingRule) {
                  return getIdBulkError({ id: payloadRule.id, ruleId: payloadRule.rule_id });
                }

                validateRulesWithDuplicatedDefaultExceptionsList({
                  allRules: request.body,
                  exceptionsList: payloadRule.exceptions_list,
                  ruleId: idOrRuleIdOrUnknown,
                });

                await validateRuleDefaultExceptionList({
                  exceptionsList: payloadRule.exceptions_list,
                  rulesClient,
                  ruleRuleId: payloadRule.rule_id,
                  ruleId: payloadRule.id,
                });

                const rule = await rulesManagementClient.patchRule({
                  nextParams: payloadRule,
                });

                return transformValidateBulkError(rule.id, rule);
              } catch (err) {
                return transformBulkError(idOrRuleIdOrUnknown, err);
              }
            })
          );

          return response.ok({
            body: BulkCrudRulesResponse.parse(rules),
            headers: getDeprecatedBulkEndpointHeader(DETECTION_ENGINE_RULES_BULK_UPDATE),
          });
        } catch (err) {
          const error = transformError(err);
          return siemResponse.error({
            body: error.message,
            headers: getDeprecatedBulkEndpointHeader(DETECTION_ENGINE_RULES_BULK_UPDATE),
            statusCode: error.statusCode,
          });
        }
      }
    );
};
