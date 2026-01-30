import { NextResponse } from 'next/server';

const mockAddresses: { [key: string]: string[] } = {
  "SW1A 0AA": [
    "House of Commons, London, SW1A 0AA",
    "House of Lords, London, SW1A 0AA",
  ],
  "M1 1AA": [
      "1 Piccadilly Gardens, Manchester, M1 1AA",
      "10 Piccadilly Gardens, Manchester, M1 1AA",
      "25 Piccadilly Gardens, Manchester, M1 1AA",
  ],
  "BS1 1AA": [
      "1 Bristol Street, Bristol, BS1 1AA",
      "5 Bristol Street, Bristol, BS1 1AA",
  ],
  "W1A 1AA": [
    "BBC Broadcasting House, Portland Place, London, W1A 1AA"
  ]
};

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const postcode = searchParams.get('postcode')?.toUpperCase().replace(/\s/g, '') || '';

  if (!postcode) {
    return NextResponse.json({ error: 'Postcode is required' }, { status: 400 });
  }

  // In a real app, you would use a third-party service here.
  // This is a mock implementation that is now more flexible with spacing.
  const matchedKey = Object.keys(mockAddresses).find(key => key.replace(/\s/g, '') === postcode);
  const addresses = matchedKey ? mockAddresses[matchedKey as keyof typeof mockAddresses] : [];


  // Simulate network delay
  await new Promise(resolve => setTimeout(resolve, 500));

  return NextResponse.json({ addresses });
}
