# UserService

## Module Overview
`UserService` is a domain-layer abstraction for retrieving users through `ApiClient`, validating user payloads, and converting transport errors into domain-specific failures.

## Exported Members
- `interface User`
- `class UserNotFoundError extends Error`
- `class UserService`
- `UserService.getUserById(id: string): Promise<User>`

## Signature
```ts
export interface User {
  id: string;
  email: string;
  displayName: string;
  createdAt: string;
  isActive: boolean;
}

export class UserNotFoundError extends Error

export class UserService {
  getUserById(id: string): Promise<User>
}
```

## Parameters

### `new UserNotFoundError(userId)`
| Name | Type | Required | Description |
| --- | --- | --- | --- |
| `userId` | `string` | Yes | Identifier that could not be located. |

### `new UserService(apiClient)`
| Name | Type | Required | Description |
| --- | --- | --- | --- |
| `apiClient` | `ApiClient` | Yes | Injected infrastructure client used for HTTP access. |

### `getUserById(id)`
| Name | Type | Required | Description |
| --- | --- | --- | --- |
| `id` | `string` | Yes | Target user identifier. |

## Return Type
`getUserById` returns `Promise<User>`. The promise resolves only after API data passes domain validation for id, email format, display name, timestamp validity, and active flag.

## Usage Example
```ts
import { ApiClient } from './ApiClient';
import { UserNotFoundError, UserService } from './UserService';

const apiClient = new ApiClient('https://api.example.com');
const userService = new UserService(apiClient);

try {
  const user = await userService.getUserById('usr_123');
  // render user profile
} catch (error: unknown) {
  if (error instanceof UserNotFoundError) {
    // render empty state
  }
}
```

## Edge Cases
- Throws `RangeError` when `id` is empty.
- Converts `ApiError` 404 responses to `UserNotFoundError`.
- Throws `UserNotFoundError` for successful responses containing `user: null`.
- Throws `TypeError` when API payload violates domain constraints (email/date/name).
