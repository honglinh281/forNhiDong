import {
  serializeComparisonExamples,
  serializeProductFactExamples
} from '@/lib/english-checker/examples';

export const PRODUCT_FACT_EXTRACTION_PROMPT = `You perform PASS 1 of a strict semantic audit for Vietnamese import/export product descriptions.

Do not skim. Analyze every row independently. The current English name is intentionally absent and must never influence Vietnamese product identification.

For each row:
1. Read productNameVi.original completely.
2. Use productNameVi.normalized only to expand abbreviations; original remains the primary evidence source.
3. checkInfo and customerFeedback are secondary context only. They may clarify ambiguity but must not override a clear Vietnamese product description.
4. Inspect text after colons, apposition, later noun phrases, "gồm", "dùng cho", "loại", "bộ phận", "phụ kiện", and "linh kiện". A specific product noun introduced later overrides a generic category stated first.
5. Separate product identity, distinguishing qualifiers, factual constraints, and administrative/noise information.
6. Quote a non-empty evidence span for every important fact. Evidence should be the shortest exact phrase that supports the value.
7. canonicalName must be a concise, natural commercial English name. It must include identity-defining subtype or distinguishing qualifiers, but omit model, brand, dimensions, origin, manufacturer, packing quantity, and "100% new" unless they change identity.
8. Record unresolvedCriticalFacts whenever identity, scope, subtype, or a material/function constraint cannot be resolved. Unresolved means the row can never be automatically OK.
9. Use companyGlossary only as preferred terminology when it matches the actual product. Never force a glossary entry onto a different product.

Fact roles:
- productIdentity: exact commercial item, not merely its broad family.
- distinguishingQualifiers: details required to distinguish the item, including subtype, shape, operating principle, protected object, or specific named part.
- factualConstraints: details that may be omitted from a short name but must not be contradicted when English claims them.
- administrativeInfo: size, model, brand, manufacturer, origin, condition, voltage without semantic impact, and packing quantity.

Return every required schema field. Never return status labels.

Curated PASS 1 examples (current English names are deliberately excluded):
${serializeProductFactExamples()}`;

export const ENGLISH_COMPARISON_PROMPT = `You perform PASS 2 of a strict semantic audit for English commercial product names.

Do not skim. Analyze every row independently. Vietnamese product facts were produced independently in PASS 1 and are the source of truth.

For each row:
1. Parse currentEnglish into englishClaims: core product, class, subtype, scope, qualifiers, and any explicit material/function/application claims.
2. Compare those claims attribute by attribute with productFacts and its evidence.
3. exact/equivalent requires the same product identity. broader means the same family but missing a distinguishing subtype or qualifier. narrower adds unsupported specificity. different means another item or a substantive contradiction. uncertain is never safe for OK.
4. distinguishingCoverage is complete only when every distinguishing qualifier required for an accurate commercial name is represented. Text after a colon and a later specific noun must be checked carefully.
5. Material/function omission alone can be acceptable. But an explicit conflicting claim is contradiction. Example: "tempered glass" contradicts Vietnamese TPU plastic.
6. part versus whole and set versus component must be checked explicitly.
7. Put every unsupported English claim in unsupportedClaims. Put every absent distinguishing fact in missedImportantFacts.
8. Administrative details such as size, model, brand, manufacturer, origin, condition, color, and packing quantity are not required unless they change product identity.
9. A fluent or related-sounding name is not enough. If critical evidence is unresolved, use uncertain.

Never return final status or suggestedName.

Curated comparison examples:
${serializeComparisonExamples()}`;

export const STRICT_OK_VERIFIER_PROMPT = `You perform PASS 3, an adversarial review of candidate OK English product names.

The previous checker believes each row may be OK. Your job is not to agree. Actively search for at least one missed issue.

Re-read the full Vietnamese original and normalized description, product facts with evidence, current English claims, and comparison. Check:
- exact product identity and later specific noun phrases
- subtype and distinguishing qualifier
- text after a colon or apposition
- material and function contradictions
- part versus whole
- set versus component
- accessory versus main product
- unsupported English claims
- glossary-sensitive internal terminology
- unresolved critical facts or missing evidence

Pay special attention when English sounds generally related but is less specific than Vietnamese. If any critical dimension cannot be positively verified, do not confirm OK. A verifier failure or uncertainty must become Chưa sát, never OK.

verifiedOK may be true only when foundIssue=none, severity=none, evidence is null, the identity is exact/equivalent, distinguishing coverage is complete/not_applicable, no contradiction or unsupported claim exists, and every critical fact is resolved.

Return every required schema field. Never return final status or suggestedName.`;
