-- Create events/open_mic_sessions table
CREATE TABLE IF NOT EXISTS events (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  host_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  venue_name TEXT NOT NULL,
  address TEXT NOT NULL,
  city TEXT NOT NULL,
  state TEXT NOT NULL,
  event_date DATE NOT NULL,
  event_time TIME NOT NULL,
  room_code TEXT NOT NULL UNIQUE,
  description TEXT,
  max_performers INTEGER DEFAULT 20,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create event_participants table
CREATE TABLE IF NOT EXISTS event_participants (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  event_id UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  scanned_at TIMESTAMPTZ DEFAULT NOW(),
  lineup_position INTEGER,
  has_performed BOOLEAN DEFAULT false,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(event_id, user_id)
);

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_events_host_id ON events(host_id);
CREATE INDEX IF NOT EXISTS idx_events_room_code ON events(room_code);
CREATE INDEX IF NOT EXISTS idx_events_event_date ON events(event_date);
CREATE INDEX IF NOT EXISTS idx_event_participants_event_id ON event_participants(event_id);
CREATE INDEX IF NOT EXISTS idx_event_participants_user_id ON event_participants(user_id);

-- Enable Row Level Security
ALTER TABLE events ENABLE ROW LEVEL SECURITY;
ALTER TABLE event_participants ENABLE ROW LEVEL SECURITY;

-- RLS Policies for events table
-- Hosts can CRUD their own events
CREATE POLICY "Hosts can create events" ON events
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = host_id);

CREATE POLICY "Hosts can view their own events" ON events
  FOR SELECT TO authenticated
  USING (auth.uid() = host_id);

CREATE POLICY "Anyone can view active events by room_code" ON events
  FOR SELECT TO authenticated
  USING (is_active = true);

CREATE POLICY "Hosts can update their own events" ON events
  FOR UPDATE TO authenticated
  USING (auth.uid() = host_id)
  WITH CHECK (auth.uid() = host_id);

CREATE POLICY "Hosts can delete their own events" ON events
  FOR DELETE TO authenticated
  USING (auth.uid() = host_id);

-- RLS Policies for event_participants table
-- Users can join events (insert themselves)
CREATE POLICY "Users can join events" ON event_participants
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- Users can view participants of events they're part of
CREATE POLICY "Users can view event participants" ON event_participants
  FOR SELECT TO authenticated
  USING (
    auth.uid() = user_id
    OR
    EXISTS (
      SELECT 1 FROM events WHERE events.id = event_participants.event_id AND events.host_id = auth.uid()
    )
  );

-- Hosts can update participants in their events
CREATE POLICY "Hosts can update participants" ON event_participants
  FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM events WHERE events.id = event_participants.event_id AND events.host_id = auth.uid()
    )
  );

-- Users can remove themselves from events
CREATE POLICY "Users can leave events" ON event_participants
  FOR DELETE TO authenticated
  USING (auth.uid() = user_id);

-- Function to generate unique room code
CREATE OR REPLACE FUNCTION generate_room_code()
RETURNS TEXT AS $$
DECLARE
  chars TEXT := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  result TEXT := '';
  i INTEGER;
BEGIN
  FOR i IN 1..6 LOOP
    result := result || substr(chars, floor(random() * length(chars) + 1)::integer, 1);
  END LOOP;
  RETURN result;
END;
$$ LANGUAGE plpgsql;

-- Function to auto-assign lineup position
CREATE OR REPLACE FUNCTION assign_lineup_position()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.lineup_position IS NULL THEN
    SELECT COALESCE(MAX(lineup_position), 0) + 1
    INTO NEW.lineup_position
    FROM event_participants
    WHERE event_id = NEW.event_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to auto-assign lineup position
CREATE TRIGGER auto_assign_lineup_position
  BEFORE INSERT ON event_participants
  FOR EACH ROW
  EXECUTE FUNCTION assign_lineup_position();

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger for events updated_at
CREATE TRIGGER update_events_updated_at
  BEFORE UPDATE ON events
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();
