import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.0';

// Environment variables
// SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are automatically available
const discordWebhookUrl = Deno.env.get('DISCORD_WEBHOOK_URL') || '';
const discordBotToken = Deno.env.get('DISCORD_BOT_TOKEN') || '';
const discordChannelId = Deno.env.get('DISCORD_CHANNEL_ID') || '';

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

// Function to get pending events
async function getPendingEvents() {
  const { data, error } = await supabase
    .from('auction_events')
    .select('*')
    .eq('status', 'PENDING')
    .order('processed_at', { ascending: true })
    .limit(10);

  if (error) {
    console.error('Error fetching pending events:', error);
    throw error;
  }

  return data || [];
}

// Function to mark event as sent
async function markEventAsSent(eventId: string, discordMessageId: string) {
  const { error } = await supabase
    .from('auction_events')
    .update({
      status: 'SENT',
      discord_message_id: discordMessageId,
      processed_at: new Date().toISOString()
    })
    .eq('id', eventId);

  if (error) {
    console.error('Error marking event as sent:', error);
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

// Function to send message to Discord
async function sendDiscordMessage(message: any) {
  try {
    // If using a webhook
    if (discordWebhookUrl) {
      console.log('Using webhook URL to send message');
      const response = await fetch(discordWebhookUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(message),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error(`Discord webhook error details: ${errorText}`);
        throw new Error(`Discord webhook responded with status: ${response.status}, details: ${errorText}`);
      }

      const data = await response.json();
      return data.id; // Return the Discord message ID
    }
    
    // If using a bot token
    else if (discordBotToken && discordChannelId) {
      console.log(`Using bot token to send message to channel: ${discordChannelId}`);
      console.log(`Bot token starts with: ${discordBotToken.substring(0, 10)}...`);
      
      const response = await fetch(`https://discord.com/api/v10/channels/${discordChannelId}/messages`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bot ${discordBotToken}`,
        },
        body: JSON.stringify(message),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error(`Discord API error details: ${errorText}`);
        throw new Error(`Discord API responded with status: ${response.status}, details: ${errorText}`);
      }

      const data = await response.json();
      return data.id; // Return the Discord message ID
    }
    
    else {
      throw new Error('No Discord webhook URL or bot token/channel ID provided');
    }
  } catch (error) {
    console.error('Error sending message to Discord:', error);
    throw error;
  }
}

// Main handler function
serve(async (req) => {
  try {
    const events = await getPendingEvents();
    
    if (events.length === 0) {
      return new Response(JSON.stringify({ message: 'No pending events to send' }), {
        headers: { 'Content-Type': 'application/json' },
        status: 200,
      });
    }

    for (const event of events) {
      try {
        // Format the message right before sending
        const message = formatDiscordMessage(event);

        // Send to Discord
        const discordMessageId = await sendDiscordMessage(message);
        
        // Mark as sent
        await markEventAsSent(event.id, discordMessageId);
      } catch (error) {
        console.error(`Error sending event ${event.id} to Discord:`, error);
        await markEventAsError(event.id, error.message);
      }
    }

    return new Response(JSON.stringify({ 
      message: `Sent ${events.length} events to Discord`,
      sent: events.length
    }), {
      headers: { 'Content-Type': 'application/json' },
      status: 200,
    });
  } catch (error) {
    console.error('Error in send-discord function:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { 'Content-Type': 'application/json' },
      status: 500,
    });
  }
});

// Function to format message for Discord
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
    crypto_symbol
  } = event;

  // Convert Wei to ETH if the symbol is ETH
  let formattedAmount = crypto_amount;
  if (crypto_symbol === 'ETH' && crypto_amount) {
    formattedAmount = convertWeiToEth(crypto_amount);
  }

  // Create artwork URL
  const artworkUrl = `https://superrare.com/artwork/eth/${contract_address}/${token_id}`;
  
  // Fix profile URL construction
  const bidderProfileUrl = bidder_username ? `https://superrare.com/${bidder_username.replace(/\*+\)+$/, '')}` : '';
  
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

  // Extract trait values from raw data if available
  let roundValue = '';
  let votingPointsValue = '';
  let scoreValue = '';

  try {
    if (event.raw_data?.nft?.metadata?.rawMetadata?.attributes) {
      const attributes = event.raw_data.nft.metadata.rawMetadata.attributes;
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

  // Create base embed structure
  const embed = {
    title: artwork_title,
    url: artworkUrl,
    color: event_type === 'END_AUCTION' ? 0x2ecc71 : 0x3498db, // Green for completed, Blue for others
    thumbnail: image_uri ? { url: image_uri } : undefined,
    image: image_uri ? { url: image_uri } : undefined,
    fields: [] as any[],
    footer: {
      text: "SuperRare Auction Bot"
    },
    timestamp: new Date().toISOString()
  };

  // Add fields based on event type
  switch (event_type) {
    case 'START_AUCTION':
      embed.description = `**Auction scheduled at ${formattedStartingTime} UTC on SuperRare**`;
      
      if (artwork_description) {
        embed.fields.push({
          name: "Description",
          value: artwork_description.length > 1024 
            ? artwork_description.substring(0, 1021) + "..." 
            : artwork_description
        });
      }
      
      // Add artwork details if available
      const detailsFields: string[] = [];
      if (roundValue) detailsFields.push(`*Round*: ${roundValue}`);
      if (votingPointsValue) detailsFields.push(`*VP*: ${votingPointsValue}`);
      if (scoreValue) detailsFields.push(`*Score*: ${scoreValue}`);
      
      if (detailsFields.length > 0) {
        embed.fields.push({
          name: "Artwork Details",
          value: detailsFields.join('\n'),
          inline: true
        });
      }
      
      embed.fields.push({
        name: "Links",
        value: `[View on SuperRare](${artworkUrl})`,
        inline: true
      });
      break;
      
    case 'MAKE_AUCTION_BID':
      embed.description = `**New bid received!**`;
      
      embed.fields.push({
        name: "Bidder",
        value: bidder_username 
          ? `[${bidder_username}](${bidderProfileUrl})`
          : "Unknown bidder",
        inline: true
      });
      
      embed.fields.push({
        name: "Bid Amount",
        value: `${formattedAmount} ${crypto_symbol}`,
        inline: true
      });
      
      embed.fields.push({
        name: "Bidder Address",
        value: `\`${bidder_address}\``,
        inline: false
      });
      
      embed.fields.push({
        name: "Links",
        value: `[Place your bid on SuperRare](${artworkUrl})`,
        inline: false
      });
      break;
      
    case 'END_AUCTION':
      embed.description = `**Auction completed!**`;
      
      embed.fields.push({
        name: "Collected by",
        value: bidder_username 
          ? `[${bidder_username}](${bidderProfileUrl})`
          : "Unknown collector",
        inline: true
      });
      
      embed.fields.push({
        name: "Final Price",
        value: `${formattedAmount} ${crypto_symbol}`,
        inline: true
      });
      
      embed.fields.push({
        name: "Collector Address",
        value: `\`${bidder_address}\``,
        inline: false
      });
      
      embed.fields.push({
        name: "Links",
        value: `[View on SuperRare](${artworkUrl})`,
        inline: false
      });
      break;
      
    default:
      embed.description = `New event for artwork`;
      embed.fields.push({
        name: "Links",
        value: `[View on SuperRare](${artworkUrl})`,
        inline: false
      });
  }

  // Return the message with embed and @verified mention
  return { 
    content: "<@&963045118015848519>", // Add the verified role mention
    embeds: [embed]
  };
} 