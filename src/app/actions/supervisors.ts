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
    const about = readFormValue(formData, 'about')

    const supervisor = await prisma.supervisor.create({
        data: { name, university, department, about },
    })

    redirect(`/supervisor/${supervisor.id}`)
}

export async function updateSupervisor(formData: FormData, supervisorId: string) {
    await requireCurrentUser('Log in to edit this supervisor.')


    const name = readFormValue(formData, 'name')
    const university = readFormValue(formData, 'university')
    const department = readFormValue(formData, 'department')
    const about = readFormValue(formData, 'about')

    // NOTE: Prisma schema for Supervisor does not include authorId.
    // Currently we allow editing/deleting to any authenticated user.
    // If you add supervisor.authorId later, tighten authorization.

    await prisma.supervisor.update({
        where: { id: supervisorId },
        data: { name, university, department, about },
    })

    redirect(`/supervisor/${supervisorId}`)
}

export async function deleteSupervisor(supervisorId: string) {
    await requireCurrentUser('Log in to delete this supervisor.')

    await prisma.supervisor.delete({ where: { id: supervisorId } })
    redirect('/supervisor')
}

