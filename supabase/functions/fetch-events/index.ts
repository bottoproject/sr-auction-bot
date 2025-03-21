import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.0';

// Environment variables - use built-in Supabase Edge Function environment variables
// SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are automatically available
const superrareApiUrl = Deno.env.get('SUPERRARE_API_URL') || 'https://api.superrare.com/graphql';
const bottoAddresses = [Deno.env.get('BOTTO_CONTRACT_ADDRESS') || '0x66cd3ede22a25eef3cc8799381b99b1d4f0983f8'];

// Create Supabase client with the built-in service role key for admin access
const supabase = createClient(
  Deno.env.get('SUPABASE_URL') || '',
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || ''
);

// GraphQL query for SuperRare API
const SUPERRARE_QUERY = `
query bottoEvents($bottoAddresses: [String!]!) {
  getNftEvents(pagination: {take: 10, sortBy: createdAt, order: desc}, filter: {contractAddress: {in: $bottoAddresses}, eventType: {in: [START_AUCTION, MAKE_AUCTION_BID, END_AUCTION, SETTLE_AUCTION]}}) {
    events {
      nft {
        contractAddress
        tokenId
        metadata {
          name
          mediaDetails {
            original {
              image {
                uri
              }
            }
          }
        }
      }
      ... on StartAuction {
        nft {
          metadata {
            collectionName
            rawMetadata
            description
          }
        }
        startingTime
        creator {
          profile {
            username
          }
        }
      }
      ... on MakeAuctionBid {
        price {
          cryptoAmount
          currency {
            symbol
            address
          }
        }
        bidder: buyer {
          defaultAddress
          profile {
            username
          }
        }
      }
      ... on EndAuction {
        price {
          cryptoAmount
          currency {
            symbol
            address
          }
        }
        buyer {
          defaultAddress
          profile {
            username
          }
        }
      }
      ... on SettleAuction {
        settledBuyer: buyer {
          addresses {
            address
          }
        }
      }
    }
  }
}
`;

// Function to fetch events from SuperRare API
async function fetchSuperrareEvents() {
  try {
    const response = await fetch(superrareApiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        query: SUPERRARE_QUERY,
        variables: {
          bottoAddresses,
        },
      }),
    });

    if (!response.ok) {
      throw new Error(`SuperRare API responded with status: ${response.status}`);
    }

    const data = await response.json();
    return data.data.getNftEvents.events;
  } catch (error) {
    console.error('Error fetching events from SuperRare:', error);
    throw error;
  }
}

// Function to process and store events
async function processAndStoreEvents(events: any[]) {
  const results = {
    inserted: 0,
    skipped: 0,
    errors: 0,
  };

  for (const event of events) {
    try {
      // Determine event type
      let eventType = 'UNKNOWN';
      if ('startingTime' in event) {
        eventType = 'START_AUCTION';
      } else if ('bidder' in event) {
        eventType = 'MAKE_AUCTION_BID';
      } else if ('buyer' in event && !('settledBuyer' in event)) {
        eventType = 'END_AUCTION';
      } else if ('settledBuyer' in event) {
        eventType = 'SETTLE_AUCTION';
      }

      // Extract common fields for the duplicate check
      const contractAddress = event.nft.contractAddress;
      const tokenId = event.nft.tokenId;
      
      // Generate a deterministic event ID without using Date.now()
      // For bid events, include bidder and amount to differentiate between multiple bids
      let eventIdBase = `${eventType}_${contractAddress}_${tokenId}`;
      
      if (eventType === 'MAKE_AUCTION_BID') {
        const bidder = event.bidder?.defaultAddress || '';
        const amount = event.price?.cryptoAmount || '';
        eventIdBase += `_${bidder}_${amount}`;
      } else if (eventType === 'END_AUCTION') {
        const buyer = event.buyer?.defaultAddress || '';
        eventIdBase += `_${buyer}`;
      }
      
      // Generate a hash of the raw data to catch any other differences
      // This ensures we don't miss any subtle changes in the event
      const jsonString = JSON.stringify(event);
      const hashCode = await generateHash(jsonString);
      
      // Final event ID is a combination of base ID and hash (first 8 chars)
      const eventId = `${eventIdBase}_${hashCode.substring(0, 8)}`;

      // Check if this event already exists in the database
      const { data: existingEvents, error: checkError } = await supabase
        .from('auction_events')
        .select('id')
        .eq('event_id', eventId)
        .limit(1);

      if (checkError) {
        console.error('Error checking for existing event:', checkError);
        results.errors++;
        continue;
      }

      // Skip if the event already exists
      if (existingEvents && existingEvents.length > 0) {
        console.log(`Skipping duplicate event: ${eventId}`);
        results.skipped++;
        continue;
      }

      // Extract event-specific fields
      let artworkDescription = '';
      let startingTime = null;
      let creatorUsername = '';
      let creatorAddress = '';
      let bidderUsername = '';
      let bidderAddress = '';
      let cryptoAmount = '';
      let cryptoSymbol = '';
      const artworkTitle = event.nft.metadata?.name || '';
      const imageUri = event.nft.metadata?.mediaDetails?.original?.image?.uri || '';

      if (eventType === 'START_AUCTION') {
        artworkDescription = event.nft.metadata?.description || '';
        startingTime = event.startingTime;
        creatorUsername = event.creator?.profile?.username || '';
      } else if (eventType === 'MAKE_AUCTION_BID') {
        bidderUsername = event.bidder?.profile?.username || '';
        bidderAddress = event.bidder?.defaultAddress || '';
        cryptoAmount = event.price?.cryptoAmount || '';
        cryptoSymbol = event.price?.currency?.symbol || '';
      } else if (eventType === 'END_AUCTION') {
        bidderUsername = event.buyer?.profile?.username || '';
        bidderAddress = event.buyer?.defaultAddress || '';
        cryptoAmount = event.price?.cryptoAmount || '';
        cryptoSymbol = event.price?.currency?.symbol || '';
      } else if (eventType === 'SETTLE_AUCTION') {
        bidderUsername = event.buyer?.profile?.username || '';
        bidderAddress = event.settledBuyer?.addresses?.[0]?.address || '';
      }

      // Insert event into database
      const { data, error } = await supabase
        .from('auction_events')
        .insert({
          event_id: eventId,
          event_type: eventType,
          contract_address: contractAddress,
          token_id: tokenId,
          artwork_title: artworkTitle,
          artwork_description: artworkDescription,
          image_uri: imageUri,
          starting_time: startingTime,
          creator_username: creatorUsername,
          creator_address: creatorAddress,
          bidder_username: bidderUsername,
          bidder_address: bidderAddress,
          crypto_amount: cryptoAmount,
          crypto_symbol: cryptoSymbol,
          raw_data: event,
        });

      if (error) {
        console.error('Error storing event:', error);
        results.errors++;
      } else {
        results.inserted++;
      }
    } catch (error) {
      console.error('Error processing event:', error);
      results.errors++;
    }
  }

  return results;
}

// Generate a simple hash for deduplication purposes
async function generateHash(text: string): Promise<string> {
  try {
    // Use crypto API to create a SHA-256 hash
    const msgUint8 = new TextEncoder().encode(text);
    const hashBuffer = await crypto.subtle.digest('SHA-256', msgUint8);
    
    // Convert the hash to a hex string
    return Array.from(new Uint8Array(hashBuffer))
      .map(b => b.toString(16).padStart(2, '0'))
      .join('');
  } catch (error) {
    console.error('Error generating hash:', error);
    
    // Fallback to a simple string hash if crypto API fails
    let hash = 0;
    for (let i = 0; i < text.length; i++) {
      const char = text.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32bit integer
    }
    return Math.abs(hash).toString(16);
  }
}

// Main handler function
serve(async (req) => {
  try {
    // Only allow scheduled invocations or POST requests with proper authorization
    // Use SUPABASE_SERVICE_ROLE_KEY for auth verification since it's automatically available
    const authHeader = req.headers.get('Authorization');
    const expectedAuth = `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`;
    const isAuthorized = authHeader === expectedAuth;
    
    if (req.method !== 'POST' || !isAuthorized) {
      return new Response(JSON.stringify({ 
        error: 'Unauthorized or method not allowed',
        method: req.method,
        authStatus: authHeader ? 'provided but invalid' : 'missing'
      }), {
        status: authHeader ? 405 : 401,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Fetch events from SuperRare API
    const events = await fetchSuperrareEvents();
    
    // Process and store events
    const results = await processAndStoreEvents(events);

    return new Response(JSON.stringify({
      success: true,
      message: `Processed ${events.length} events. Inserted: ${results.inserted}, Skipped: ${results.skipped}, Errors: ${results.errors}`,
      results,
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Error in fetch-events function:', error);
    return new Response(JSON.stringify({
      success: false,
      error: error.message,
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}); 