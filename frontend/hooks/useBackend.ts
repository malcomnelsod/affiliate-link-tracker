import { useAuth } from '../contexts/AuthContext';
import backend from '~backend/client';

export function useBackend() {
  const { user } = useAuth();
  
  if (!user) return backend;
  
  return backend.with({
    auth: async () => ({
      authorization: `Bearer ${user.token}`
    })
  });
}
