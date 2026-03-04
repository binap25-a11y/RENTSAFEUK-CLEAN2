"use client";

import React from "react";

function UploadImage() {
  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    console.log("File input triggered");

    if (!e.target.files?.length) {
      console.log("No file selected");
      return;
    }

    const file = e.target.files[0];
    console.log("File selected:", file.name);

    const formData = new FormData();
    formData.append("file", file);

    const res = await fetch("/api/upload", {
      method: "POST",
      body: formData,
    });

    console.log("Response received");

    const data = await res.json();
    console.log("Server response:", data);
  };

  return <input type="file" onChange={handleFileChange} />;
}

export default UploadImage;