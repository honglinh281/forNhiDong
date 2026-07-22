import OpenAI from 'openai';

import { compareEnglishNameClaims } from '@/lib/english-checker/ai/compare-english-name';
import { extractVietnameseProductFacts } from '@/lib/english-checker/ai/extract-product-facts';
import { verifyPotentialOKRows } from '@/lib/english-checker/ai/verify-potential-ok';
import { validateProductFactEvidence } from '@/lib/english-checker/evidence-validator';
import { getRelevantGlossaryEntries } from '@/lib/english-checker/glossary';
import { normalizeVietnameseDescription } from '@/lib/english-checker/normalize-vietnamese';
import {
  finalizeAuditResult,
  getCandidateStatus
} from '@/lib/english-checker/rule-engine';
import { ENGLISH_CHECK_STATUS } from '@/lib/english-checker/constants';

function indexByRowId(items) {
  return new Map(items.map((item) => [item.rowId, item]));
}

function buildFactInputs(rows) {
  return rows
    .filter((row) => normalizeVietnameseDescription(row.productNameVi).original)
    .map((row) => {
      const productNameVi = normalizeVietnameseDescription(row.productNameVi);
      const checkInfo = normalizeVietnameseDescription(row.checkInfo);
      const customerFeedback = normalizeVietnameseDescription(row.customerFeedback);

      return {
        rowId: row.rowId,
        productNameVi,
        checkInfo,
        customerFeedback,
        companyGlossary: getRelevantGlossaryEntries(
          productNameVi.original,
          checkInfo.original,
          customerFeedback.original
        )
      };
    });
}

function buildFailSafeFacts(row, factInput) {
  const canonicalName =
    factInput.companyGlossary[0]?.preferred || String(row.productNameEn ?? '').trim();

  if (!canonicalName) {
    return null;
  }

  return {
    rowId: row.rowId,
    canonicalName,
    productIdentity: {
      value: canonicalName,
      evidence: factInput.productNameVi.original
    },
    productClass: null,
    subtype: null,
    scope: 'unknown',
    distinguishingQualifiers: [],
    factualConstraints: {
      material: null,
      function: null,
      application: null,
      composition: null
    },
    administrativeInfo: [],
    unresolvedCriticalFacts: ['PASS 1 fact extraction failed'],
    confidence: 0
  };
}

async function runPrimaryPassWithFallback(runPass, inputs, { client, model, verifierModel }) {
  try {
    return await runPass(inputs, { client, model });
  } catch (primaryError) {
    if (verifierModel === model) {
      throw primaryError;
    }

    return runPass(inputs, { client, model: verifierModel });
  }
}

export async function checkEnglishNamesWithOpenAI(
  rows,
  {
    apiKey,
    model,
    verifierModel,
    strictVerifyOK,
    client: providedClient
  } = {}
) {
  const resolvedApiKey = apiKey || process.env.OPENAI_API_KEY;

  if (!resolvedApiKey && !providedClient) {
    throw new Error('OPENAI_API_KEY chưa được cấu hình trên server.');
  }

  const client = providedClient || new OpenAI({ apiKey: resolvedApiKey });
  const resolvedModel = model || process.env.OPENAI_MODEL || 'gpt-5-nano';
  const resolvedVerifierModel =
    verifierModel || process.env.OPENAI_VERIFIER_MODEL || 'gpt-5-mini';
  const strictVerification =
    typeof strictVerifyOK === 'boolean'
      ? strictVerifyOK
      : process.env.STRICT_VERIFY_OK !== 'false';
  const factInputs = buildFactInputs(rows);
  let facts = [];
  let factsError = '';

  if (factInputs.length) {
    try {
      facts = await runPrimaryPassWithFallback(extractVietnameseProductFacts, factInputs, {
        client,
        model: resolvedModel,
        verifierModel: resolvedVerifierModel
      });
      const factInputByRowId = indexByRowId(factInputs);
      facts = facts.map((item) =>
        validateProductFactEvidence(item, factInputByRowId.get(item.rowId))
      );
    } catch {
      factsError = 'PASS 1 không trích xuất được facts có evidence; không thể xác nhận tên tiếng Anh.';
      const rowById = indexByRowId(rows);
      facts = factInputs
        .map((factInput) => buildFailSafeFacts(rowById.get(factInput.rowId), factInput))
        .filter(Boolean);
    }
  }

  const factsByRowId = indexByRowId(facts);
  const comparisonInputs = factsError
    ? []
    : rows
        .filter((row) => row.productNameEn?.trim() && factsByRowId.has(row.rowId))
        .map((row) => {
          const factInput = factInputs.find((item) => item.rowId === row.rowId);
          return {
            rowId: row.rowId,
            currentEnglish: row.productNameEn.trim(),
            productNameVi: factInput.productNameVi,
            checkInfo: factInput.checkInfo,
            customerFeedback: factInput.customerFeedback,
            companyGlossary: factInput.companyGlossary,
            productFacts: factsByRowId.get(row.rowId)
          };
        });
  let comparisons = [];
  let comparisonError = '';

  if (comparisonInputs.length) {
    try {
      comparisons = await runPrimaryPassWithFallback(compareEnglishNameClaims, comparisonInputs, {
        client,
        model: resolvedModel,
        verifierModel: resolvedVerifierModel
      });
    } catch {
      comparisonError = 'PASS 2 không hoàn tất so sánh từng thuộc tính; dòng được chuyển sang rà soát.';
    }
  }

  const comparisonByRowId = indexByRowId(comparisons);
  const potentialOKInputs = strictVerification
    ? rows
        .filter((row) => {
          const factsForRow = factsByRowId.get(row.rowId);
          const comparison = comparisonByRowId.get(row.rowId);
          return (
            factsForRow &&
            comparison &&
            getCandidateStatus(row, factsForRow, comparison) === ENGLISH_CHECK_STATUS.OK
          );
        })
        .map((row) => {
          const comparisonInput = comparisonInputs.find((item) => item.rowId === row.rowId);
          return {
            ...comparisonInput,
            comparison: comparisonByRowId.get(row.rowId)
          };
        })
    : [];
  let verifications = [];
  let verifierFailed = false;

  if (potentialOKInputs.length) {
    try {
      verifications = await verifyPotentialOKRows(potentialOKInputs, {
        client,
        model: resolvedVerifierModel
      });
    } catch {
      verifierFailed = true;
    }
  }

  const verificationByRowId = indexByRowId(verifications);

  return rows.map((row) => {
    const factsForRow = factsByRowId.get(row.rowId) || null;
    const comparison = comparisonByRowId.get(row.rowId) || null;
    const isPotentialOK =
      factsForRow &&
      comparison &&
      getCandidateStatus(row, factsForRow, comparison) === ENGLISH_CHECK_STATUS.OK;
    let stageError = '';

    if (factsError) {
      stageError = factsError;
    } else if (!factsForRow) {
      stageError = 'PASS 1 không tạo được canonicalName an toàn; không thể xác nhận tên tiếng Anh.';
    } else if (!comparison && row.productNameEn?.trim()) {
      stageError = comparisonError;
    } else if (verifierFailed && isPotentialOK) {
      stageError = 'PASS 3 verifier không hoàn tất; hệ thống không xác nhận OK.';
    }

    return finalizeAuditResult({
      row,
      facts: factsForRow,
      comparison,
      verification: verificationByRowId.get(row.rowId) || null,
      strictVerification,
      stageError
    });
  });
}
