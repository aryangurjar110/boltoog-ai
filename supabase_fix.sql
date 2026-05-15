-- RUN THIS IN YOUR SUPABASE SQL EDITOR TO FIX THE ERROR
-- https://supabase.com/dashboard/project/tbdcwlwxqsfogrgyxjwx/sql/new

-- 1. Create Chats table
CREATE TABLE IF NOT EXISTS public.chats (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    title TEXT DEFAULT 'New Chat',
    created_at TIMESTAMPTZ DEFAULT now()
);

-- 2. Create Messages table
CREATE TABLE IF NOT EXISTS public.messages (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    chat_id UUID REFERENCES public.chats(id) ON DELETE CASCADE,
    role TEXT NOT NULL, -- 'user' or 'model'
    content TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- 3. Enable RLS
ALTER TABLE public.chats ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;

-- 4. Create Policies (so users can only see their own chats)
DROP POLICY IF EXISTS "Users can see their own chats" ON public.chats;
CREATE POLICY "Users can see their own chats" ON public.chats
    FOR ALL USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can see messages from their chats" ON public.messages;
CREATE POLICY "Users can see messages from their chats" ON public.messages
    FOR ALL USING (
        chat_id IN (SELECT id FROM public.chats WHERE user_id = auth.uid())
    );

-- 5. Success Message
SELECT 'Database Setup Successful!' as status;
