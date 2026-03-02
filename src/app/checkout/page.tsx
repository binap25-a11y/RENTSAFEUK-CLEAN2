// src/app/checkout/page.tsx
"use client";

import dynamic from "next/dynamic";

const CheckoutContent = dynamic(() => import("./CheckoutContent"), {
  ssr: false, // client-side only
});

export default CheckoutContent;