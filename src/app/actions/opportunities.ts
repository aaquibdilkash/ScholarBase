'use server'

import prisma from '@/lib/db'
import { requireCurrentUser } from '@/lib/auth'
import { readFormValue, readOptionalFormValue } from '@/lib/form'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'

export async function createResearchEvent(formData: FormData) {
    const user = await requireCurrentUser('Please log in to submit details.')

    const title = readFormValue(formData, 'title')
    const date = new Date(readFormValue(formData, 'date'))
    const location = readFormValue(formData, 'location')
    const description = readFormValue(formData, 'description')
    const deadlineInput = readOptionalFormValue(formData, 'deadline')
    const deadline = deadlineInput ? new Date(deadlineInput) : null
    const notificationLink = readFormValue(formData, 'notificationLink')
    const applyLink = readFormValue(formData, 'applyLink')

    if (!notificationLink || !applyLink) {
      throw new Error('Notification and Apply links are required.')
    }

    await prisma.researchEvent.create({
        data: { title, date, location, description, deadline, notificationLink, applyLink, authorId: user.id },
    })

    revalidatePath('/events')
    redirect('/events')
}

export async function createPhdAdmission(formData: FormData) {
    const user = await requireCurrentUser('Please log in to submit details.')

    const university = readFormValue(formData, 'university')
    const department = readFormValue(formData, 'department')
    const deadline = new Date(readFormValue(formData, 'deadline'))
    const description = readFormValue(formData, 'description')
    const notificationLink = readFormValue(formData, 'notificationLink')
    const applyLink = readFormValue(formData, 'applyLink')

    if (!notificationLink || !applyLink) {
        throw new Error('Notification and Apply links are required.')
    }

    await prisma.phdAdmission.create({
        data: { university, department, deadline, description, notificationLink, applyLink, authorId: user.id },
    })

    revalidatePath('/admissions')
    redirect('/admissions')
}

export async function createJobVacancy(formData: FormData) {
    const user = await requireCurrentUser('Please log in to submit details.')

    const title = readFormValue(formData, 'title')
    const institution = readFormValue(formData, 'institution')
    const deadline = new Date(readFormValue(formData, 'deadline'))
    const description = readFormValue(formData, 'description')
    const notificationLink = readFormValue(formData, 'notificationLink')
    const applyLink = readFormValue(formData, 'applyLink')

    if (!notificationLink || !applyLink) {
        throw new Error('Notification and Apply links are required.')
    }

    await prisma.jobVacancy.create({
        data: { title, institution, deadline, description, notificationLink, applyLink, authorId: user.id },
    })

    revalidatePath('/vacancies')
    redirect('/vacancies')
}