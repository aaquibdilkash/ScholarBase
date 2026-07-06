'use server'

import prisma from '@/lib/db'
import { requireCurrentUser } from '@/lib/auth'
import { readFormValue } from '@/lib/form'
import { redirect } from 'next/navigation'

export async function createSupervisor(formData: FormData) {
    await requireCurrentUser('Log in to add a supervisor entry.')

    const name = readFormValue(formData, 'name')
    const university = readFormValue(formData, 'university')
    const department = readFormValue(formData, 'department')

    const supervisor = await prisma.supervisor.create({
        data: { name, university, department },
    })

    redirect(`/supervisor/${supervisor.id}`)
}