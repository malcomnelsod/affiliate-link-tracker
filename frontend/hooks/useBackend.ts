import { useAuth } from '../contexts/AuthContext';
import backend from '~backend/client';

export function useBackend() {
  const { user } = useAuth();
  
  if (!user?.token) {
    return backend;
  }
  
  return backend.with({
    auth: async () => {
      if (!user.token) {
        throw new Error('No authentication token available');
      }
      return {
        authorization: `Bearer ${user.token}`
      };
    }
  });
}
