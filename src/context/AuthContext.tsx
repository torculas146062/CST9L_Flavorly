import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';

import {
  changePassword as changePasswordInStore,
  loadSession,
  signIn as signInToStore,
  signOut as signOutFromStore,
  signUp as signUpToStore,
  updateProfile as updateProfileInStore,
  type LocalUser,
} from '../storage/authStore';

type AuthValue = {
  /** False until the stored session has been read. */
  ready: boolean;
  user: LocalUser | null;
  /** Rejects with a message meant for the form. */
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (name: string, email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  /** Rejects with a message meant for the form. */
  updateProfile: (changes: { name?: string; email?: string }) => Promise<void>;
  /** Rejects with a message meant for the form. */
  changePassword: (currentPassword: string, newPassword: string) => Promise<void>;
};

const AuthContext = createContext<AuthValue | null>(null);

/**
 * Local-only accounts: there is no backend yet, so sessions live in AsyncStorage
 * (`src/storage/authStore.ts`). Signing out clears the session and nothing else — places,
 * photos and ratings stay on the device.
 */
export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<LocalUser | null>(null);
  const [ready, setReady] = useState(false);
  const isMounted = useRef(true);

  useEffect(() => {
    isMounted.current = true;
    return () => {
      isMounted.current = false;
    };
  }, []);

  useEffect(() => {
    void loadSession().then((session) => {
      if (isMounted.current) {
        setUser(session);
        setReady(true);
      }
    });
  }, []);

  const signIn = useCallback(async (email: string, password: string) => {
    const signedIn = await signInToStore({ email, password });
    if (isMounted.current) {
      setUser(signedIn);
    }
  }, []);

  const signUp = useCallback(async (name: string, email: string, password: string) => {
    const created = await signUpToStore({ name, email, password });
    if (isMounted.current) {
      setUser(created);
    }
  }, []);

  const signOut = useCallback(async () => {
    await signOutFromStore();
    if (isMounted.current) {
      setUser(null);
    }
  }, []);

  const updateProfile = useCallback(
    async (changes: { name?: string; email?: string }) => {
      if (!user) {
        throw new Error('You are not signed in.');
      }
      const updated = await updateProfileInStore(user.id, changes);
      if (isMounted.current) {
        setUser(updated);
      }
    },
    [user],
  );

  const changePassword = useCallback(
    async (currentPassword: string, newPassword: string) => {
      if (!user) {
        throw new Error('You are not signed in.');
      }
      await changePasswordInStore(user.id, currentPassword, newPassword);
    },
    [user],
  );

  const value = useMemo<AuthValue>(
    () => ({ ready, user, signIn, signUp, signOut, updateProfile, changePassword }),
    [ready, user, signIn, signUp, signOut, updateProfile, changePassword],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthValue {
  const value = useContext(AuthContext);
  if (!value) {
    throw new Error('useAuth must be used inside an AuthProvider');
  }
  return value;
}
