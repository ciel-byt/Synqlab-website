import { useEffect } from "react";

// Sign-in is the product's own /login page, served by the same server. Kept so old links still work.
export default function SignIn() {
  useEffect(() => { window.location.replace("/login"); }, []);
  return null;
}
