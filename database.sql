-- =============================================
-- Ticketing database for Supabase (PostgreSQL)
-- =============================================

-- Drop existing objects (optional, for clean re-run)
-- DROP TABLE IF EXISTS tickets;
-- DROP TYPE IF EXISTS ticket_category;
-- DROP TYPE IF EXISTS ticket_priority;
-- DROP TYPE IF EXISTS ticket_status;

-- Enum types
CREATE TYPE ticket_category AS ENUM ('Hardware', 'Software');
CREATE TYPE ticket_priority AS ENUM ('Low', 'Medium', 'High');
CREATE TYPE ticket_status AS ENUM ('Pending', 'In Progress', 'Completed');

-- Tickets table
CREATE TABLE tickets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    client_name TEXT NOT NULL,
    category ticket_category NOT NULL,
    device_name TEXT,
    priority ticket_priority NOT NULL,
    description TEXT,
    status ticket_status NOT NULL DEFAULT 'Pending',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    created_by uuid REFERENCES auth.users(id),
    assigned_to uuid REFERENCES auth.users(id),
    image_url TEXT
);

-- Optional: index for common filters
CREATE INDEX idx_tickets_category ON tickets (category);
CREATE INDEX idx_tickets_status ON tickets (status);
CREATE INDEX idx_tickets_created_at ON tickets (created_at DESC);

-- Enable Row Level Security (Supabase best practice)
ALTER TABLE tickets ENABLE ROW LEVEL SECURITY;

-- Policy: allow read for authenticated users (adjust as needed)
CREATE POLICY "Allow read access" ON tickets FOR SELECT USING (true);

-- Policy: allow insert for authenticated users (adjust as needed)
CREATE POLICY "Allow insert access" ON tickets FOR INSERT WITH CHECK (true);

-- Policy: allow update for authenticated users (adjust as needed)
CREATE POLICY "Allow update access" ON tickets FOR UPDATE USING (true);

-- =============================================
-- Mock data
-- =============================================

-- Software tickets
INSERT INTO tickets (client_name, category, device_name, priority, description, status) VALUES
('Maria Popescu', 'Software', 'Laptop Dell XPS', 'High', 'Acces la aplicație cont blocat – nu pot să mă loghez de 2 zile.', 'Pending'),
('Andrei Ionescu', 'Software', 'PC Desktop', 'Medium', 'Instalare Office 365 și configurare cont email corporativ.', 'Completed'),
('Elena Dumitrescu', 'Software', 'Laptop HP', 'Low', 'Actualizare Windows și programe de securitate.', 'In Progress'),
('Mihai Stan', 'Software', 'MacBook Pro', 'High', 'VPN nu se conectează – eroare la autentificare.', 'Pending'),
('Ana Moldovan', 'Software', 'Laptop Lenovo', 'Medium', 'Instalare aplicație internă și setare permisiuni.', 'Completed');

-- Hardware tickets
INSERT INTO tickets (client_name, category, device_name, priority, description, status) VALUES
('Ion Vasilescu', 'Hardware', 'Monitor LG 24"', 'Medium', 'Monitor nu pornește – led albastru fix, fără imagine.', 'Completed'),
('Cristina Radu', 'Hardware', 'Tastatură Logitech', 'Low', 'Taste care nu răspund: Enter, Backspace și câteva din zona numerică.', 'Pending'),
('George Niculescu', 'Hardware', 'Laptop Dell', 'High', 'Ecran crăpat după transport – necesită înlocuire.', 'In Progress'),
('Diana Constantinescu', 'Hardware', 'Mouse wireless', 'Low', 'Mouse-ul se deconectează aleator; am schimbat bateriile.', 'Pending'),
('Paul Marin', 'Hardware', 'PC Desktop', 'Medium', 'Unități optice nu citesc CD/DVD – verificare și curățare.', 'Completed');
