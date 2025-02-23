/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */

import { MAX_RULES_TO_UPDATE_IN_PARALLEL } from '../../../../../../common/constants';
import { initPromisePool } from '../../../../../utils/promise_pool';
import { withSecuritySpan } from '../../../../../utils/with_security_span';
import type { PrebuiltRuleAsset } from '../../model/rule_assets/prebuilt_rule_asset';
import type { IRulesManagementClient } from '../../../rule_management/logic/rule_management/rules_management_client';

/**
 * Upgrades existing prebuilt rules given a set of rules and output index.
 * This implements a chunked approach to not saturate network connections and
 * avoid being a "noisy neighbor".
 * @param rulesManagementClient RulesManagementClient
 * @param rules The rules to apply the update for
 */
export const upgradePrebuiltRules = async (
  rulesManagementClient: IRulesManagementClient,
  rules: PrebuiltRuleAsset[]
) =>
  withSecuritySpan('upgradePrebuiltRules', async () => {
    const result = await initPromisePool({
      concurrency: MAX_RULES_TO_UPDATE_IN_PARALLEL,
      items: rules,
      executor: async (rule) => {
        return rulesManagementClient.upgradePrebuiltRule({ ruleAsset: rule });
      },
    });

    return result;
  });
