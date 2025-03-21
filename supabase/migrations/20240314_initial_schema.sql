-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Create events table to store all auction events
CREATE TABLE IF NOT EXISTS auction_events (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    event_id TEXT UNIQUE NOT NULL,
    event_type TEXT NOT NULL,
    contract_address TEXT NOT NULL,
    token_id TEXT NOT NULL,
    artwork_title TEXT,
    artwork_description TEXT,
    image_uri TEXT,
    starting_time TIMESTAMP WITH TIME ZONE,
    creator_username TEXT,
    creator_address TEXT,
    bidder_username TEXT,
    bidder_address TEXT,ß
    crypto_amount TEXT,
    crypto_symbol TEXT,
    raw_data JSONB NOT NULL,
    -- Processing status fields
    status TEXT,  -- NULL (unprocessed), 'PENDING', 'SENT', 'ERROR'
    discord_message_id TEXT,
    processed_at TIMESTAMP WITH TIME ZONE,
    error_message TEXT,
    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create index on event_type for faster filtering
CREATE INDEX IF NOT EXISTS idx_auction_events_event_type ON auction_events(event_type);

-- Create index on contract_address and token_id for faster lookups
CREATE INDEX IF NOT EXISTS idx_auction_events_contract_token ON auction_events(contract_address, token_id);

-- Create index on status for faster filtering of unprocessed events
CREATE INDEX IF NOT EXISTS idx_auction_events_status ON auction_events(status);

-- Create function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to update updated_at timestamp
CREATE TRIGGER update_auction_events_updated_at
BEFORE UPDATE ON auction_events
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column(); 