import { useEffect, useState } from 'react';
import type { CSSProperties, JSX } from 'react';
import type { User } from './UserService.js';
import { UserService } from './UserService.js';

export interface UserCardProps {
  userId: string;
  userService: UserService;
}

type UserCardState =
  | { status: 'loading'; user: null; errorMessage: null }
  | { status: 'ready'; user: User; errorMessage: null }
  | { status: 'error'; user: null; errorMessage: string };

const cardStyle: CSSProperties = {
  backgroundColor: '#ffffff',
  border: '1px solid #dbe3ec',
  borderRadius: '12px',
  boxShadow: '0 4px 12px rgba(15, 23, 42, 0.08)',
  padding: '1rem',
  width: '100%',
  maxWidth: '420px',
  fontFamily: 'Inter, system-ui, sans-serif'
};

export const UserCard = ({ userId, userService }: UserCardProps): JSX.Element => {
  const [state, setState] = useState<UserCardState>({
    status: 'loading',
    user: null,
    errorMessage: null
  });

  useEffect(() => {
    let isCurrent = true;

    const loadUser = async (): Promise<void> => {
      setState({ status: 'loading', user: null, errorMessage: null });

      try {
        const user = await userService.getUserById(userId);
        if (isCurrent) {
          setState({ status: 'ready', user, errorMessage: null });
        }
      } catch (error: unknown) {
        if (isCurrent) {
          const message = error instanceof Error ? error.message : 'Unable to load user.';
          setState({ status: 'error', user: null, errorMessage: message });
        }
      }
    };

    void loadUser();

    return () => {
      isCurrent = false;
    };
  }, [userId, userService]);

  if (state.status === 'loading') {
    return <section style={cardStyle}>Loading user profile…</section>;
  }

  if (state.status === 'error') {
    return (
      <section style={cardStyle}>
        <strong style={{ color: '#b91c1c' }}>Could not load profile</strong>
        <p style={{ margin: '0.5rem 0 0', color: '#475569' }}>{state.errorMessage}</p>
      </section>
    );
  }

  const { user } = state;

  return (
    <section style={cardStyle}>
      <header style={{ marginBottom: '0.75rem' }}>
        <h3 style={{ margin: 0, fontSize: '1.1rem', color: '#0f172a' }}>{user.displayName}</h3>
        <span style={{ color: '#64748b', fontSize: '0.9rem' }}>{user.email}</span>
      </header>
      <dl style={{ margin: 0, display: 'grid', gridTemplateColumns: 'auto 1fr', gap: '0.5rem 0.75rem' }}>
        <dt style={{ fontWeight: 600, color: '#1e293b' }}>User ID</dt>
        <dd style={{ margin: 0, color: '#334155' }}>{user.id}</dd>
        <dt style={{ fontWeight: 600, color: '#1e293b' }}>Status</dt>
        <dd style={{ margin: 0, color: user.isActive ? '#15803d' : '#9f1239' }}>
          {user.isActive ? 'Active' : 'Suspended'}
        </dd>
        <dt style={{ fontWeight: 600, color: '#1e293b' }}>Created</dt>
        <dd style={{ margin: 0, color: '#334155' }}>{new Date(user.createdAt).toLocaleDateString()}</dd>
      </dl>
    </section>
  );
};
