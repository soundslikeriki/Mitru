import {
  createSupabaseClient,
  forgetSupabaseClient,
  type SupabaseConnectionConfig,
} from "@/lib/supabase";
import type { CloudSyncUser } from "@/stores/project-store";

export type SupabaseAuthCredentials = SupabaseConnectionConfig & {
  email: string;
  password: string;
};

export function normalizeSupabaseUser(user: {
  id: string;
  email?: string | null;
  user_metadata?: Record<string, unknown>;
}): CloudSyncUser {
  const name =
    typeof user.user_metadata?.name === "string"
      ? user.user_metadata.name
      : typeof user.user_metadata?.full_name === "string"
        ? user.user_metadata.full_name
        : "";

  return {
    id: user.id,
    email: user.email ?? "",
    name,
  };
}

export async function signUp(credentials: SupabaseAuthCredentials): Promise<CloudSyncUser> {
  const client = createSupabaseClient(credentials);
  const { data, error } = await client.auth.signUp({
    email: credentials.email.trim(),
    password: credentials.password,
  });

  if (error) throw new Error(toFriendlyAuthError(error.message));
  if (!data.user) throw new Error("アカウント作成に失敗しました。メール確認が必要な場合があります。");
  return normalizeSupabaseUser(data.user);
}

export async function signInWithPassword(credentials: SupabaseAuthCredentials): Promise<CloudSyncUser> {
  const client = createSupabaseClient(credentials);
  const { data, error } = await client.auth.signInWithPassword({
    email: credentials.email.trim(),
    password: credentials.password,
  });

  if (error) throw new Error(toFriendlyAuthError(error.message));
  if (!data.user) throw new Error("ログインできませんでした。メールアドレスとパスワードを確認してください。");
  return normalizeSupabaseUser(data.user);
}

export async function signOut(config: SupabaseConnectionConfig): Promise<void> {
  const client = createSupabaseClient(config);
  const { data: beforeSignOut } = await client.auth.getSession();
  console.info("[mitru:cloud-sync] Supabase signOut start", {
    hasSession: Boolean(beforeSignOut.session),
  });

  const { error } = await client.auth.signOut();
  if (error) throw new Error(toFriendlyAuthError(error.message));

  const { data: afterSignOut } = await client.auth.getSession();
  console.info("[mitru:cloud-sync] Supabase signOut complete", {
    hasSession: Boolean(afterSignOut.session),
  });
  forgetSupabaseClient(config);
}

export async function getCurrentUser(config: SupabaseConnectionConfig): Promise<CloudSyncUser | null> {
  const client = createSupabaseClient(config);
  const { data, error } = await client.auth.getUser();
  if (error || !data.user) return null;
  return normalizeSupabaseUser(data.user);
}

function toFriendlyAuthError(message: string) {
  const lower = message.toLowerCase();
  if (lower.includes("invalid login credentials")) {
    return "メールアドレスまたはパスワードが正しくありません。";
  }
  if (lower.includes("email not confirmed")) {
    return "メール確認が完了していません。Supabaseから届いた確認メールをご確認ください。";
  }
  if (lower.includes("password")) {
    return "パスワードの条件を確認してください。";
  }
  return message || "Supabase認証に失敗しました。";
}
