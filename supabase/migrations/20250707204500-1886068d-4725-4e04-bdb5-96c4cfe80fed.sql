-- Create enum for email providers
CREATE TYPE email_provider AS ENUM ('gmail', 'outlook', 'yahoo');

-- Create user_email_accounts table
CREATE TABLE user_email_accounts (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  company_id UUID REFERENCES companies(id) ON DELETE CASCADE NOT NULL,
  provider email_provider NOT NULL,
  email TEXT NOT NULL,
  access_token TEXT,
  refresh_token TEXT,
  provider_user_id TEXT,
  expires_at TIMESTAMP WITH TIME ZONE,
  status TEXT DEFAULT 'active',
  connected_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id, provider, email)
);

-- Enable RLS
ALTER TABLE user_email_accounts ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
CREATE POLICY "Users can view their own email accounts" ON user_email_accounts
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own email accounts" ON user_email_accounts
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own email accounts" ON user_email_accounts
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own email accounts" ON user_email_accounts
  FOR DELETE USING (auth.uid() = user_id);

-- Create index for better performance
CREATE INDEX idx_user_email_accounts_user_id ON user_email_accounts(user_id);
CREATE INDEX idx_user_email_accounts_company_id ON user_email_accounts(company_id);

-- Create trigger for updated_at
CREATE TRIGGER update_user_email_accounts_updated_at
  BEFORE UPDATE ON user_email_accounts
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();