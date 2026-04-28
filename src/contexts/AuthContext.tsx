import { createContext, useContext, useEffect, useState, useRef, ReactNode } from 'react';
import { User, signInWithPopup, signOut as firebaseSignOut, onAuthStateChanged } from 'firebase/auth';
import { doc, setDoc, getDoc } from 'firebase/firestore';
import { auth, db, googleProvider } from '../lib/firebase';

export interface UserProfile {
  id: string;
  email: string;
  display_name: string | null;
  location: string | null;
}

interface AuthContextType {
  user: User | null;
  userProfile: UserProfile | null;
  loading: boolean;
  signInWithGoogle: () => Promise<void>;
  signOut: () => Promise<void>;
}

const PROFILE_CACHE_KEY = 'agrivision_user_profile';

const getCachedProfile = (): UserProfile | null => {
  try {
    const cached = sessionStorage.getItem(PROFILE_CACHE_KEY);
    return cached ? JSON.parse(cached) : null;
  } catch {
    return null;
  }
};

const setCachedProfile = (profile: UserProfile | null) => {
  try {
    if (profile) {
      sessionStorage.setItem(PROFILE_CACHE_KEY, JSON.stringify(profile));
    } else {
      sessionStorage.removeItem(PROFILE_CACHE_KEY);
    }
  } catch {
    // sessionStorage not available
  }
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  // Flag to prevent duplicate profile fetches
  const profileFetchedRef = useRef(false);

  const createOrUpdateUserProfile = async (firebaseUser: User): Promise<UserProfile | null> => {
    try {
      const userRef = doc(db, 'users', firebaseUser.uid);
      const userSnap = await getDoc(userRef);

      let profile: UserProfile;
      if (userSnap.exists()) {
        profile = userSnap.data() as UserProfile;
      } else {
        profile = {
          id: firebaseUser.uid,
          email: firebaseUser.email || '',
          display_name: firebaseUser.displayName,
          location: null,
        };
        await setDoc(userRef, profile);
      }

      setUserProfile(profile);
      setCachedProfile(profile);
      return profile;
    } catch (error) {
      console.error('Error managing user profile:', error);
      // On error, still allow login — create a local profile from Firebase user data
      const fallbackProfile: UserProfile = {
        id: firebaseUser.uid,
        email: firebaseUser.email || '',
        display_name: firebaseUser.displayName,
        location: null,
      };
      setUserProfile(fallbackProfile);
      return fallbackProfile;
    }
  };

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (firebaseUser) => {
      setUser(firebaseUser);

      if (firebaseUser) {
        // If profile was already fetched by signInWithGoogle, skip redundant fetch
        if (profileFetchedRef.current) {
          profileFetchedRef.current = false;
          setLoading(false);
          return;
        }

        // Try loading from cache first for instant UI
        const cachedProfile = getCachedProfile();
        if (cachedProfile && cachedProfile.id === firebaseUser.uid) {
          setUserProfile(cachedProfile);
          setLoading(false);
          // Refresh from Firestore in background (non-blocking)
          createOrUpdateUserProfile(firebaseUser);
        } else {
          // No cache — fetch from Firestore
          createOrUpdateUserProfile(firebaseUser).finally(() => {
            setLoading(false);
          });
        }
      } else {
        setUserProfile(null);
        setCachedProfile(null);
        setLoading(false);
      }
    });

    return () => unsubscribe();
  }, []);

  const signInWithGoogle = async () => {
    try {
      const result = await signInWithPopup(auth, googleProvider);
      // Mark that we're handling the profile here, so onAuthStateChanged skips it
      profileFetchedRef.current = true;
      await createOrUpdateUserProfile(result.user);
    } catch (error) {
      console.error('Error signing in with Google:', error);
      throw error;
    }
  };

  const signOut = async () => {
    try {
      await firebaseSignOut(auth);
      setUserProfile(null);
      setCachedProfile(null);
    } catch (error) {
      console.error('Error signing out:', error);
      throw error;
    }
  };

  const value = {
    user,
    userProfile,
    loading,
    signInWithGoogle,
    signOut,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};
