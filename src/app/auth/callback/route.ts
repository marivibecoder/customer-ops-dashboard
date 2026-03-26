import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const code = searchParams.get('code')
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://customer-ops-dashboard-production.up.railway.app'

  if (code) {
    const cookieStore = await cookies()
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() {
            return cookieStore.getAll()
          },
          setAll(cookiesToSet) {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            )
          },
        },
      }
    )

    const { error } = await supabase.auth.exchangeCodeForSession(code)
    if (!error) {
      // Check domain
      const { data: { user } } = await supabase.auth.getUser()
      if (user?.email?.endsWith('@getdarwin.ai')) {
        return NextResponse.redirect(`${appUrl}/`)
      } else {
        await supabase.auth.signOut()
        return NextResponse.redirect(`${appUrl}/login?error=domain`)
      }
    }
  }

  return NextResponse.redirect(`${appUrl}/login?error=auth`)
}
