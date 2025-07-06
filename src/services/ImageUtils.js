import * as ImageManipulator from 'expo-image-manipulator';

// Takes a local image URI, returns a new URI with EXIF rotation applied and EXIF stripped
export async function getDisplayAndVisionImage(uri) {
  const result = await ImageManipulator.manipulateAsync(
    uri,
    [], // no resize/crop, just auto-rotate
    { compress: 1, format: ImageManipulator.SaveFormat.JPEG, base64: false }
  );
  return result.uri;
}