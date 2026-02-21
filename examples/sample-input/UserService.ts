import { ApiClient, ApiError } from './ApiClient.js';

export interface User {
  id: string;
  email: string;
  displayName: string;
  createdAt: string;
  isActive: boolean;
}

interface UserApiResponse {
  user: {
    id: string;
    email: string;
    displayName: string;
    createdAt: string;
    isActive: boolean;
  } | null;
}

export class UserNotFoundError extends Error {
  public constructor(userId: string) {
    super(`User with id "${userId}" was not found.`);
    this.name = 'UserNotFoundError';
  }
}

export class UserService {
  private readonly apiClient: ApiClient;

  public constructor(apiClient: ApiClient) {
    this.apiClient = apiClient;
  }

  public async getUserById(id: string): Promise<User> {
    if (id.trim().length === 0) {
      throw new RangeError('id must be a non-empty string.');
    }

    let response: UserApiResponse;

    try {
      response = await this.apiClient.request<UserApiResponse>(`/users/${encodeURIComponent(id)}`);
    } catch (error: unknown) {
      if (error instanceof ApiError && error.status === 404) {
        throw new UserNotFoundError(id);
      }

      throw error;
    }

    if (response.user === null) {
      throw new UserNotFoundError(id);
    }

    return this.validateUser(response.user);
  }

  private validateUser(candidate: UserApiResponse['user']): User {
    if (candidate === null) {
      throw new TypeError('User payload cannot be null.');
    }

    const { id, email, displayName, createdAt, isActive } = candidate;

    if (id.trim().length === 0) {
      throw new TypeError('User id must be a non-empty string.');
    }

    if (!email.includes('@')) {
      throw new TypeError('User email must contain @.');
    }

    if (displayName.trim().length === 0) {
      throw new TypeError('User displayName must be a non-empty string.');
    }

    if (Number.isNaN(Date.parse(createdAt))) {
      throw new TypeError('User createdAt must be a valid ISO date string.');
    }

    return {
      id,
      email,
      displayName,
      createdAt,
      isActive
    };
  }
}
