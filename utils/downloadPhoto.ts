function forceDownload(blobUrl: string, filename: string) {
  const a = document.createElement("a");
  a.download = filename;
  a.href = blobUrl;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => window.URL.revokeObjectURL(blobUrl), 1000);
}

export default function downloadPhoto(url: string, filename: string) {
  fetch(url, {
    mode: "cors",
  })
    .then((response) => {
      if (!response.ok) {
        throw new Error(`Failed to fetch photo for download: ${response.statusText}`);
      }
      return response.blob();
    })
    .then((blob) => {
      const blobUrl = window.URL.createObjectURL(blob);
      forceDownload(blobUrl, filename);
    })
    .catch((e) => console.error("Error downloading photo:", e));
}
