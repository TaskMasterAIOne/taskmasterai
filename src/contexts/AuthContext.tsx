import { createContext, useContext, useEffect, useState, ReactNode, useCallback } from 'react'
import {
  User,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
  GoogleAuthProvider,
  signInWithPopup,
  sendPasswordResetEmail,
} from 'firebase/auth'
import { doc, setDoc, getDoc, serverTimestamp } from 'firebase/firestore'
import { auth, db } from '../lib/firebase'
import { getLicenseInfo, LicenseInfo } from '../lib/stripe'

export type UserPlan = 'plus' | 'pro' | 'team' | 'enterprise' | null

export interface UserData {
  uid: string
  email: string | null
  plan: UserPlan
  displayName: string | null
  photoURL: string | null
  createdAt: Date
  licenseKey?: string
  subscriptionStatus?: string
}

interface AuthContextType {
  user: User | null
  userData: UserData | null
  licenseInfo: LicenseInfo | null
  loading: boolean
  signIn: (email: string, password: string) => Promise<void>
  signUp: (email: string, password: string) => Promise<void>
  signInWithGoogle: () => Promise<void>
  logout: () => Promise<void>
  resetPassword: (email: string) => Promise<void>
  refreshLicenseInfo: () => Promise<void>
}

const AuthContext = createContext<AuthContextType | null>(null)

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}

interface AuthProviderProps {
  children: ReactNode
}

export function AuthProvider({ children }: AuthProviderProps) {
  const [user, setUser] = useState<User | null>(null)
  const [userData, setUserData] = useState<UserData | null>(null)
  const [licenseInfo, setLicenseInfo] = useState<LicenseInfo | null>(null)
  const [loading, setLoading] = useState(true)

  // Function to fetch license info
  const fetchLicenseInfo = useCallback(async (userId: string) => {
    try {
      const info = await getLicenseInfo(userId)
      setLicenseInfo(info)
    } catch (error) {
      console.error('Error fetching license info:', error)
      setLicenseInfo({ hasLicense: false })
    }
  }, [])

  // Public method to refresh license info
  const refreshLicenseInfo = useCallback(async () => {
    if (user?.uid) {
      await fetchLicenseInfo(user.uid)
    }
  }, [user?.uid, fetchLicenseInfo])

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      setUser(firebaseUser)
      
      if (firebaseUser) {
        // Set loading to false immediately after auth check
        // User data will load in background
        setLoading(false)
        
        try {
          const userDoc = await getDoc(doc(db, 'users', firebaseUser.uid))
          if (userDoc.exists()) {
            const data = userDoc.data()
            setUserData({
              uid: firebaseUser.uid,
              email: firebaseUser.email,
              plan: data.plan || null,
              displayName: firebaseUser.displayName,
              photoURL: firebaseUser.photoURL,
              createdAt: data.createdAt?.toDate() || new Date(),
              licenseKey: data.licenseKey,
              subscriptionStatus: data.subscriptionStatus,
            })
            
            // Fetch license info in background
            fetchLicenseInfo(firebaseUser.uid)
          } else {
            // Set default user data immediately
            setUserData({
              uid: firebaseUser.uid,
              email: firebaseUser.email,
              plan: null,
              displayName: firebaseUser.displayName,
              photoURL: firebaseUser.photoURL,
              createdAt: new Date(),
            })
            
            setLicenseInfo({ hasLicense: false })
            
            // Create user document in background
            try {
              await setDoc(doc(db, 'users', firebaseUser.uid), {
                uid: firebaseUser.uid,
                email: firebaseUser.email,
                plan: null as UserPlan,
                createdAt: serverTimestamp(),
              })
            } catch (writeError) {
              console.error('Error creating user document:', writeError)
            }
          }
        } catch (error) {
          console.error('Error fetching user data:', error)
          // Set default user data on error so user can still access the app
          setUserData({
            uid: firebaseUser.uid,
            email: firebaseUser.email,
            plan: null,
            displayName: firebaseUser.displayName,
            photoURL: firebaseUser.photoURL,
            createdAt: new Date(),
          })
          setLicenseInfo({ hasLicense: false })
        }
      } else {
        setUserData(null)
        setLicenseInfo(null)
        setLoading(false)
      }
    })

    return () => unsubscribe()
  }, [fetchLicenseInfo])

  const signIn = async (email: string, password: string) => {
    await signInWithEmailAndPassword(auth, email, password)
  }

  const signUp = async (email: string, password: string) => {
    const result = await createUserWithEmailAndPassword(auth, email, password)
    await setDoc(doc(db, 'users', result.user.uid), {
      uid: result.user.uid,
      email: result.user.email,
      plan: null,
      createdAt: serverTimestamp(),
    })
  }

  const signInWithGoogle = async () => {
    const provider = new GoogleAuthProvider()
    const result = await signInWithPopup(auth, provider)
    
    // Check if user document exists
    const userDoc = await getDoc(doc(db, 'users', result.user.uid))
    if (!userDoc.exists()) {
      await setDoc(doc(db, 'users', result.user.uid), {
        uid: result.user.uid,
        email: result.user.email,
        plan: null,
        createdAt: serverTimestamp(),
      })
    }
  }

  const logout = async () => {
    await signOut(auth)
  }

  const resetPassword = async (email: string) => {
    await sendPasswordResetEmail(auth, email)
  }

  const value = {
    user,
    userData,
    licenseInfo,
    loading,
    signIn,
    signUp,
    signInWithGoogle,
    logout,
    resetPassword,
    refreshLicenseInfo,
  }

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  )
}

