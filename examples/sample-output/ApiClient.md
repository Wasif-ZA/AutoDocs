# ApiClient

## Module Overview
`ApiClient` encapsulates HTTP request behavior with typed responses, timeout control, and exponential backoff retries.

## Exported Members
- `class ApiError extends Error`
- `class ApiClient`
- `ApiClient.request<T>(endpoint: string, options?: RequestInit): Promise<T>`

## Signature
```ts
export class ApiError extends Error
export class ApiClient {
  request<T>(endpoint: string, options?: RequestInit): Promise<T>
}
```

## Parameters

### `new ApiError(message, status, endpoint, details?)`
| Name | Type | Required | Description |
| --- | --- | --- | --- |
| `message` | `string` | Yes | Human-readable summary. |
| `status` | `number` | Yes | HTTP status or synthetic failure status. |
| `endpoint` | `string` | Yes | Endpoint involved in failure. |
| `details` | `string` | No | Raw response detail string for diagnostics. |

### `new ApiClient(baseUrl, timeoutMs?)`
| Name | Type | Required | Description |
| --- | --- | --- | --- |
| `baseUrl` | `string` | Yes | Service base URL without trailing slash requirement. |
| `timeoutMs` | `number` | No | Per-attempt timeout in milliseconds. Defaults to `5000`. |

### `request<T>(endpoint, options?)`
| Name | Type | Required | Description |
| --- | --- | --- | --- |
| `endpoint` | `string` | Yes | Path appended to `baseUrl`. |
| `options` | `RequestInit` | No | Standard Fetch options merged with default JSON headers. |

## Return Type
`request<T>` resolves to `Promise<T>`, where `T` is the expected JSON payload shape. The method only accepts JSON object or array payloads and throws `ApiError` otherwise.

## Usage Example
```ts
import { ApiClient } from './ApiClient';

interface UserDto {
  id: string;
  email: string;
}

const apiClient = new ApiClient('https://api.example.com', 4000);
const user = await apiClient.request<UserDto>('/users/42', {
  method: 'GET',
  headers: {
    Authorization: 'Bearer token'
  }
});
```

## Edge Cases
- Retries up to three attempts for network errors, aborts, and 5xx failures.
- Stops retrying immediately for 4xx `ApiError` responses.
- Uses `AbortController` to enforce timeout and supports caller-provided abort signals.
- Throws `ApiError` when endpoint is blank or response body is not valid object/array JSON.
