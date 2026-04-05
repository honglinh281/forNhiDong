import Decimal from 'decimal.js';

import { UNIT_NORMALIZATION_GROUPS } from '@/lib/constants';

export function stringifyValue(value) {
  if (value === null || value === undefined) {
    return '';
  }

  return String(value);
}

export function stripDiacritics(value) {
  return stringifyValue(value)
    .replace(/đ/gu, 'd')
    .replace(/Đ/gu, 'D')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

export function normalizeText(value) {
  return stringifyValue(value).trim().replace(/\s+/g, ' ').toLowerCase();
}

export function normalizeHeader(value) {
  return stripDiacritics(normalizeText(value)).replace(/[^a-z0-9]+/g, ' ').trim();
}

export function normalizeHsCode(value) {
  return stringifyValue(value).replace(/\D/g, '');
}

export function normalizeUnitKey(value) {
  return stripDiacritics(normalizeText(value)).replace(/[^a-z0-9]+/g, ' ').trim();
}

const UNIT_LOOKUP = new Map(
  Object.entries(UNIT_NORMALIZATION_GROUPS).flatMap(([canonical, aliases]) =>
    aliases.map((alias) => [normalizeUnitKey(alias), canonical])
  )
);

export function normalizeUnit(value) {
  const key = normalizeUnitKey(value);

  if (!key) {
    return '';
  }

  return UNIT_LOOKUP.get(key) ?? key;
}

function trimTrailingZeros(value) {
  return value.replace(/(\.\d*?[1-9])0+$/u, '$1').replace(/\.0+$/u, '').replace(/\.$/u, '');
}

function normalizeSingleSeparator(value, separator) {
  const parts = value.split(separator);

  if (parts.length === 1) {
    return value;
  }

  const [firstPart, ...rest] = parts;

  if (rest.length === 1) {
    const [lastPart] = rest;
    if (lastPart.length === 3 && /^\d+$/u.test(firstPart) && /^\d+$/u.test(lastPart)) {
      return `${firstPart}${lastPart}`;
    }

    return `${firstPart}.${lastPart}`;
  }

  if (rest.every((part) => /^\d{3}$/u.test(part))) {
    return [firstPart, ...rest].join('');
  }

  const decimalPart = rest.pop();
  return `${[firstPart, ...rest].join('')}.${decimalPart}`;
}

function toCanonicalQuantity(rawValue) {
  const stripped = stringifyValue(rawValue).trim().replace(/\s+/g, '').replace(/[^\d,.\-]/g, '');

  if (!/\d/u.test(stripped)) {
    return '';
  }

  const isNegative = stripped.startsWith('-');
  const unsigned = stripped.replace(/-/g, '');

  if (!unsigned) {
    return '';
  }

  let canonical = unsigned;

  if (unsigned.includes(',') && unsigned.includes('.')) {
    const lastComma = unsigned.lastIndexOf(',');
    const lastDot = unsigned.lastIndexOf('.');
    const decimalSeparator = lastComma > lastDot ? ',' : '.';
    const thousandSeparator = decimalSeparator === ',' ? '.' : ',';
    canonical = unsigned.replaceAll(thousandSeparator, '').replace(decimalSeparator, '.');
  } else if (unsigned.includes(',')) {
    canonical = normalizeSingleSeparator(unsigned, ',');
  } else if (unsigned.includes('.')) {
    canonical = normalizeSingleSeparator(unsigned, '.');
  }

  if (canonical.startsWith('.')) {
    canonical = `0${canonical}`;
  }

  if (isNegative && canonical !== '0') {
    canonical = `-${canonical}`;
  }

  return canonical;
}

export function normalizeQuantity(value) {
  const canonical = toCanonicalQuantity(value);

  if (!canonical) {
    return '';
  }

  const decimal = new Decimal(canonical);
  return trimTrailingZeros(decimal.toFixed(decimal.decimalPlaces()));
}

export function safeNormalizeQuantity(value) {
  const raw = stringifyValue(value).trim();

  if (!raw) {
    return { normalized: '', error: null };
  }

  try {
    const normalized = normalizeQuantity(raw);

    if (!normalized) {
      return {
        normalized: '',
        error: `Không đọc được số lượng từ giá trị "${raw}".`
      };
    }

    return { normalized, error: null };
  } catch (error) {
    return {
      normalized: '',
      error: `Số lượng không hợp lệ: "${raw}".`
    };
  }
}

export function hasAllowedExtension(fileName, allowedExtensions) {
  const lowerName = stringifyValue(fileName).toLowerCase();
  return allowedExtensions.some((extension) => lowerName.endsWith(extension));
}
