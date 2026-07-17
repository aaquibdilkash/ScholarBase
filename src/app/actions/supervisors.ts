'use server'

import prisma from '@/lib/db'
import { requireCurrentUser } from '@/lib/auth'
import { readFormValue } from '@/lib/form'
import { redirect } from 'next/navigation'

export async function createSupervisor(formData: FormData) {
    const user = await requireCurrentUser('Log in to add a supervisor entry.')

    const name = readFormValue(formData, 'name')
    const university = readFormValue(formData, 'university')
    const department = readFormValue(formData, 'department')
    const about = readFormValue(formData, 'about')

    const supervisor = await prisma.supervisor.create({
        data: {
            name,
            university,
            department,
            about,
            // authorId is required in schema; set it explicitly from the current user
            authorId: user.id,
        },
    })


    redirect(`/supervisor/${supervisor.id}`)
}

export async function updateSupervisor(formData: FormData, supervisorId: string) {
    const user = await requireCurrentUser('Log in to edit this supervisor.')

    const name = readFormValue(formData, 'name')
    const university = readFormValue(formData, 'university')
    const department = readFormValue(formData, 'department')
    const about = readFormValue(formData, 'about')

    const supervisor = await prisma.supervisor.findUnique({
        where: { id: supervisorId },
        select: { authorId: true },
    })

    if (!supervisor) return
    if (supervisor.authorId !== user.id) {
        throw new Error('Not authorized to edit this supervisor.')
    }

    await prisma.supervisor.update({
        where: { id: supervisorId },
        data: { name, university, department, about },
    })

    redirect(`/supervisor/${supervisorId}`)
}

export async function deleteSupervisor(supervisorId: string) {
    const user = await requireCurrentUser('Log in to delete this supervisor.')

    const supervisor = await prisma.supervisor.findUnique({
        where: { id: supervisorId },
        select: { authorId: true },
    })

    if (!supervisor) return
    if (supervisor.authorId !== user.id) {
        throw new Error('Not authorized to delete this supervisor.')
    }

    await prisma.supervisor.delete({ where: { id: supervisorId } })
    redirect('/supervisor')
}


