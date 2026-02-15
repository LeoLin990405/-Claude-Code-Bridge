-- Migration 004: OAuth Accounts and Password Reset Tokens
-- Created: 2026-02-15
-- Description: Add oauth_accounts and password_reset_tokens tables

-- OAuth Accounts Table
CREATE TABLE IF NOT EXISTS oauth_accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  provider VARCHAR(50) NOT NULL,
  provider_id VARCHAR(255) NOT NULL,
  email VARCHAR(255),
  display_name VARCHAR(200),
  avatar TEXT,
  access_token TEXT,
  refresh_token TEXT,
  expires_at TIMESTAMPTZ,
  raw TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- OAuth Accounts Indexes
CREATE INDEX IF NOT EXISTS oauth_accounts_user_id_idx ON oauth_accounts(user_id);
CREATE INDEX IF NOT EXISTS oauth_accounts_provider_idx ON oauth_accounts(provider, provider_id);

-- Password Reset Tokens Table
CREATE TABLE IF NOT EXISTS password_reset_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token TEXT NOT NULL UNIQUE,
  expires_at TIMESTAMPTZ NOT NULL,
  used BOOLEAN NOT NULL DEFAULT FALSE,
  used_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Password Reset Tokens Indexes
CREATE INDEX IF NOT EXISTS password_reset_tokens_user_id_idx ON password_reset_tokens(user_id);
CREATE INDEX IF NOT EXISTS password_reset_tokens_token_idx ON password_reset_tokens(token);

-- Comments
COMMENT ON TABLE oauth_accounts IS 'Stores OAuth account information from third-party providers (Google, GitHub, etc.)';
COMMENT ON TABLE password_reset_tokens IS 'Stores password reset tokens with expiry and usage tracking';

COMMENT ON COLUMN oauth_accounts.provider IS 'OAuth provider name (e.g., google, github)';
COMMENT ON COLUMN oauth_accounts.provider_id IS 'User ID from the OAuth provider';
COMMENT ON COLUMN oauth_accounts.raw IS 'Raw OAuth profile data (JSON)';

COMMENT ON COLUMN password_reset_tokens.token IS 'Unique password reset token (64 character hex string)';
COMMENT ON COLUMN password_reset_tokens.expires_at IS 'Token expiration timestamp (1 hour from creation)';
COMMENT ON COLUMN password_reset_tokens.used IS 'Whether the token has been used';
