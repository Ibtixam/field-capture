import { Directory, File, Paths } from 'expo-file-system';
import * as ImagePicker from 'expo-image-picker';

/**
 * Picker/camera results live in a cache dir the OS may purge. Copy into the
 * app's document directory so the photo survives until it has been synced.
 */
const photosDir = () => new Directory(Paths.document, 'captures');

export async function persistPhoto(tempUri: string, id: string): Promise<string> {
  const dir = photosDir();
  dir.create({ idempotent: true, intermediates: true });
  const ext = tempUri.split('.').pop()?.split('?')[0] || 'jpg';
  const dest = new File(dir, `${id}.${ext}`);
  await new File(tempUri).copy(dest);
  return dest.uri;
}

export function deleteAllPhotos() {
  const dir = photosDir();
  if (dir.exists) dir.delete();
}

/** Camera on device, library fallback (e.g. iOS simulator has no camera). */
export async function takePhoto(): Promise<string | null> {
  const cam = await ImagePicker.requestCameraPermissionsAsync();
  const opts: ImagePicker.ImagePickerOptions = { mediaTypes: ['images'], quality: 0.6 };
  try {
    if (cam.granted) {
      const res = await ImagePicker.launchCameraAsync(opts);
      if (!res.canceled) return res.assets[0]?.uri ?? null;
      return null;
    }
  } catch {
    // No camera available; fall through to the library.
  }
  const res = await ImagePicker.launchImageLibraryAsync(opts);
  return res.canceled ? null : res.assets[0]?.uri ?? null;
}
