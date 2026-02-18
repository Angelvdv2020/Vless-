import { cookies } from 'next/headers';
import { supabase } from './supabase-client';

export async function getSession() {
  const cookieStore = await cookies();
  const cookiesList = cookieStore.getAll();

  if (!cookiesList.length) {
    return null;
  }

  try {
    const { data } = await supabase.auth.getSession();
    return data?.session || null;
  } catch {
    return null;
  }
}

export async function getCurrentUser() {
  const session = await getSession();
  if (!session) return null;

  try {
    const { data } = await supabase.auth.getUser(session.access_token);
    return data?.user || null;
  } catch {
    return null;
  }
}

export async function getProfile() {
  const user = await getCurrentUser();
  if (!user) return null;

  try {
    const { data: profile } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .maybeSingle();

    return profile;
  } catch {
    return null;
  }
}
