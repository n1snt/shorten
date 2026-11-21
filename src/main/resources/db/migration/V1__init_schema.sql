-- Create shorten
CREATE TABLE short_urls (
    short_code VARCHAR(300) PRIMARY KEY NOT NULL,
    original_url TEXT NOT NULL,
    expiry TIMESTAMPTZ NOT NULL DEFAULT now() + interval '1 day',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);