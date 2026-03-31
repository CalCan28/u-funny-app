import { Platform } from 'react-native';
import { decode } from 'base64-arraybuffer';
import { supabase } from './supabase';

/**
 * Upload an image to Supabase Storage
 * @param uri - Local URI of the image (from expo-image-picker or file input)
 * @param bucket - Storage bucket name (default: 'avatars')
 * @param folder - Folder path within bucket (usually user ID)
 * @returns Object with publicUrl or error
 */
export async function uploadImage(
  uri: string,
  bucket: string = 'avatars',
  folder: string
): Promise<{ publicUrl: string | null; error: string | null }> {
  try {
    // Get file extension from URI
    const ext = uri.split('.').pop()?.toLowerCase()?.split('?')[0] || 'jpg';
    const contentType = ext === 'png' ? 'image/png' : 'image/jpeg';
    const fileName = `${folder}/avatar_${Date.now()}.${ext}`;

    let uploadData: ArrayBuffer | Blob;

    if (Platform.OS === 'web') {
      // Web: fetch the blob URL or data URI and upload directly
      const response = await fetch(uri);
      uploadData = await response.blob();
    } else {
      // Native: read file as base64 then convert to ArrayBuffer
      const FileSystem = require('expo-file-system/legacy');
      const base64 = await FileSystem.readAsStringAsync(uri, {
        encoding: 'base64',
      });
      uploadData = decode(base64);
    }

    // Upload to Supabase Storage
    const { data, error } = await supabase.storage
      .from(bucket)
      .upload(fileName, uploadData, {
        contentType,
        upsert: true,
      });

    if (error) {
      return { publicUrl: null, error: error.message };
    }

    // Get public URL
    const { data: urlData } = supabase.storage
      .from(bucket)
      .getPublicUrl(data.path);

    return { publicUrl: urlData.publicUrl, error: null };
  } catch (err: any) {
    return { publicUrl: null, error: err.message || 'Failed to upload image' };
  }
}

/**
 * Delete an image from Supabase Storage
 * @param url - Public URL of the image to delete
 * @param bucket - Storage bucket name (default: 'avatars')
 */
export async function deleteImage(
  url: string,
  bucket: string = 'avatars'
): Promise<{ success: boolean; error: string | null }> {
  try {
    // Extract path from URL
    const urlParts = url.split(`${bucket}/`);
    if (urlParts.length < 2) {
      return { success: false, error: 'Invalid URL format' };
    }
    const path = urlParts[1];

    const { error } = await supabase.storage.from(bucket).remove([path]);

    if (error) {
      return { success: false, error: error.message };
    }

    return { success: true, error: null };
  } catch (err: any) {
    return { success: false, error: err.message || 'Failed to delete image' };
  }
}

/**
 * Get a signed URL for private images (if bucket is private)
 * @param path - Path to the file in storage
 * @param bucket - Storage bucket name
 * @param expiresIn - Expiration time in seconds (default: 1 hour)
 */
export async function getSignedUrl(
  path: string,
  bucket: string = 'avatars',
  expiresIn: number = 3600
): Promise<{ signedUrl: string | null; error: string | null }> {
  try {
    const { data, error } = await supabase.storage
      .from(bucket)
      .createSignedUrl(path, expiresIn);

    if (error) {
      return { signedUrl: null, error: error.message };
    }

    return { signedUrl: data.signedUrl, error: null };
  } catch (err: any) {
    return { signedUrl: null, error: err.message || 'Failed to get signed URL' };
  }
}
