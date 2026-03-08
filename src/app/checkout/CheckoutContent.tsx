"use client";

import { useSearchParams } from "next/navigation";

export default function CheckoutContent() {
  const searchParams = useSearchParams();
  const orderId = searchParams.get("id");

  return (
    <div>
      <h1>Checkout</h1>
      <p>Order ID: {orderId}</p>
    </div>
  );
}