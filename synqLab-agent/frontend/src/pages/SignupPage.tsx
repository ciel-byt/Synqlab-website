/**
 * Signup page — disabled.  Redirects to login.
 */
import { Navigate } from 'react-router-dom'

export function SignupPage() {
  return <Navigate to="/login" replace />
}
