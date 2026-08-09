'use server'

import prisma from '@/lib/db'
import { requireCurrentUser, isAuthorizedOrAdmin } from '@/lib/auth'
import { readFormValue } from '@/lib/form'
import { revalidatePath } from 'next/cache';


export async function getSupervisors(q?: string, userId?: string) {
  return prisma.supervisor.findMany({
    where: q ? { name: { contains: q, mode: "insensitive" } } : {},
    include: {
      author: {
        include: {
          followers: userId
            ? {
              where: { followerId: userId },
              select: { followerId: true },
            }
            : false,
        },
      },
      recommendations: true,
      votes: {
        select: { id: true, createdAt: true, userId: true, voteType: true, supervisorId: true },
      },
      _count: {
        select: {
          comments: true,
          votes: true,
        },
      },
    },
  });
}

export async function getSupervisor(id: string, userId?: string) {
  return prisma.supervisor.findUnique({
    where: { id },
    include: {
      author: {
        include: {
          followers: userId
            ? {
              where: { followerId: userId },
              select: { followerId: true },
            }
            : false,
        },
      },
      recommendations: {
        include: {
          author: {
            include: {
              followers: userId
                ? {
                  where: { followerId: userId },
                  select: { followerId: true },
                }
                : false,
            },
          },
          votes: { select: { userId: true, voteType: true } },
          _count: { select: { comments: true, votes: true } },
        },
        orderBy: { createdAt: "desc" },
      },
      comments: {
        where: { parentId: null },
        orderBy: { createdAt: "desc" },
        include: {
          author: true,
          votes: { select: { userId: true, voteType: true } },
          _count: { select: { votes: true } },
          replies: {
            orderBy: { createdAt: "desc" },
            include: {
              author: true,
              votes: { select: { userId: true, voteType: true } },
              _count: { select: { votes: true } },
            },
          },
        },
      },
      votes: {
        select: { userId: true, voteType: true },
      },
      _count: { select: { votes: true } },
    },
  });
}

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

  return { success: true, redirect: `/supervisor/${supervisor.id}` }
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
  if (!await isAuthorizedOrAdmin(supervisor.authorId, user.id)) {
    throw new Error('Not authorized to edit this supervisor.')
  }

  await prisma.supervisor.update({
    where: { id: supervisorId },
    data: { name, university, department, about },
  })

  return { success: true, redirect: `/supervisor/${supervisorId}` }
}



export async function deleteSupervisor(supervisorId: string) {
  const user = await requireCurrentUser('Log in to delete this supervisor.')

  const supervisor = await prisma.supervisor.findUnique({
    where: { id: supervisorId },
    select: { authorId: true },
  })

  if (!supervisor) return
  if (!await isAuthorizedOrAdmin(supervisor.authorId, user.id)) {
    throw new Error('Not authorized to delete this supervisor.')
  }

  await prisma.supervisor.delete({ where: { id: supervisorId } })
  revalidatePath('/supervisor')
  return { redirect: '/supervisor' }
}

