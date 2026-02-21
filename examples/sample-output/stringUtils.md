# stringUtils

## Module Overview
`stringUtils` provides validated helpers for display-safe string formatting and locale-aware date rendering.

## Exported Members
- `capitalize(input: string): string`
- `truncate(input: string, maxLength: number): string`
- `formatDate(date: Date, locale?: string): string`

## Signature
```ts
export const capitalize = (input: string): string
export const truncate = (input: string, maxLength: number): string
export const formatDate = (date: Date, locale = 'en-US'): string
```

## Parameters

### `capitalize`
| Name | Type | Required | Description |
| --- | --- | --- | --- |
| `input` | `string` | Yes | Source text whose first Unicode symbol is uppercased. |

### `truncate`
| Name | Type | Required | Description |
| --- | --- | --- | --- |
| `input` | `string` | Yes | Value to truncate. |
| `maxLength` | `number` | Yes | Maximum output symbol length, including ellipsis when truncating. |

### `formatDate`
| Name | Type | Required | Description |
| --- | --- | --- | --- |
| `date` | `Date` | Yes | Valid date instance to format. |
| `locale` | `string` | No | Locale identifier used by `Intl.DateTimeFormat`. Defaults to `en-US`. |

## Return Type
- `capitalize` returns a `string` with only the first symbol transformed using locale-aware uppercase rules.
- `truncate` returns a `string` that is either unchanged or shortened with a trailing `…`.
- `formatDate` returns a locale-formatted `string` using medium date and short time styles.

## Usage Example
```ts
import { capitalize, truncate, formatDate } from './stringUtils';

const name = capitalize('maría');
const preview = truncate('Quarterly executive dashboard summary', 16);
const renderedAt = formatDate(new Date('2025-02-03T09:30:00Z'), 'en-GB');
```

## Edge Cases
- Empty strings are handled explicitly (`capitalize('')` returns `''`).
- `truncate` throws `RangeError` when `maxLength` is negative or non-integer.
- Unicode symbols are sliced with `Array.from`, avoiding broken surrogate pairs.
- `formatDate` throws for invalid `Date` values or blank locale strings.
