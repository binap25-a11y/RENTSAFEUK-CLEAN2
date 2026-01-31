import { NextResponse } from 'next/server';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const postcode = searchParams.get('postcode')?.toUpperCase().replace(/\s/g, '') || '';
  const apiKey = process.env.GETADDRESS_API_KEY;

  if (!postcode) {
    return NextResponse.json({ error: 'Postcode is required' }, { status: 400 });
  }

  if (!apiKey || apiKey === "YOUR_API_KEY_HERE") {
    console.error('getAddress.io API key is not configured in .env file.');
    // Return a mock response in development if key is missing, so the UI doesn't break
    if (process.env.NODE_ENV === 'development') {
      const mockAddresses: { [key: string]: string[] } = {
        "SW1A0AA": ["House of Commons, London, SW1A 0AA", "House of Lords, London, SW1A 0AA"],
        "M11AA": ["1 Piccadilly Gardens, Manchester, M1 1AA", "10 Piccadilly Gardens, Manchester, M1 1AA"],
      };
      const addresses = mockAddresses[postcode as keyof typeof mockAddresses] || [];
      await new Promise(resolve => setTimeout(resolve, 500));
      return NextResponse.json({ addresses });
    }
    return NextResponse.json({ error: 'Address lookup is not configured.' }, { status: 500 });
  }

  try {
    const url = `https://api.getAddress.io/find/${postcode}?api-key=${apiKey}&sort=true`;
    const res = await fetch(url);

    if (!res.ok) {
        const errorData = await res.json();
        console.error("getAddress.io API error:", errorData);
        throw new Error(`API request failed with status ${res.status}`);
    }

    const data = await res.json();
    
    return NextResponse.json({ addresses: data.addresses });

  } catch (error) {
    console.error('Error fetching from getAddress.io:', error);
    return NextResponse.json({ error: 'Could not fetch addresses.' }, { status: 500 });
  }
}
