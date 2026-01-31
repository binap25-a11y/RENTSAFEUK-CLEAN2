import { NextResponse } from 'next/server';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const postcode = searchParams.get('postcode');
  const apiKey = process.env.GETADDRESS_API_KEY;

  if (!apiKey) {
    // Provide a more user-friendly error in development
    if (process.env.NODE_ENV === 'development') {
        return NextResponse.json({ 
            error: 'getAddress.io API key is missing. Please add GETADDRESS_API_KEY to your .env.local file.' 
        }, { status: 500 });
    }
    return NextResponse.json({ error: 'Address service is not configured.' }, { status: 500 });
  }

  if (!postcode) {
    return NextResponse.json({ error: 'Postcode is required' }, { status: 400 });
  }

  try {
    // The `expand=true` parameter provides more detailed address information if available.
    const url = `https://api.getaddress.io/find/${postcode}?api-key=${apiKey}&expand=true`;
    const res = await fetch(url);

    if (!res.ok) {
        // Don't expose the full error in production for security
        if (process.env.NODE_ENV !== 'production') {
            try {
                const errorData = await res.json();
                console.error("getAddress.io API error:", errorData);
            } catch {
                console.error("getAddress.io API error: Could not parse error response.");
            }
        }
        // Return a generic error to the client
        return NextResponse.json({ error: `Address lookup failed. Status: ${res.status}` }, { status: res.status });
    }

    const data = await res.json();
    
    // The addresses are returned as a flat array of formatted strings.
    return NextResponse.json({ addresses: data.addresses });

  } catch (error) {
    console.error('Error fetching from getAddress.io:', error);
    return NextResponse.json({ error: 'Could not fetch addresses.' }, { status: 500 });
  }
}
