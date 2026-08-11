export type CheckStatus = 'OK' | 'Chưa sát' | 'Sai rõ' | 'Thiếu dữ liệu';

export type JobState = 'pending' | 'processing' | 'completed' | 'retrying' | 'failed';

export type ClauseType =
  | 'product_identity'
  | 'product_subtype'
  | 'material'
  | 'construction'
  | 'part_whole'
  | 'set_scope'
  | 'shape'
  | 'technology'
  | 'mechanism'
  | 'function'
  | 'application'
  | 'electrical'
  | 'dimension'
  | 'model'
  | 'brand'
  | 'manufacturer'
  | 'origin'
  | 'condition'
  | 'packing'
  | 'other';

export type CoveragePolicy = 'MUST' | 'CONDITIONAL_MUST' | 'OPTIONAL' | 'IGNORE';

export type CoverageState =
  | 'explicit'
  | 'semantic_equivalent'
  | 'implicit'
  | 'missing'
  | 'contradiction'
  | 'uncertain';

export type IdentityRelation =
  | 'exact'
  | 'equivalent'
  | 'broader'
  | 'narrower'
  | 'different'
  | 'uncertain';

export type InputClause = {
  id: string;
  text: string;
  preTypeHint: ClauseType | 'unknown';
};

export type ProductRow = {
  rowId: string;
  sheet: string;
  excelRow: number;
  stt: string | number | null;
  productNameVi: string | null;
  productNameEn: string | null;
  checkInfo: string;
  customerFeedback: string;
};

export type AuditRequestItem = {
  rowId: string;
  originalVietnamese: string;
  normalizedVietnamese: string;
  currentEnglish: string;
  clauses: InputClause[];
  secondaryContext: {
    checkInfo: string;
    customerFeedback: string;
  };
  glossaryHints: Array<{
    vi: string;
    preferredEnglish: string;
  }>;
};

export type ClauseAudit = {
  clauseId: string;
  clauseText: string;
  clauseType: ClauseType;
  normalizedFact: string;
  identityDefining: boolean;
  evidenceImportance: 'critical' | 'supporting' | 'administrative';
  englishCoverage: CoverageState;
  englishEvidence: string | null;
  note: string | null;
};

export type EnglishClaim = {
  claimId: string;
  claimText: string;
  claimType: ClauseType;
  normalizedFact: string;
  criticality: 'critical' | 'supporting' | 'administrative';
  vietnameseSupport: 'supported' | 'equivalent' | 'unsupported' | 'contradicted' | 'uncertain';
  vietnameseEvidence: string | null;
};

export type AiMicroAuditItem = {
  rowId: string;
  canonicalEnglishName: string;
  productIdentity: {
    vietnamese: string;
    english: string;
    relation: IdentityRelation;
  };
  clauseAudits: ClauseAudit[];
  englishClaims: EnglishClaim[];
  unresolvedCriticalFacts: string[];
  overallConfidence: number;
};

export type MaterialGuardResult = {
  vietnameseMaterials: string[];
  englishMaterials: string[];
  missingFromEnglish: string[];
  unsupportedInEnglish: string[];
  contradiction: boolean;
};

export type FinalAuditResult = {
  rowId: string;
  status: CheckStatus;
  reason: string;
  suggestedName: string;
  riskScore: number;
  audit?: AiMicroAuditItem;
  guards?: {
    material: MaterialGuardResult;
    genericNameRisk: boolean;
  };
};

export type RowJob = {
  row: ProductRow;
  requestItem: AuditRequestItem;
  state: JobState;
  attempts: number;
  errorCode?: string;
  finalResult?: FinalAuditResult;
  weight: number;
};

export type AuditProgressSnapshot = {
  total: number;
  completed: number;
  processing: number;
  pending: number;
  retrying: number;
  failed: number;
  resolved: number;
  paused: boolean;
};
