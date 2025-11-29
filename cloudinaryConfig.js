import { CLOUDINARY_CLOUD_NAME, CLOUDINARY_UPLOAD_PRESET } from "@env";

export const uploadToCloudinary = async (uri, type = "image") => {
  if (!uri) return null;

  const resourceType = type === "audio" ? "video" : "image";

  const url = `https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD_NAME}/${resourceType}/upload`;

  let filename = uri.split("/").pop();
  let match = /\.(\w+)$/.exec(filename);
  let ext = match ? match[1] : type === "audio" ? "m4a" : "jpg"; // Default extension

  let formData = new FormData();
  formData.append("file", {
    uri: uri,
    name: `upload.${ext}`,
    type: type === "audio" ? "audio/m4a" : `image/${ext}`,
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
