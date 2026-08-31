-- ==============================================================================
-- SCHEMA DEFINITION & RLS POLICIES FOR QUIT-SMOKING APPLICATION (EXHALA)
-- Roles: 'smoker' | 'friend'
-- ==============================================================================

-- 1. ENUMS
CREATE TYPE public.user_role AS ENUM ('smoker', 'friend');
CREATE TYPE public.plant_action_type AS ENUM ('water', 'cheer');

-- 2. TABLES

-- ------------------------------------------------------------------------------
-- 2.1. PROFILES
-- Extends auth.users with app-specific profile information
-- ------------------------------------------------------------------------------
CREATE TABLE public.profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    role public.user_role NOT NULL DEFAULT 'smoker',
    full_name TEXT,
    avatar_url TEXT,
    smoke_free_since TIMESTAMPTZ,
    cigs_per_day INTEGER NOT NULL DEFAULT 0 CHECK (cigs_per_day >= 0),
    pack_price NUMERIC(10, 2) NOT NULL DEFAULT 0.00 CHECK (pack_price >= 0),
    penalty_amount NUMERIC(10, 2) NOT NULL DEFAULT 1.00 CHECK (penalty_amount >= 0),
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- ------------------------------------------------------------------------------
-- 2.2. FRIENDSHIPS
-- Manages the link between a smoker and their support friend(s)
-- ------------------------------------------------------------------------------
CREATE TABLE public.friendships (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    smoker_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    friend_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    CONSTRAINT unique_friendship UNIQUE (smoker_id, friend_id),
    CONSTRAINT no_self_friendship CHECK (smoker_id <> friend_id)
);

-- ------------------------------------------------------------------------------
-- 2.3. RELAPSES
-- Tracks relapse events for accountability and statistics reset/penalties
-- ------------------------------------------------------------------------------
CREATE TABLE public.relapses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    smoker_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    date TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    penalty_amount NUMERIC(10, 2) NOT NULL DEFAULT 0.00 CHECK (penalty_amount >= 0),
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- ------------------------------------------------------------------------------
-- 2.4. BADGES
-- Achievements unlocked by smokers as they hit smoke-free milestones
-- ------------------------------------------------------------------------------
CREATE TABLE public.badges (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    smoker_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    badge_key TEXT NOT NULL,
    title TEXT NOT NULL,
    icon TEXT,
    unlocked_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    CONSTRAINT unique_smoker_badge UNIQUE (smoker_id, badge_key)
);

-- ------------------------------------------------------------------------------
-- 2.5. PLANT ACTIONS
-- Gamified interactions (e.g. friend watering or cheering smoker's plant)
-- ------------------------------------------------------------------------------
CREATE TABLE public.plant_actions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    smoker_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    friend_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    action_type public.plant_action_type NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- ------------------------------------------------------------------------------
-- 2.6. SOS NOTIFICATIONS
-- Urgent craving alerts sent from a smoker to their support friends
-- ------------------------------------------------------------------------------
CREATE TABLE public.sos_notifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    smoker_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    friend_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    message TEXT,
    read_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- ------------------------------------------------------------------------------
-- 2.7. MESSAGES
-- Direct messages between friends for mutual support and encouragement
-- ------------------------------------------------------------------------------
CREATE TABLE public.messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    sender_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    receiver_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    content TEXT NOT NULL,
    read_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- ------------------------------------------------------------------------------
-- 2.8. PUSH SUBSCRIPTIONS
-- Browser Web Push credentials for urgent SOS notifications and support alerts
-- ------------------------------------------------------------------------------
CREATE TABLE public.push_subscriptions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    endpoint TEXT NOT NULL,
    p256dh TEXT NOT NULL,
    auth TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    CONSTRAINT unique_user_endpoint UNIQUE (user_id, endpoint)
);

-- ==============================================================================
CREATE INDEX idx_profiles_role ON public.profiles(role);
CREATE INDEX idx_friendships_smoker_id ON public.friendships(smoker_id);
CREATE INDEX idx_friendships_friend_id ON public.friendships(friend_id);
CREATE INDEX idx_relapses_smoker_id_date ON public.relapses(smoker_id, date DESC);
CREATE INDEX idx_badges_smoker_id ON public.badges(smoker_id);
CREATE INDEX idx_plant_actions_smoker_id ON public.plant_actions(smoker_id, created_at DESC);
CREATE INDEX idx_plant_actions_friend_id ON public.plant_actions(friend_id);
CREATE INDEX idx_sos_notifications_friend_id ON public.sos_notifications(friend_id, created_at DESC);
CREATE INDEX idx_sos_notifications_smoker_id ON public.sos_notifications(smoker_id, created_at DESC);
CREATE INDEX idx_messages_sender_receiver ON public.messages(sender_id, receiver_id, created_at ASC);
CREATE INDEX idx_messages_receiver_sender ON public.messages(receiver_id, sender_id, created_at ASC);
CREATE INDEX idx_push_subscriptions_user_id ON public.push_subscriptions(user_id);



-- ==============================================================================
-- 4. TRIGGERS & FUNCTIONS
-- ==============================================================================

-- 4.1 Automatic updated_at refresher
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = timezone('utc'::text, now());
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER on_profiles_updated
    BEFORE UPDATE ON public.profiles
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_updated_at();

-- 4.2 Auto-create profile on auth.user signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.profiles (id, role, full_name, avatar_url)
    VALUES (
        NEW.id,
        COALESCE((NEW.raw_user_meta_data->>'role')::public.user_role, 'smoker'::public.user_role),
        NEW.raw_user_meta_data->>'full_name',
        NEW.raw_user_meta_data->>'avatar_url'
    );
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_new_user();

-- ==============================================================================
-- 5. ROW LEVEL SECURITY (RLS) POLICIES
-- ==============================================================================

-- Enable RLS on all tables
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.friendships ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.relapses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.badges ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.plant_actions ENABLE ROW LEVEL SECURITY;

-- ------------------------------------------------------------------------------
-- 5.1. PROFILES POLICIES
-- ------------------------------------------------------------------------------
-- Any authenticated user can read profiles (needed for searching/inviting friends and leaderboard/views)
CREATE POLICY "Authenticated users can view profiles"
    ON public.profiles
    FOR SELECT
    TO authenticated
    USING (true);

-- Users can only update their own profile
CREATE POLICY "Users can update their own profile"
    ON public.profiles
    FOR UPDATE
    TO authenticated
    USING (auth.uid() = id)
    WITH CHECK (auth.uid() = id);

-- ------------------------------------------------------------------------------
-- 5.2. FRIENDSHIPS POLICIES
-- ------------------------------------------------------------------------------
-- Both smoker and friend can view their friendships
CREATE POLICY "Users can view their friendships"
    ON public.friendships
    FOR SELECT
    TO authenticated
    USING (auth.uid() = smoker_id OR auth.uid() = friend_id);

-- Users can create friendships where they are either the smoker or the friend
CREATE POLICY "Users can create friendships"
    ON public.friendships
    FOR INSERT
    TO authenticated
    WITH CHECK (auth.uid() = smoker_id OR auth.uid() = friend_id);

-- Either party can delete/cancel a friendship
CREATE POLICY "Users can delete their friendships"
    ON public.friendships
    FOR DELETE
    TO authenticated
    USING (auth.uid() = smoker_id OR auth.uid() = friend_id);

-- ------------------------------------------------------------------------------
-- 5.3. RELAPSES POLICIES
-- ------------------------------------------------------------------------------
-- Smoker can view their relapses; connected friends can also view them to offer support
CREATE POLICY "Smokers and their friends can view relapses"
    ON public.relapses
    FOR SELECT
    TO authenticated
    USING (
        auth.uid() = smoker_id
        OR EXISTS (
            SELECT 1 FROM public.friendships
            WHERE public.friendships.smoker_id = public.relapses.smoker_id
              AND public.friendships.friend_id = auth.uid()
        )
    );

-- Only the smoker can insert/log a relapse
CREATE POLICY "Smokers can insert their own relapses"
    ON public.relapses
    FOR INSERT
    TO authenticated
    WITH CHECK (auth.uid() = smoker_id);

-- Only the smoker can update or delete their relapses
CREATE POLICY "Smokers can modify their own relapses"
    ON public.relapses
    FOR UPDATE
    TO authenticated
    USING (auth.uid() = smoker_id)
    WITH CHECK (auth.uid() = smoker_id);

CREATE POLICY "Smokers can delete their own relapses"
    ON public.relapses
    FOR DELETE
    TO authenticated
    USING (auth.uid() = smoker_id);

-- ------------------------------------------------------------------------------
-- 5.4. BADGES POLICIES
-- ------------------------------------------------------------------------------
-- Smokers and their friends can view badges
CREATE POLICY "Smokers and friends can view badges"
    ON public.badges
    FOR SELECT
    TO authenticated
    USING (
        auth.uid() = smoker_id
        OR EXISTS (
            SELECT 1 FROM public.friendships
            WHERE public.friendships.smoker_id = public.badges.smoker_id
              AND public.friendships.friend_id = auth.uid()
        )
    );

-- Smoker (or database triggers/services) can unlock badges for themselves
CREATE POLICY "Smokers can insert their badges"
    ON public.badges
    FOR INSERT
    TO authenticated
    WITH CHECK (auth.uid() = smoker_id);

-- ------------------------------------------------------------------------------
-- 5.5. PLANT ACTIONS POLICIES
-- ------------------------------------------------------------------------------
-- Both parties in the friendship can view plant actions
CREATE POLICY "Smokers and friends can view plant actions"
    ON public.plant_actions
    FOR SELECT
    TO authenticated
    USING (
        auth.uid() = smoker_id
        OR auth.uid() = friend_id
    );

-- Friends can insert plant actions only if an active friendship exists
CREATE POLICY "Friends can insert plant actions"
    ON public.plant_actions
    FOR INSERT
    TO authenticated
    WITH CHECK (
        auth.uid() = friend_id
        AND EXISTS (
            SELECT 1 FROM public.friendships
            WHERE public.friendships.smoker_id = public.plant_actions.smoker_id
              AND public.friendships.friend_id = auth.uid()
        )
    );

-- ==============================================================================
-- RLS: SOS NOTIFICATIONS
-- ==============================================================================
ALTER TABLE public.sos_notifications ENABLE ROW LEVEL SECURITY;

-- Smoker can insert SOS notifications for their own friends
CREATE POLICY "Smoker can insert SOS notifications"
    ON public.sos_notifications
    FOR INSERT
    TO authenticated
    WITH CHECK (
        auth.uid() = smoker_id
        AND EXISTS (
            SELECT 1 FROM public.friendships
            WHERE public.friendships.smoker_id = auth.uid()
              AND public.friendships.friend_id = public.sos_notifications.friend_id
        )
    );

-- Both the smoker and the friend can view SOS notifications
CREATE POLICY "Parties can view SOS notifications"
    ON public.sos_notifications
    FOR SELECT
    TO authenticated
    USING (
        auth.uid() = smoker_id
        OR auth.uid() = friend_id
    );

-- ==============================================================================
-- RLS: MESSAGES
-- ==============================================================================
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;

-- Users can send messages where they are the sender
CREATE POLICY "Users can send messages"
    ON public.messages
    FOR INSERT
    TO authenticated
    WITH CHECK (
        auth.uid() = sender_id
    );

-- Users can view their own conversations (sent or received)
CREATE POLICY "Users can view their own messages"
    ON public.messages
    FOR SELECT
    TO authenticated
    USING (
        auth.uid() = sender_id
        OR auth.uid() = receiver_id
    );

-- ==============================================================================
-- RLS: PUSH SUBSCRIPTIONS
-- ==============================================================================
ALTER TABLE public.push_subscriptions ENABLE ROW LEVEL SECURITY;

-- Users can insert their own browser push subscriptions
CREATE POLICY "Users can insert their own push subscriptions"
    ON public.push_subscriptions
    FOR INSERT
    TO authenticated
    WITH CHECK (
        auth.uid() = user_id
    );

-- Users can manage and view their own push subscriptions
CREATE POLICY "Users can manage their own push subscriptions"
    ON public.push_subscriptions
    FOR ALL
    TO authenticated
    USING (
        auth.uid() = user_id
    );


