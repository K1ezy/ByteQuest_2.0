"use client";

import { useState } from "react";
import { clearSharedComputerData, getSupabase } from "@/lib/supabase";

export function usePasswordReset() {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  async function requestResetLink(email: string): Promise<boolean> {
    setIsLoading(true);
    setError(null);
    setStatusMessage(null);
    try {
      const redirectTo = `${window.location.origin}/onboarding?mode=reset`;
      const { error: authError } = await getSupabase().auth.resetPasswordForEmail(email, { redirectTo });
      if (authError) throw authError;
      setStatusMessage("If this address has an account, a password reset link will arrive by email.");
      return true;
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Could not request a password reset.");
      return false;
    } finally {
      setIsLoading(false);
    }
  }

  async function updatePassword(password: string): Promise<boolean> {
    setIsLoading(true);
    setError(null);
    setStatusMessage(null);
    try {
      const { error: authError } = await getSupabase().auth.updateUser({ password });
      if (authError) throw authError;
      await getSupabase().auth.signOut({ scope: "local" });
      clearSharedComputerData();
      setStatusMessage("Password updated. Sign in with your new password.");
      return true;
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Could not update your password.");
      return false;
    } finally {
      setIsLoading(false);
    }
  }

  return { isLoading, error, statusMessage, setError, setStatusMessage, requestResetLink, updatePassword };
}
