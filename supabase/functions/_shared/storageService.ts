// Port of backend/app/services/storage.py's S3Storage — swapped to the
// native Supabase Storage client (service-role key) instead of a raw S3
// client, but same contract: private bucket, save/delete/signedUrl.
import { createClient } from "@supabase/supabase-js";
import { getSettings } from "./env.ts";

let client: ReturnType<typeof createClient> | null = null;

function storageClient() {
  if (client) return client;
  const settings = getSettings();
  client = createClient(settings.supabaseUrl, settings.supabaseServiceRoleKey);
  return client;
}

export async function saveObject(
  key: string,
  data: Uint8Array,
  contentType: string,
): Promise<string> {
  const settings = getSettings();
  const { error } = await storageClient()
    .storage.from(settings.storageBucket)
    .upload(key, data, { contentType, upsert: false });
  if (error) throw error;
  return key;
}

export async function deleteObject(key: string): Promise<void> {
  const settings = getSettings();
  const { error } = await storageClient()
    .storage.from(settings.storageBucket)
    .remove([key]);
  if (error) console.error(`Failed to delete object ${key}:`, error);
}

/** 1h presigned URL — matches the existing S3Storage default (no public base URL). */
export async function signedUrl(key: string): Promise<string> {
  const settings = getSettings();
  const { data, error } = await storageClient()
    .storage.from(settings.storageBucket)
    .createSignedUrl(key, 3600);
  if (error) throw error;
  return data.signedUrl;
}
