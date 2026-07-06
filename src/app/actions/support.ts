'use server'

import prisma from '@/lib/db'
import { createClient } from '@/utils/supabase/server'
import { readFormValue } from '@/lib/form'
import { redirect } from 'next/navigation'

export async function submitSupportRequest(formData: FormData) {
    const supabase = await createClient()
    const {
        data: { user },
    } = await supabase.auth.getUser()

    const email = user?.email || readFormValue(formData, 'email')
    const subject = readFormValue(formData, 'subject')
    const category = readFormValue(formData, 'category')
    const message = readFormValue(formData, 'message')

    if (!email || !subject || !category || !message) {
        redirect('/help?message=Please fill in all required fields.')
    }

    await prisma.supportRequest.create({
        data: {
            email,
            subject,
            category,
            message,
            userId: user?.id,
        },
    })

    redirect('/help?submitted=1')
}
