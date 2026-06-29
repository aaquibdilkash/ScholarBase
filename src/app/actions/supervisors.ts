'use server'

import prisma from '@/lib/db'
import { redirect } from 'next/navigation'

export async function createSupervisor(formData: FormData) {
    const name = formData.get('name') as string
    const university = formData.get('university') as string
    const department = formData.get('department') as string

    const supervisor = await prisma.supervisor.create({
        data: { name, university, department }
    })

    redirect(`/supervisor/${supervisor.id}`)
}