import { normalizeHsCode, normalizeText, normalizeUnit, safeNormalizeQuantity, stringifyValue } from '@/lib/normalize';

function buildIssue(field, code, message) {
  return { field, code, message };
}

export function createDeclarationRow(source, values, rowNumber, meta = {}) {
  const raw = {
    hsCode: stringifyValue(values.hsCode),
    itemName: stringifyValue(values.itemName ?? values.name),
    unit: stringifyValue(values.unit),
    quantity: stringifyValue(values.quantity)
  };

  const quantityResult = safeNormalizeQuantity(raw.quantity);

  const normalized = {
    hsCode: normalizeHsCode(raw.hsCode),
    itemName: normalizeText(raw.itemName),
    unit: normalizeUnit(raw.unit),
    quantity: quantityResult.normalized
  };

  const issues = [];

  if (!raw.itemName.trim()) {
    issues.push(buildIssue('itemName', 'MISSING_ITEM_NAME', 'Thiếu tên hàng.'));
  }

  if (!raw.unit.trim()) {
    issues.push(buildIssue('unit', 'MISSING_UNIT', 'Thiếu đơn vị tính.'));
  }

  if (!raw.quantity.trim()) {
    issues.push(buildIssue('quantity', 'MISSING_QUANTITY', 'Thiếu số lượng.'));
  } else if (quantityResult.error) {
    issues.push(buildIssue('quantity', 'INVALID_QUANTITY', quantityResult.error));
  }

  return {
    id: `${source}-${rowNumber}-${normalized.hsCode || normalized.itemName || 'unmapped'}`,
    source,
    rowNumber,
    raw,
    normalized,
    issues,
    meta
  };
}
