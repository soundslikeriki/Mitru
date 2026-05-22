import { createClient, type SupabaseClient } from "@supabase/supabase-js";

export type SupabaseConnectionConfig = {
  supabaseUrl: string;
  supabaseAnonKey: string;
};

export type SupabaseConnectionResult = {
  ok: boolean;
  message: string;
};

const supabaseClientCache = new Map<string, SupabaseClient>();

function normalizeSupabaseUrl(value: string) {
  return value.trim().replace(/\/+$/, "");
}

function validateSupabaseConfig(config: SupabaseConnectionConfig) {
  const supabaseUrl = normalizeSupabaseUrl(config.supabaseUrl);
  const supabaseAnonKey = config.supabaseAnonKey.trim();

  if (!supabaseUrl) {
    throw new Error("Supabase Project URLを入力してください。");
  }
  if (!supabaseAnonKey) {
    throw new Error("Supabase Anon Keyを入力してください。");
  }
  try {
    const parsed = new URL(supabaseUrl);
    if (!["http:", "https:"].includes(parsed.protocol)) {
      throw new Error("invalid protocol");
    }
  } catch {
    throw new Error("Supabase Project URLの形式が正しくありません。");
  }

  return { supabaseUrl, supabaseAnonKey };
}

export function createSupabaseClient(
  config: SupabaseConnectionConfig,
): SupabaseClient {
  const { supabaseUrl, supabaseAnonKey } = validateSupabaseConfig(config);
  const cacheKey = getSupabaseClientCacheKey({ supabaseUrl, supabaseAnonKey });
  const cachedClient = supabaseClientCache.get(cacheKey);

  if (cachedClient) {
    return cachedClient;
  }

  const client = createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
      autoRefreshToken: true,
      detectSessionInUrl: false,
      persistSession: true,
      storageKey: `mitru-supabase-auth-${stableHash(cacheKey)}`,
    },
  });

  supabaseClientCache.set(cacheKey, client);
  return client;
}

export function forgetSupabaseClient(config: SupabaseConnectionConfig) {
  const { supabaseUrl, supabaseAnonKey } = validateSupabaseConfig(config);
  supabaseClientCache.delete(
    getSupabaseClientCacheKey({ supabaseUrl, supabaseAnonKey }),
  );
}

function getSupabaseClientCacheKey(config: SupabaseConnectionConfig) {
  return `${config.supabaseUrl}::${config.supabaseAnonKey}`;
}

function stableHash(value: string) {
  let hash = 0;
  for (let index = 0; index < value.length; index += 1) {
    hash = (hash * 31 + value.charCodeAt(index)) >>> 0;
  }
  return hash.toString(36);
}

export async function testSupabaseConnection(
  config: SupabaseConnectionConfig,
): Promise<SupabaseConnectionResult> {
  const { supabaseUrl, supabaseAnonKey } = validateSupabaseConfig(config);
  const client = createSupabaseClient({ supabaseUrl, supabaseAnonKey });

  try {
    const { error } = await client
      .from("__mitru_connection_check__")
      .select("id")
      .limit(1);

    if (!error) {
      return { ok: true, message: "Supabaseへの接続を確認しました。" };
    }

    const message = error.message.toLowerCase();
    const isExpectedMissingTable =
      error.code === "PGRST205" ||
      error.code === "42P01" ||
      message.includes("could not find the table") ||
      message.includes("relation") && message.includes("does not exist");

    if (isExpectedMissingTable) {
      return {
        ok: true,
        message: "Supabaseへ接続できました。同期用テーブルが未作成の場合は、ヘルプのSQLを実行してから同期してください。",
      };
    }

    throw new Error(error.message || "Supabaseへの接続に失敗しました。");
  } catch (error) {
    if (error instanceof Error) {
      throw error;
    }
    throw new Error("Supabaseへの接続に失敗しました。");
  }
}
