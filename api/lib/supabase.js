const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.SUPABASE_URL || 'https://tbdcwlwxqsfogrgyxjwx.supabase.co';
const supabaseKey = process.env.SUPABASE_ANON_KEY || 'sb_publishable_il30olEoujJPa6BLrnV-bw_Jr6GruEs';

const supabase = createClient(supabaseUrl, supabaseKey);

module.exports = { supabase };
