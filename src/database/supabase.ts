import { createClient, SupabaseClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config();

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
    throw new Error('Missing Supabase credentials. Please check SUPABASE_URL and SUPABASE_ANON_KEY in .env file');
}

// Create Supabase client
export const supabase: SupabaseClient = createClient(supabaseUrl, supabaseKey, {
    auth: {
        persistSession: false
    }
});

// Test connection function
export async function testConnection(): Promise<boolean> {
    try {
        const { error } = await supabase.from('positions').select('count', { count: 'exact', head: true });
        if (error) {
            console.error('Supabase connection test failed:', error.message);
            return false;
        }
        console.log('Supabase connection successful');
        return true;
    } catch (error) {
        console.error('Supabase connection error:', error);
        return false;
    }
}
