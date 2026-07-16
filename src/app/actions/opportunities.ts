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

export async function updateJobVacancy(formData: FormData, vacancyId: string) {
    const user = await requireCurrentUser('Log in to edit this vacancy.')

    const title = readFormValue(formData, 'title')
    const institution = readFormValue(formData, 'institution')
    const deadline = new Date(readFormValue(formData, 'deadline'))
    const description = readFormValue(formData, 'description')
    const notificationLink = readFormValue(formData, 'notificationLink')
    const applyLink = readFormValue(formData, 'applyLink')

    if (!notificationLink || !applyLink) {
        throw new Error('Notification and Apply links are required.')
    }

    const vacancy = await prisma.jobVacancy.findUnique({
        where: { id: vacancyId },
        select: { authorId: true },
    })

    if (!vacancy) return
    if (vacancy.authorId !== user.id) {
        throw new Error('Not authorized to edit this vacancy.')
    }

    await prisma.jobVacancy.update({
        where: { id: vacancyId },
        data: { title, institution, deadline, description, notificationLink, applyLink },
    })

    revalidatePath('/vacancies')
    revalidatePath(`/vacancies/${vacancyId}`)
    redirect(`/vacancies/${vacancyId}`)
}

export async function deleteJobVacancy(vacancyId: string) {
    const user = await requireCurrentUser('Log in to delete this vacancy.')

    const vacancy = await prisma.jobVacancy.findUnique({
        where: { id: vacancyId },
        select: { authorId: true },
    })

    if (!vacancy) return
    if (vacancy.authorId !== user.id) {
        throw new Error('Not authorized to delete this vacancy.')
    }

    await prisma.jobVacancy.delete({ where: { id: vacancyId } })

    revalidatePath('/vacancies')
    revalidatePath(`/vacancies/${vacancyId}`)
    redirect('/vacancies')
}

export async function updatePhdAdmission(formData: FormData, admissionId: string) {
    const user = await requireCurrentUser('Log in to edit this admission.')

    const university = readFormValue(formData, 'university')
    const department = readFormValue(formData, 'department')
    const deadline = new Date(readFormValue(formData, 'deadline'))
    const description = readFormValue(formData, 'description')
    const notificationLink = readFormValue(formData, 'notificationLink')
    const applyLink = readFormValue(formData, 'applyLink')

    if (!notificationLink || !applyLink) {
        throw new Error('Notification and Apply links are required.')
    }

    const admission = await prisma.phdAdmission.findUnique({
        where: { id: admissionId },
        select: { authorId: true },
    })

    if (!admission) return
    if (admission.authorId !== user.id) {
        throw new Error('Not authorized to edit this admission.')
    }

    await prisma.phdAdmission.update({
        where: { id: admissionId },
        data: { university, department, deadline, description, notificationLink, applyLink },
    })

    revalidatePath('/admissions')
    revalidatePath(`/admissions/${admissionId}`)
    redirect(`/admissions/${admissionId}`);
}

export async function deletePhdAdmission(admissionId: string) {
    const user = await requireCurrentUser('Log in to delete this admission.')

    const admission = await prisma.phdAdmission.findUnique({
        where: { id: admissionId },
        select: { authorId: true },
    })

    if (!admission) return
    if (admission.authorId !== user.id) {
        throw new Error('Not authorized to delete this admission.')
    }

    await prisma.phdAdmission.delete({ where: { id: admissionId } })

    revalidatePath('/admissions')
    revalidatePath(`/admissions/${admissionId}`)
    redirect('/admissions')
}

export async function updateResearchEvent(formData: FormData, eventId: string) {
    const user = await requireCurrentUser('Log in to edit this event.')

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

    const event = await prisma.researchEvent.findUnique({
        where: { id: eventId },
        select: { authorId: true },
    })

    if (!event) return
    if (event.authorId !== user.id) {
        throw new Error('Not authorized to edit this event.')
    }

    await prisma.researchEvent.update({
        where: { id: eventId },
        data: { title, date, location, description, deadline, notificationLink, applyLink },
    })

    revalidatePath('/events')
    revalidatePath(`/events/${eventId}`)
    redirect(`/events/${eventId}`)
}

export async function deleteResearchEvent(eventId: string) {
    const user = await requireCurrentUser('Log in to delete this event.')

    const event = await prisma.researchEvent.findUnique({
        where: { id: eventId },
        select: { authorId: true },
    })

    if (!event) return
    if (event.authorId !== user.id) {
        throw new Error('Not authorized to delete this event.')
    }

    await prisma.researchEvent.delete({ where: { id: eventId } })

    revalidatePath('/events')
    revalidatePath(`/events/${eventId}`)
    redirect('/events')
}

