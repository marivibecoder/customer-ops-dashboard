'use client'

import { createClient } from '@/lib/supabase-browser'
import { useRouter } from 'next/navigation'

export function LogoutButton() {
  const router = useRouter()

  const handleLogout = async () => {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/login')
  }

  return (
    <button
      onClick={handleLogout}
      className="text-sm text-indigo-600 hover:text-indigo-800 font-medium px-3 py-1.5 rounded-md hover:bg-indigo-50 transition-colors cursor-pointer"
    >
      Cerrar sesion
    </button>
  )
}
