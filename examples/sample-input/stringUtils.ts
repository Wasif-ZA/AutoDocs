const ELLIPSIS = '…';

const ensureString = (value: string, parameterName: string): void => {
  if (typeof value !== 'string') {
    throw new TypeError(`${parameterName} must be a string.`);
  }
};

const ensureNonNegativeInteger = (value: number, parameterName: string): void => {
  if (!Number.isInteger(value) || value < 0) {
    throw new RangeError(`${parameterName} must be a non-negative integer.`);
  }
};

export const capitalize = (input: string): string => {
  ensureString(input, 'input');

  if (input.length === 0) {
    return '';
  }

  const [firstSymbol, ...remainingSymbols] = Array.from(input);
  return `${firstSymbol.toLocaleUpperCase()}${remainingSymbols.join('')}`;
};

export const truncate = (input: string, maxLength: number): string => {
  ensureString(input, 'input');
  ensureNonNegativeInteger(maxLength, 'maxLength');

  if (maxLength === 0) {
    return '';
  }

  const symbols = Array.from(input);
  if (symbols.length <= maxLength) {
    return input;
  }

  if (maxLength === 1) {
    return ELLIPSIS;
  }

  return `${symbols.slice(0, maxLength - 1).join('')}${ELLIPSIS}`;
};

export const formatDate = (date: Date, locale = 'en-US'): string => {
  if (!(date instanceof Date) || Number.isNaN(date.getTime())) {
    throw new TypeError('date must be a valid Date instance.');
  }

  ensureString(locale, 'locale');
  if (locale.trim().length === 0) {
    throw new RangeError('locale must be a non-empty locale identifier.');
  }

  return new Intl.DateTimeFormat(locale, {
    dateStyle: 'medium',
    timeStyle: 'short'
  }).format(date);
};
