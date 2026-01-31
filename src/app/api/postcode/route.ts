import { NextResponse } from 'next/server';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const postcode = searchParams.get('postcode')?.toUpperCase().replace(/\s/g, '') || '';

  if (!postcode) {
    return NextResponse.json({ error: 'Postcode is required' }, { status: 400 });
  }

  try {
    const url = `https://api.postcodes.io/postcodes/${postcode}`;
    const res = await fetch(url);

    if (!res.ok) {
        // postcodes.io returns 404 for invalid postcodes, which is a valid response for us
        if (res.status === 404) {
            return NextResponse.json({ addresses: [] });
        }
        const errorData = await res.json();
        console.error("api.postcodes.io API error:", errorData);
        throw new Error(`API request failed with status ${res.status}`);
    }

    const data = await res.json();
    
    // postcodes.io returns a single result object, not a list of addresses.
    // We will construct a single, generic address string for the dropdown.
    if (data.status === 200 && data.result) {
        const { admin_district, region, postcode: resultPostcode } = data.result;
        // Construct a general location string. This won't be a specific street address.
        const constructedAddress = [admin_district, region, resultPostcode].filter(Boolean).join(', ');
        return NextResponse.json({ addresses: [constructedAddress] });
    }

    return NextResponse.json({ addresses: [] });

  } catch (error) {
    console.error('Error fetching from api.postcodes.io:', error);
    return NextResponse.json({ error: 'Could not fetch addresses.' }, { status: 500 });
  }
}
