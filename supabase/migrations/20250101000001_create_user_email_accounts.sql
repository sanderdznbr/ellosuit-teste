
-- Create user_email_accounts table
CREATE TABLE user_email_accounts (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  provider TEXT NOT NULL,
  email TEXT NOT NULL,
  connected_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  status TEXT DEFAULT 'active',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create RLS policies
ALTER TABLE user_email_accounts ENABLE ROW LEVEL SECURITY;

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
