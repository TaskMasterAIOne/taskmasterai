import { createContext, useContext, useEffect, useState, ReactNode, useCallback } from 'react'
import {
  User,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
  GoogleAuthProvider,
  signInWithPopup,
  signInWithRedirect,
  getRedirectResult,
  sendPasswordResetEmail,
  updateProfile as firebaseUpdateProfile,
} from 'firebase/auth'
import { doc, setDoc, getDoc, updateDoc, serverTimestamp, onSnapshot } from 'firebase/firestore'
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage'
import { auth, db, storage } from '../lib/firebase'
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
  updateUserProfile: (data: { displayName?: string; photoFile?: File }) => Promise<void>
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
    let unsubscribeUserDoc: (() => void) | null = null
    let unsubscribeLicenseDoc: (() => void) | null = null

    const unsubscribeAuth = onAuthStateChanged(auth, async (firebaseUser) => {
      // Clean up previous listeners when user changes
      if (unsubscribeUserDoc) {
        unsubscribeUserDoc()
        unsubscribeUserDoc = null
      }
      if (unsubscribeLicenseDoc) {
        unsubscribeLicenseDoc()
        unsubscribeLicenseDoc = null
      }

      setUser(firebaseUser)
      
      if (firebaseUser) {
        // Set loading to false immediately after auth check
        setLoading(false)
        
        // Set up real-time listener for user document
        const userDocRef = doc(db, 'users', firebaseUser.uid)
        unsubscribeUserDoc = onSnapshot(userDocRef, async (snapshot) => {
          if (snapshot.exists()) {
            const data = snapshot.data()
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
            
            // Create user document in background
            try {
              await setDoc(userDocRef, {
                uid: firebaseUser.uid,
                email: firebaseUser.email,
                plan: null as UserPlan,
                createdAt: serverTimestamp(),
              })
            } catch (writeError) {
              console.error('Error creating user document:', writeError)
            }
          }
        }, (error) => {
          console.error('Error listening to user document:', error)
          // Set default user data on error so user can still access the app
          setUserData({
            uid: firebaseUser.uid,
            email: firebaseUser.email,
            plan: null,
            displayName: firebaseUser.displayName,
            photoURL: firebaseUser.photoURL,
            createdAt: new Date(),
          })
        })

        // Set up real-time listener for license document
        const licenseDocRef = doc(db, 'users', firebaseUser.uid, 'license', 'current')
        unsubscribeLicenseDoc = onSnapshot(licenseDocRef, async (snapshot) => {
          if (snapshot.exists()) {
            const data = snapshot.data()
            // Convert Firestore Timestamp to ISO string if it exists
            let periodEnd: string | undefined
            if (data.currentPeriodEnd) {
              // Handle Firestore Timestamp, Date object, or string
              if (data.currentPeriodEnd.toDate) {
                periodEnd = data.currentPeriodEnd.toDate().toISOString()
              } else if (data.currentPeriodEnd instanceof Date) {
                periodEnd = data.currentPeriodEnd.toISOString()
              } else if (typeof data.currentPeriodEnd === 'number') {
                // Unix timestamp (seconds)
                periodEnd = new Date(data.currentPeriodEnd * 1000).toISOString()
              } else {
                periodEnd = data.currentPeriodEnd
              }
            }
            setLicenseInfo({
              hasLicense: data.status === 'active' || data.status === 'grace_period',
              licenseKey: data.licenseKey,
              status: data.status,
              plan: data.plan,
              planName: data.planName,
              planPrice: data.planPrice,
              tasksPerMonth: data.tasksPerMonth,
              tasksUsed: data.tasksUsed,
              overageRate: data.overageRate,
              currentPeriodEnd: periodEnd,
              cancelAtPeriodEnd: data.cancelAtPeriodEnd,
            })
          } else {
            // No license document, try fetching via API (fallback)
            fetchLicenseInfo(firebaseUser.uid)
          }
        }, (error) => {
          console.error('Error listening to license document:', error)
          // Fallback to API fetch
          fetchLicenseInfo(firebaseUser.uid)
        })
      } else {
        setUserData(null)
        setLicenseInfo(null)
        setLoading(false)
      }
    })

    return () => {
      unsubscribeAuth()
      if (unsubscribeUserDoc) unsubscribeUserDoc()
      if (unsubscribeLicenseDoc) unsubscribeLicenseDoc()
    }
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
    
    try {
      // Try popup first (better UX)
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
    } catch (error: unknown) {
      const err = error as { code?: string }
      // If popup is blocked or COOP policy blocks it, fall back to redirect
      if (err.code === 'auth/popup-blocked' || err.code === 'auth/popup-closed-by-user') {
        throw error // Re-throw user-cancelled errors
      }
      // For other errors (like COOP), try redirect as fallback
      await signInWithRedirect(auth, provider)
    }
  }

  // Handle redirect result on page load
  useEffect(() => {
    const handleRedirectResult = async () => {
      try {
        const result = await getRedirectResult(auth)
        if (result?.user) {
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
      } catch (error) {
        console.error('Redirect sign-in error:', error)
      }
    }
    handleRedirectResult()
  }, [])

  const logout = async () => {
    await signOut(auth)
  }

  const resetPassword = async (email: string) => {
    await sendPasswordResetEmail(auth, email)
  }

  const updateUserProfile = async (data: { displayName?: string; photoFile?: File }) => {
    if (!user) throw new Error('No user logged in')

    let photoURL = user.photoURL

    // Upload new photo if provided
    if (data.photoFile) {
      const photoRef = ref(storage, `users/${user.uid}/profile.${data.photoFile.name.split('.').pop()}`)
      await uploadBytes(photoRef, data.photoFile)
      photoURL = await getDownloadURL(photoRef)
    }

    // Update Firebase Auth profile
    await firebaseUpdateProfile(user, {
      displayName: data.displayName ?? user.displayName,
      photoURL: photoURL,
    })

    // Update Firestore user document
    await updateDoc(doc(db, 'users', user.uid), {
      displayName: data.displayName ?? user.displayName,
      photoURL: photoURL,
      updatedAt: serverTimestamp(),
    })

    // Update local state
    setUserData(prev => prev ? {
      ...prev,
      displayName: data.displayName ?? prev.displayName,
      photoURL: photoURL,
    } : null)
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
    updateUserProfile,
  }

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  )
}

