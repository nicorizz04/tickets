import { supabase } from './supabaseClient.js';

// Hardcoded admin credentials
const ADMIN_EMAIL = 'admin';
const ADMIN_PASSWORD = 'password';

export async function getSession() {
  const { data, error } = await supabase.auth.getSession();
  if (error) throw error;
  return data.session;
}

export async function getUser() {
  const { data, error } = await supabase.auth.getUser();
  if (error) throw error;
  return data.user;
}

export async function signUpUser({ email, password, fullName, role = 'user' }) {
  // Check if trying to create admin and verify limit (max 3)
  if (role === 'admin') {
    const { data: adminCount } = await supabase
      .from('profiles')
      .select('id', { count: 'exact', head: true })
      .eq('role', 'admin');
    
    if (adminCount && adminCount >= 3) {
      throw new Error('Limita de 3 admini a fost atinsă.');
    }
  }

  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: { full_name: fullName, role: role }
    }
  });
  if (error) throw error;
  // Trigger în SQL auto-creează profilul cu rolul corect, no need to insert here
  return data;
}

export async function signInAdmin({ email, password }) {
  // Sign in with email and password
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) throw error;

  // Check if the user has admin role
  const user = data.user;
  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .maybeSingle();
  
  if (profileError) throw profileError;
  if (!profile || profile.role !== 'admin') {
    await supabase.auth.signOut();
    throw new Error('Doar adminii pot accesa această secțiune.');
  }

  return data;
}

export async function signIn({ email, password }) {
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) throw error;
  return data;
}

export async function signOut() {
  const { error } = await supabase.auth.signOut();
  if (error) throw error;
}

export async function getMyProfile() {
  const user = await getUser();
  if (!user) return null;

  const { data, error } = await supabase
    .from('profiles')
    .select('id, full_name, role, created_at')
    .eq('id', user.id)
    .maybeSingle();
  if (error) throw error;
  return data;
}

