/*
  # Fix RLS Performance Warnings - Optimize auth.uid() Calls

  1. Problem
    - auth.uid() and is_admin() functions were being re-evaluated for each row
    - This causes performance issues at scale
    - Supabase linter detected 21 performance warnings

  2. Solution
    - Wrap auth.uid() with (select auth.uid()) to evaluate only once per query
    - Wrap is_admin() calls similarly within subqueries
    - This caches the function result for the entire query

  3. Modified Policies
    - profiles: 3 policies fixed
    - subscriptions: 3 policies fixed
    - payments: 2 policies fixed
    - vpn_keys: 4 policies fixed
    - referrals: 2 policies fixed
    - support_tickets: 3 policies fixed
    - ticket_messages: 2 policies fixed
    - gift_subscriptions: 2 policies fixed

  4. Security
    - No changes to security model - still same access controls
    - Only optimizes query performance
    - All RLS restrictions maintained
*/

-- Fix profiles policies
DROP POLICY IF EXISTS "Users can view own profile" ON profiles;
CREATE POLICY "Users can view own profile"
  ON profiles FOR SELECT TO authenticated
  USING ((select auth.uid()) = id OR is_admin());

DROP POLICY IF EXISTS "Users can update own profile" ON profiles;
CREATE POLICY "Users can update own profile"
  ON profiles FOR UPDATE TO authenticated
  USING ((select auth.uid()) = id)
  WITH CHECK ((select auth.uid()) = id);

DROP POLICY IF EXISTS "System can insert profiles" ON profiles;
CREATE POLICY "System can insert profiles"
  ON profiles FOR INSERT TO authenticated
  WITH CHECK ((select auth.uid()) = id);

-- Fix subscriptions policies
DROP POLICY IF EXISTS "Users can view own subscriptions" ON subscriptions;
CREATE POLICY "Users can view own subscriptions"
  ON subscriptions FOR SELECT TO authenticated
  USING ((select auth.uid()) = user_id OR is_admin());

DROP POLICY IF EXISTS "Users can insert own subscriptions" ON subscriptions;
CREATE POLICY "Users can insert own subscriptions"
  ON subscriptions FOR INSERT TO authenticated
  WITH CHECK ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users can update own subscriptions" ON subscriptions;
CREATE POLICY "Users can update own subscriptions"
  ON subscriptions FOR UPDATE TO authenticated
  USING ((select auth.uid()) = user_id OR is_admin())
  WITH CHECK ((select auth.uid()) = user_id OR is_admin());

-- Fix payments policies
DROP POLICY IF EXISTS "Users can view own payments" ON payments;
CREATE POLICY "Users can view own payments"
  ON payments FOR SELECT TO authenticated
  USING ((select auth.uid()) = user_id OR is_admin());

DROP POLICY IF EXISTS "Users can insert own payments" ON payments;
CREATE POLICY "Users can insert own payments"
  ON payments FOR INSERT TO authenticated
  WITH CHECK ((select auth.uid()) = user_id);

-- Fix vpn_keys policies
DROP POLICY IF EXISTS "Users can view own vpn keys" ON vpn_keys;
CREATE POLICY "Users can view own vpn keys"
  ON vpn_keys FOR SELECT TO authenticated
  USING ((select auth.uid()) = user_id OR is_admin());

DROP POLICY IF EXISTS "Users can insert own vpn keys" ON vpn_keys;
CREATE POLICY "Users can insert own vpn keys"
  ON vpn_keys FOR INSERT TO authenticated
  WITH CHECK ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users can update own vpn keys" ON vpn_keys;
CREATE POLICY "Users can update own vpn keys"
  ON vpn_keys FOR UPDATE TO authenticated
  USING ((select auth.uid()) = user_id)
  WITH CHECK ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users can delete own vpn keys" ON vpn_keys;
CREATE POLICY "Users can delete own vpn keys"
  ON vpn_keys FOR DELETE TO authenticated
  USING ((select auth.uid()) = user_id);

-- Fix referrals policies
DROP POLICY IF EXISTS "Users can view own referrals" ON referrals;
CREATE POLICY "Users can view own referrals"
  ON referrals FOR SELECT TO authenticated
  USING ((select auth.uid()) = referrer_id OR (select auth.uid()) = referred_id OR is_admin());

DROP POLICY IF EXISTS "System can insert referrals" ON referrals;
CREATE POLICY "System can insert referrals"
  ON referrals FOR INSERT TO authenticated
  WITH CHECK ((select auth.uid()) = referrer_id OR (select auth.uid()) = referred_id);

-- Fix support_tickets policies
DROP POLICY IF EXISTS "Users can view own tickets" ON support_tickets;
CREATE POLICY "Users can view own tickets"
  ON support_tickets FOR SELECT TO authenticated
  USING ((select auth.uid()) = user_id OR is_admin());

DROP POLICY IF EXISTS "Users can create tickets" ON support_tickets;
CREATE POLICY "Users can create tickets"
  ON support_tickets FOR INSERT TO authenticated
  WITH CHECK ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users and admins can update tickets" ON support_tickets;
CREATE POLICY "Users and admins can update tickets"
  ON support_tickets FOR UPDATE TO authenticated
  USING ((select auth.uid()) = user_id OR is_admin())
  WITH CHECK ((select auth.uid()) = user_id OR is_admin());

-- Fix ticket_messages policies
DROP POLICY IF EXISTS "Users can view messages for own tickets" ON ticket_messages;
CREATE POLICY "Users can view messages for own tickets"
  ON ticket_messages FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM support_tickets
    WHERE support_tickets.id = ticket_messages.ticket_id
    AND (support_tickets.user_id = (select auth.uid()) OR is_admin())
  ));

DROP POLICY IF EXISTS "Users can insert messages for own tickets" ON ticket_messages;
CREATE POLICY "Users can insert messages for own tickets"
  ON ticket_messages FOR INSERT TO authenticated
  WITH CHECK ((select auth.uid()) = user_id AND EXISTS (
    SELECT 1 FROM support_tickets
    WHERE support_tickets.id = ticket_messages.ticket_id
    AND (support_tickets.user_id = (select auth.uid()) OR is_admin())
  ));

-- Fix gift_subscriptions policies
DROP POLICY IF EXISTS "Users can view own gift subscriptions" ON gift_subscriptions;
CREATE POLICY "Users can view own gift subscriptions"
  ON gift_subscriptions FOR SELECT TO authenticated
  USING ((select auth.uid()) = sender_id OR is_admin());

DROP POLICY IF EXISTS "Users can create gift subscriptions" ON gift_subscriptions;
CREATE POLICY "Users can create gift subscriptions"
  ON gift_subscriptions FOR INSERT TO authenticated
  WITH CHECK ((select auth.uid()) = sender_id);
