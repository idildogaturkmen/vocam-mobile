-- Add app_language column to profiles table
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS app_language VARCHAR(5) DEFAULT 'en';

-- Add comment to explain the column
COMMENT ON COLUMN profiles.app_language IS 'User preferred language for app interface (ISO 639-1 language code)';