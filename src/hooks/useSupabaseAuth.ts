import { useState } from "react";
import {
  getCurrentUser,
  signInWithPassword,
  signOut as signOutFromSupabase,
  signUp,
} from "@/lib/supabase-auth";
import { useProjectStore, type CloudSyncUser } from "@/stores/project-store";

export function useSupabaseAuth() {
  const cloudSyncSettings = useProjectStore((state) => state.cloudSyncSettings);
  const updateCloudSyncSettings = useProjectStore((state) => state.updateCloudSyncSettings);
  const [isLoading, setIsLoading] = useState(false);

  const config = {
    supabaseUrl: cloudSyncSettings.supabaseUrl,
    supabaseAnonKey: cloudSyncSettings.supabaseAnonKey,
  };

  const setAuthenticatedUser = (user: CloudSyncUser) => {
    updateCloudSyncSettings({
      isEnabled: true,
      isConnected: true,
      authState: "authenticated",
      user,
    });
  };

  const signIn = async (email: string, password: string) => {
    setIsLoading(true);
    updateCloudSyncSettings({ authState: "authenticating" });
    try {
      const user = await signInWithPassword({ ...config, email, password });
      setAuthenticatedUser(user);
      return user;
    } catch (error) {
      updateCloudSyncSettings({ authState: "error", user: null });
      throw error;
    } finally {
      setIsLoading(false);
    }
  };

  const createAccount = async (email: string, password: string) => {
    setIsLoading(true);
    updateCloudSyncSettings({ authState: "authenticating" });
    try {
      const user = await signUp({ ...config, email, password });
      setAuthenticatedUser(user);
      return user;
    } catch (error) {
      updateCloudSyncSettings({ authState: "error", user: null });
      throw error;
    } finally {
      setIsLoading(false);
    }
  };

  const refreshCurrentUser = async () => {
    if (!cloudSyncSettings.isEnabled) return null;
    console.info("[mitru:cloud-sync] refreshCurrentUser requested");
    setIsLoading(true);
    try {
      const user = await getCurrentUser(config);
      updateCloudSyncSettings({
        authState: user ? "authenticated" : "idle",
        user,
      });
      return user;
    } finally {
      setIsLoading(false);
    }
  };

  const signOut = async () => {
    setIsLoading(true);
    let didFail = false;
    try {
      console.info("[mitru:cloud-sync] signOut requested");
      await signOutFromSupabase(config);
      console.info("[mitru:cloud-sync] signOut succeeded");
    } catch (error) {
      didFail = true;
      console.error("[mitru:cloud-sync] signOut failed", error);
      updateCloudSyncSettings({
        authState: "error",
        user: null,
        isConnected: false,
      });
      throw error;
    } finally {
      updateCloudSyncSettings({
        authState: didFail ? "error" : "idle",
        user: null,
        isConnected: false,
      });
      setIsLoading(false);
    }
  };

  return {
    isLoading,
    user: cloudSyncSettings.user,
    authState: cloudSyncSettings.authState,
    signIn,
    createAccount,
    refreshCurrentUser,
    signOut,
  };
}
