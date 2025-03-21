import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.0';

// Create Supabase client with the built-in service role key for admin access
const supabase = createClient(
  Deno.env.get('SUPABASE_URL') || '',
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || ''
);

// Function to convert Wei to ETH
function convertWeiToEth(weiAmount: string): string {
  if (!weiAmount || weiAmount === '') return '0';
  
  try {
    // Parse the Wei amount as a BigInt since it can be a very large number
    const wei = BigInt(weiAmount);
    
    // 1 ETH = 10^18 Wei
    const divisor = BigInt(10) ** BigInt(18);
    
    // Integer division for the whole part
    const ethWhole = wei / divisor;
    
    // Modulo for the decimal part
    const ethDecimal = wei % divisor;
    
    // Format the decimal part - convert to string and pad with leading zeros
    let decimalStr = ethDecimal.toString().padStart(18, '0');
    
    // Trim trailing zeros and limit to max 4 decimal places for readability
    decimalStr = decimalStr.replace(/0+$/g, '');
    if (decimalStr.length > 4) {
      decimalStr = decimalStr.substring(0, 4);
    }
    
    // If there's a decimal part, format with decimal point, otherwise return just the whole part
    if (decimalStr !== '') {
      return `${ethWhole}.${decimalStr}`;
    } else {
      return ethWhole.toString();
    }
  } catch (error) {
    console.error('Error converting Wei to ETH:', error);
    return weiAmount; // Return the original value if conversion fails
  }
}

// Function to get unprocessed events
async function getUnprocessedEvents() {
  // Get events that haven't been processed yet
  const { data, error } = await supabase
    .from('auction_events')
    .select(`
      id,
      event_id,
      event_type,
      contract_address,
      token_id,
      artwork_title,
      artwork_description,
      image_uri,
      starting_time,
      creator_username,
      creator_address,
      bidder_username,
      bidder_address,
      crypto_amount,
      crypto_symbol,
      raw_data
    `)
    .is('status', null)  // Only get events that haven't been processed
    .not('event_type', 'eq', 'SETTLE_AUCTION')  // Exclude SETTLE_AUCTION events
    .order('created_at', { ascending: true })
    .limit(10);

  if (error) {
    console.error('Error fetching events:', error);
    throw error;
  }

  return data || [];
}

// Function to mark events as pending
async function markEventsAsPending(eventIds: string[]) {
  const { error } = await supabase
    .from('auction_events')
    .update({
      status: 'PENDING',
      processed_at: new Date().toISOString()
    })
    .in('id', eventIds);

  if (error) {
    console.error('Error marking events as pending:', error);
    throw error;
  }
}

// Function to mark event as error
async function markEventAsError(eventId: string, errorMessage: string) {
  const { error } = await supabase
    .from('auction_events')
    .update({
      status: 'ERROR',
      error_message: errorMessage,
      processed_at: new Date().toISOString()
    })
    .eq('id', eventId);

  if (error) {
    console.error('Error marking event as error:', error);
    throw error;
  }
}

// Function to format message for Discord based on event type
function formatDiscordMessage(event: any) {
  const { 
    event_type, 
    artwork_title, 
    artwork_description, 
    contract_address, 
    token_id, 
    image_uri, 
    starting_time,
    creator_username,
    bidder_username,
    bidder_address,
    crypto_amount,
    crypto_symbol,
    raw_data
  } = event;

  // Convert Wei to ETH if the symbol is ETH
  let formattedAmount = crypto_amount;
  if (crypto_symbol === 'ETH' && crypto_amount) {
    formattedAmount = convertWeiToEth(crypto_amount);
  }

  // Extract trait values from raw metadata if available
  let roundValue = '';
  let votingPointsValue = '';
  let scoreValue = '';

  try {
    if (raw_data?.nft?.metadata?.rawMetadata?.attributes) {
      const attributes = raw_data.nft.metadata.rawMetadata.attributes;
      for (const attr of attributes) {
        if (attr.trait_type === 'Round') {
          roundValue = attr.value;
        } else if (attr.trait_type === 'Voting Points') {
          votingPointsValue = attr.value;
        } else if (attr.trait_type === 'Score') {
          scoreValue = attr.value;
        }
      }
    }
  } catch (error) {
    console.error('Error extracting trait values:', error);
  }

  // Format date if available
  let formattedStartingTime = '';
  if (starting_time) {
    try {
      formattedStartingTime = new Date(starting_time).toISOString().replace('T', ' ').substring(0, 19);
    } catch (error) {
      console.error('Error formatting starting time:', error);
      formattedStartingTime = starting_time;
    }
  }

  // Create artwork URL
  const artworkUrl = `https://superrare.com/artwork/eth/${contract_address}/${token_id}`;

  // Format message based on event type
  switch (event_type) {
    case 'START_AUCTION':
      return {
        content: `<@&963045118015848519>\n\n**${artwork_title}** has an auction scheduled at ${formattedStartingTime} UTC on SuperRare:

[View the artwork on SuperRare](${artworkUrl}).

**Description**
**${artwork_description || 'No description available'}**

**Artwork Details**
${roundValue ? `*Round*: ${roundValue}` : ''}
${votingPointsValue ? `*VP*: ${votingPointsValue}` : ''}
${scoreValue ? `*Score*: ${scoreValue}` : ''}

${image_uri ? image_uri : ''}`,
      };

    case 'MAKE_AUCTION_BID':
      return {
        content: `<@&963045118015848519>\n\n**${artwork_title}** has a new bid:

**[${bidder_username}](https://superrare.com/${bidder_username})** placed a bid of ${formattedAmount} ${crypto_symbol}.

**Bidder Address**
${bidder_address}

[Place your bid on SuperRare](${artworkUrl}).

**Description**
**${artwork_description || 'No description available'}**

${image_uri ? image_uri : ''}`,
      };

    case 'END_AUCTION':
      return {
        content: `<@&963045118015848519>\n\n**${artwork_title}** been collected by **[${bidder_username}](https://superrare.com/${bidder_username})** 

**Auction Close Price**
${formattedAmount} ${crypto_symbol}.

**Bidder Address**
${bidder_address}

Congratulations to **[${bidder_username}](https://superrare.com/${bidder_username})**!

**${artwork_title}**

${image_uri ? image_uri : ''}`,
      };

    default:
      return {
        content: `<@&963045118015848519>\n\nNew event for artwork **${artwork_title}**. [View on SuperRare](${artworkUrl})`,
      };
  }
}

// Main handler function
serve(async (req) => {
  try {
    const events = await getUnprocessedEvents();
    
    if (events.length === 0) {
      return new Response(JSON.stringify({ message: 'No new events to process' }), {
        headers: { 'Content-Type': 'application/json' },
        status: 200,
      });
    }

    const eventIds = events.map(event => event.id);
    await markEventsAsPending(eventIds);

    for (const event of events) {
      try {
        const message = formatDiscordMessage(event);
        // Store the formatted message for the send-discord function
        await supabase
          .from('auction_events')
          .update({ 
            raw_data: {
              ...event.raw_data,
              formatted_discord_message: message
            }
          })
          .eq('id', event.id);
      } catch (error) {
        console.error(`Error processing event ${event.id}:`, error);
        await markEventAsError(event.id, error.message);
      }
    }

    return new Response(JSON.stringify({ 
      message: `Processed ${events.length} events`,
      processed: events.length
    }), {
      headers: { 'Content-Type': 'application/json' },
      status: 200,
    });
  } catch (error) {
    console.error('Error in process-events function:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { 'Content-Type': 'application/json' },
      status: 500,
    });
  }
}); 