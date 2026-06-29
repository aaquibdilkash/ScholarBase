'use server'

import { createClient } from '@/utils/supabase/server'
import prisma from '@/lib/db'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'

// Helper to enforce authentication on forms
async function getAuthUser() {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
        const message = encodeURIComponent("Please log in to submit details.")
        redirect(`/login?message=${message}`)
    }
    return user
}

export async function createResearchEvent(formData: FormData) {
    const user = await getAuthUser()

    const title = formData.get('title') as string
    const date = new Date(formData.get('date') as string)
    const location = formData.get('location') as string
    const description = formData.get('description') as string
    const deadlineInput = formData.get('deadline') as string
    const deadline = deadlineInput ? new Date(deadlineInput) : null
    const notificationLink = formData.get('notificationLink') as string || null
    const applyLink = formData.get('applyLink') as string || null

    await prisma.researchEvent.create({
        data: { title, date, location, description, deadline, notificationLink, applyLink, authorId: user.id }
    })

    revalidatePath('/events')
    redirect('/events')
}

export async function createPhdAdmission(formData: FormData) {
    const user = await getAuthUser()

    const university = formData.get('university') as string
    const department = formData.get('department') as string
    const deadline = new Date(formData.get('deadline') as string)
    const description = formData.get('description') as string
    const notificationLink = formData.get('notificationLink') as string || null
    const applyLink = formData.get('applyLink') as string || null

    await prisma.phdAdmission.create({
        data: { university, department, deadline, description, notificationLink, applyLink, authorId: user.id }
    })

    revalidatePath('/admissions')
    redirect('/admissions')
}

export async function createJobVacancy(formData: FormData) {
    const user = await getAuthUser()

    const title = formData.get('title') as string
    const institution = formData.get('institution') as string
    const type = formData.get('type') as string
    const deadline = new Date(formData.get('deadline') as string)
    const description = formData.get('description') as string
    const notificationLink = formData.get('notificationLink') as string || null
    const applyLink = formData.get('applyLink') as string || null

    await prisma.jobVacancy.create({
        data: { title, institution, type, deadline, description, notificationLink, applyLink, authorId: user.id }
    })

    revalidatePath('/vacancies')
    redirect('/vacancies')
}