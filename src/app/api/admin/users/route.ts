import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

export async function GET() {
  if (!supabaseUrl || !serviceRoleKey) {
    return NextResponse.json({ error: 'Supabase no configurado' }, { status: 400 });
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey);
  const { data, error } = await supabase
    .from('staff_users')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data || []);
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { email, password, full_name, role } = body;

    if (!email || !full_name) {
      return NextResponse.json(
        { error: 'Email y nombre completo son requeridos' },
        { status: 400 }
      );
    }

    if (!supabaseUrl || !serviceRoleKey) {
      return NextResponse.json({ error: 'Supabase no configurado' }, { status: 400 });
    }

    const supabase = createClient(supabaseUrl, serviceRoleKey);
    let authUserId: string | null = null;

    // Crear cuenta de autenticación con contraseña
    if (password) {
      if (process.env.SUPABASE_SERVICE_ROLE_KEY) {
        const { data: authData, error: authErr } = await supabase.auth.admin.createUser({
          email: email.trim().toLowerCase(),
          password,
          email_confirm: true,
          user_metadata: {
            full_name: full_name.trim(),
            role: role || 'despachador',
          },
        });

        if (!authErr && authData?.user) {
          authUserId = authData.user.id;
        } else if (authErr) {
          console.warn('Advertencia en auth.admin.createUser:', authErr.message);
        }
      } else {
        const { data: signData, error: signErr } = await supabase.auth.signUp({
          email: email.trim().toLowerCase(),
          password,
          options: {
            data: {
              full_name: full_name.trim(),
              role: role || 'despachador',
            },
          },
        });

        if (!signErr && signData?.user) {
          authUserId = signData.user.id;
        } else if (signErr) {
          console.warn('Advertencia en auth.signUp:', signErr.message);
        }
      }
    }

    // Insertar o actualizar en tabla staff_users
    const { data, error } = await supabase
      .from('staff_users')
      .upsert(
        {
          email: email.trim().toLowerCase(),
          full_name: full_name.trim(),
          role: role || 'despachador',
          is_active: true,
          auth_user_id: authUserId,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'email' }
      )
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(data);
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Error interno' }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  try {
    const body = await request.json();
    const { id, role, is_active } = body;

    if (!id) {
      return NextResponse.json({ error: 'ID es requerido' }, { status: 400 });
    }

    const supabase = createClient(supabaseUrl, serviceRoleKey);
    const updates: any = { updated_at: new Date().toISOString() };
    if (role !== undefined) updates.role = role;
    if (is_active !== undefined) updates.is_active = is_active;

    const { data, error } = await supabase
      .from('staff_users')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(data);
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Error interno' }, { status: 500 });
  }
}
