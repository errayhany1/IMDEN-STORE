import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://krwenyhmcudvjwwvflss.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_ZUJ5tIpMAVKIOlqxwBDWog_yMpNu-0v';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
