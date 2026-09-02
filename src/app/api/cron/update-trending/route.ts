import { NextResponse } from 'next/server'
import prisma from '@/lib/db'
import { verifyCronSecret } from '@/lib/cron'

const GRAVITY = 1.8

const TRENDING_MODELS = [
  { model: 'article', table: 'Article' },
  { model: 'socialPost', table: 'SocialPost' },
  { model: 'helpPost', table: 'HelpPost' },
  { model: 'contribution', table: 'Contribution' },
  { model: 'publication', table: 'Publication' },
  { model: 'researchTool', table: 'ResearchTool' },
  { model: 'researchGrant', table: 'ResearchGrant' },
  { model: 'course', table: 'Course' },
  { model: 'journal', table: 'Journal' },
  { model: 'result', table: 'Result' },
  { model: 'researchSurvey', table: 'ResearchSurvey' },
  { model: 'researchEvent', table: 'ResearchEvent' },
  { model: 'phdAdmission', table: 'PhdAdmission' },
  { model: 'jobVacancy', table: 'JobVacancy' },
  { model: 'recommendation', table: 'Recommendation' },
]

export async function GET() {
  if (!(await verifyCronSecret())) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
    const errors: string[] = []

    // 1. Standard Content (Votes + Comments)
    // Run sequentially to prevent one missing column from crashing the entire job
    for (const { table } of TRENDING_MODELS) {
      try {
        await prisma.$executeRawUnsafe(`
          UPDATE "${table}"
          SET "trendingScore" = (
            "totalVotes" + ("totalComments" * 1.5)
          ) / POW(EXTRACT(EPOCH FROM NOW() - "createdAt") / 3600.0 + 2.0, ${GRAVITY})
          WHERE "createdAt" >= $1
            AND "isDeleted" = false
        `, sevenDaysAgo)
      } catch (err) {
        console.error(`[Cron] Failed to update table: ${table}`, err)
        errors.push(table)
      }
    }

    // 2. Scholar Trending (Requires trendingScore column added to User schema)
    try {
      await prisma.$executeRawUnsafe(`
        UPDATE "User"
        SET "trendingScore" = "reputation" / POW(EXTRACT(EPOCH FROM NOW() - "updatedAt") / 3600.0 + 2.0, ${GRAVITY})
        WHERE "isDeleted" = false
      `)
    } catch (err) {
      console.error(`[Cron] Failed to update User trending`, err)
      errors.push('User')
    }

    // 3. Supervisor Trending
    // Fixed: Replaced "averageRating" with COALESCE + NULLIF to safely calculate the average on the fly
    try {
      await prisma.$executeRawUnsafe(`
        UPDATE "Supervisor"
        SET "trendingScore" = (
          "totalVotes" + 
          ("totalComments" * 2) + 
          (COALESCE("ratingSum"::float / NULLIF("recommendationCount", 0), 0) * "recommendationCount" * 5)
        ) / POW(EXTRACT(EPOCH FROM NOW() - "createdAt") / 3600.0 + 2.0, ${GRAVITY})
        WHERE "isDeleted" = false
      `)
    } catch (err) {
      console.error(`[Cron] Failed to update Supervisor trending`, err)
      errors.push('Supervisor')
    }

    // Return a partial success if some failed, full success if none failed
    if (errors.length > 0) {
      return NextResponse.json(
        { success: true, message: 'Completed with errors on some tables.', failedTables: errors },
        { status: 207 }
      )
    }

    return NextResponse.json({ success: true, message: 'All trending scores updated successfully.' })
  } catch (error) {
    console.error('CRITICAL Error updating trending scores:', error)
    return NextResponse.json({ success: false, error: 'Failed to update trending scores.' }, { status: 500 })
  }
}