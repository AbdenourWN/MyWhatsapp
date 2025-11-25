import { CLOUDINARY_CLOUD_NAME, CLOUDINARY_UPLOAD_PRESET } from '@env';

export const uploadToCloudinary = async (uri) => {
  if (!uri) return null;

  const url = `https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD_NAME}/image/upload`;

  // 1. Extract the file type from the URI
  let filename = uri.split('/').pop();
  let match = /\.(\w+)$/.exec(filename);
  let type = match ? `image/${match[1]}` : `image`;

  // 2. Create FormData
  let formData = new FormData();
  formData.append('file', {
    uri: uri,
    name: filename,
    type: type,
  });
  formData.append('upload_preset', CLOUDINARY_UPLOAD_PRESET);

  // 3. Send request
  try {
    let response = await fetch(url, {
      method: 'POST',
      body: formData,
      headers: {
        'content-type': 'multipart/form-data',
      },
    });

    let data = await response.json();

    if (data.secure_url) {
      return data.secure_url;
    } else {
      console.error("Cloudinary Error Data:", data);
      throw new Error("Failed to get image URL from Cloudinary");
    }
  } catch (error) {
    console.error("Cloudinary Upload Error:", error);
    throw error;
  }
};