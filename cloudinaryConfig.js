import { CLOUDINARY_CLOUD_NAME, CLOUDINARY_UPLOAD_PRESET } from "@env";

export const uploadToCloudinary = async (uri, type = "image", fileName = "upload") => {
  if (!uri) return null;

  // Map app types to Cloudinary resource types
  // 'image' -> 'image'
  // 'audio' -> 'video' (Cloudinary treats audio as video)
  // 'file'  -> 'raw'   (For PDF, DOC, ZIP, etc.)
  let resourceType = "image";
  if (type === "audio") resourceType = "video";
  if (type === "file") resourceType = "raw";

  const url = `https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD_NAME}/${resourceType}/upload`;

  // Determine extension
  let ext = "jpg";
  if (fileName) {
    const parts = fileName.split(".");
    if (parts.length > 1) ext = parts.pop();
  }
  
  // Create FormData
  let formData = new FormData();
  formData.append("file", {
    uri: uri,
    name: fileName || `upload.${ext}`,
    type: type === "audio" ? "audio/m4a" : (type === "file" ? "*/*" : `image/${ext}`),
  });
  formData.append("upload_preset", CLOUDINARY_UPLOAD_PRESET);

  try {
    let response = await fetch(url, {
      method: "POST",
      body: formData,
      headers: { "content-type": "multipart/form-data" },
    });

    let data = await response.json();
    if (data.secure_url) {
      return data.secure_url;
    } else {
      console.error("Cloudinary Error:", data);
      throw new Error(data.error?.message || "Upload failed");
    }
  } catch (error) {
    console.error("Upload Error:", error);
    throw error;
  }
};