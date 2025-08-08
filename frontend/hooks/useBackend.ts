import { useAuth } from '../contexts/AuthContext';
import backend from '~backend/client';

export function useBackend() {
  const { user } = useAuth();
  
  // Always return the backend client - authentication is handled per request
  return backend;
}
