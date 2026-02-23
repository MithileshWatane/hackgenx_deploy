import React, { createContext, useContext, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

const AuthContext = createContext()

export function useAuth() {
  return useContext(AuthContext)
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [userRole, setUserRole] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    // Check active sessions and sets the user
    const getSession = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession()
        
        if (session) {
          setUser(session.user)
          // Get role from user metadata
          const role = session.user.user_metadata?.role || 'doctor'
          setUserRole(role)
        }
      } catch (error) {
        console.error('Error getting session:', error)
      } finally {
        setLoading(false)
      }
    }

    getSession()

    // Listen for changes on auth state (logged in, signed out, etc.)
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        try {
          if (session) {
            setUser(session.user)
            // Get role from user metadata
            const role = session.user.user_metadata?.role || 'doctor'
            setUserRole(role)
          } else {
            setUser(null)
            setUserRole(null)
          }
        } catch (error) {
          console.error('Error in auth state change:', error)
        } finally {
          setLoading(false)
        }
      }
    )

    return () => subscription.unsubscribe()
  }, [])

  const signUp = async (email, password, role, addressData) => {
    try {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            role: role,
            ...addressData
          }
        }
      })

      if (error) throw error

      // Store role in state
      if (data.user && role) {
        setUserRole(role)
      }

      // Update user profile with address information and coordinates after signup
      if (data.user) {
        const updateData = {
          role: role,
          street: addressData?.street,
          city: addressData?.city,
          state: addressData?.state,
          zip_code: addressData?.zipCode,
          country: addressData?.country || 'India',
          // Only store coordinates for doctors, NULL for patients
          latitude: role === 'doctor' ? addressData?.latitude : null,
          longitude: role === 'doctor' ? addressData?.longitude : null
        };

        const { error: updateError } = await supabase
          .from('user_profiles')
          .update(updateData)
          .eq('id', data.user.id)
        
        if (updateError) {
          console.error('Error updating profile with address:', updateError)
        }
      }

      return { data, error: null }
    } catch (error) {
      return { data: null, error }
    }
  }

  const signIn = async (email, password) => {
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      })

      if (error) throw error

      // Get role from user metadata
      if (data.user) {
        const role = data.user.user_metadata?.role || 'doctor'
        setUserRole(role)
      }

      return { data, error: null }
    } catch (error) {
      return { data: null, error }
    }
  }

  const signOut = async () => {
    try {
      const { error } = await supabase.auth.signOut()
      if (error) throw error
      return { error: null }
    } catch (error) {
      return { error }
    }
  }

  const value = {
    user,
    userRole,
    loading,
    signUp,
    signIn,
    signOut,
  }

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  )
}
