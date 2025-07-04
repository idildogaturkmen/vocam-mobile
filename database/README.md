This is a file to explain how to setup the supabase database

# Create an account on Supabase
Pretty straightforward, just create an account on the platform and register as a free tier user

# Get secret values
Get your supabase URL and Anon key and insert them on the .env file

# Table creation
Create any table you might want and allow RLS (role level security) for it

After that done, create policies for that table such that the user can only access their own data (Need policies for Select, Insert and Update at least). My policy is that the user_id that is accessing the data has to be equal to the uid on the auth table.

