# UserCard

## Module Overview
`UserCard` is a dashboard-oriented React component that fetches user details on mount and renders loading, error, or profile states with strict typed props.

## Exported Members
- `interface UserCardProps`
- `const UserCard: ({ userId, userService }: UserCardProps) => JSX.Element`

## Signature
```tsx
export interface UserCardProps {
  userId: string;
  userService: UserService;
}

export const UserCard = ({ userId, userService }: UserCardProps): JSX.Element
```

## Parameters

### `UserCardProps`
| Name | Type | Required | Description |
| --- | --- | --- | --- |
| `userId` | `string` | Yes | Identifier passed into `userService.getUserById`. |
| `userService` | `UserService` | Yes | Service dependency used to retrieve user data. |

### `UserCard(props)`
| Name | Type | Required | Description |
| --- | --- | --- | --- |
| `props` | `UserCardProps` | Yes | Component configuration object. |

## Return Type
The component returns `JSX.Element` and conditionally renders:
- a loading placeholder,
- an error panel with message details,
- or a profile card with identity and account status data.

## Usage Example
```tsx
import { UserCard } from './UserCard';
import { UserService } from './UserService';
import { ApiClient } from './ApiClient';

const userService = new UserService(new ApiClient('https://api.example.com'));

export const Dashboard = (): JSX.Element => {
  return <UserCard userId="usr_42" userService={userService} />;
};
```

## Edge Cases
- Prevents state updates on unmounted components using an `isCurrent` guard.
- Handles thrown service errors and displays a safe fallback message.
- Re-runs fetching logic when either `userId` or `userService` changes.
- Uses strict discriminated union state to ensure exhaustive render branches.
