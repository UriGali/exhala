import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getSmokerWeeksClean, getMilestoneCopy } from '@/lib/milestones'
import { sendWebPushToUsers } from '@/lib/push-service'

const SUPABASE_URL =
  process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://yzkwoeauwusrklvpxupc.supabase.co'
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
const supabaseKey = SUPABASE_SERVICE_ROLE_KEY || SUPABASE_ANON_KEY

const supabaseAdmin = createClient(SUPABASE_URL, supabaseKey, {
  auth: { persistSession: false, autoRefreshToken: false },
})

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}))
    const { userId } = body

    if (!userId) {
      return NextResponse.json({ error: 'userId is required' }, { status: 400 })
    }

    // 1. Fetch user profile
    const { data: profile, error: profileError } = await supabaseAdmin
      .from('profiles')
      .select('id, full_name, role, smoke_free_since')
      .eq('id', userId)
      .maybeSingle()

    if (profileError || !profile) {
      return NextResponse.json({ error: 'User profile not found' }, { status: 404 })
    }

    if (profile.role !== 'smoker' || !profile.smoke_free_since) {
      return NextResponse.json({
        success: true,
        message: 'User is not an active smoker with smoke_free_since date',
        newlyDispatched: [],
      })
    }

    const { weeks: currentWeeks } = getSmokerWeeksClean(profile.smoke_free_since)
    if (currentWeeks < 1) {
      return NextResponse.json({
        success: true,
        newlyDispatched: [],
        totalWeeks: 0,
      })
    }

    const smokerId = profile.id
    const smokerName = profile.full_name || 'Compañero'
    const streakStart = profile.smoke_free_since

    // 2. Fetch existing dispatched milestones in DB
    const { data: existing } = await supabaseAdmin
      .from('milestone_notifications')
      .select('weeks')
      .eq('smoker_id', smokerId)

    const dbNotifiedWeeks = new Set<number>()
    if (existing) {
      existing.forEach((row: any) => {
        if (typeof row.weeks === 'number') dbNotifiedWeeks.add(row.weeks)
      })
    }

    const weeksToDispatch: number[] = []
    for (let w = 1; w <= currentWeeks; w++) {
      if (!dbNotifiedWeeks.has(w)) {
        weeksToDispatch.push(w)
      }
    }

    if (weeksToDispatch.length === 0) {
      return NextResponse.json({
        success: true,
        newlyDispatched: [],
        totalWeeks: currentWeeks,
      })
    }

    // 3. Fetch accepted friends
    const { data: friendships } = await supabaseAdmin
      .from('friendships')
      .select('friend_id, smoker_id')
      .or(`smoker_id.eq.${smokerId},friend_id.eq.${smokerId}`)
      .eq('status', 'accepted')

    const friendIds = Array.from(
      new Set(
        (friendships || [])
          .map((f: any) => (f.smoker_id === smokerId ? f.friend_id : f.smoker_id))
          .filter((id: any) => id && id !== smokerId)
      )
    )

    const newlyDispatched: number[] = []

    for (const week of weeksToDispatch) {
      const copy = getMilestoneCopy(smokerName, week)

      if (friendIds.length > 0) {
        // Insert into DB
        const rows = friendIds.map((fId) => ({
          smoker_id: smokerId,
          friend_id: fId,
          weeks: week,
          streak_start: streakStart,
          title: copy.title,
          message: copy.message,
        }))

        try {
          await supabaseAdmin.from('milestone_notifications').insert(rows)
        } catch (dbErr) {
          console.warn('Error inserting milestone row in DB:', dbErr)
        }

        // Send Web Push notification
        try {
          await sendWebPushToUsers({
            userIds: friendIds,
            title: copy.pushTitle,
            body: copy.message,
            url: '/dashboard/friends',
          })
        } catch (pushErr) {
          console.warn('Error sending web push:', pushErr)
        }
      }

      newlyDispatched.push(week)
    }

    return NextResponse.json({
      success: true,
      newlyDispatched,
      totalWeeks: currentWeeks,
      friendsNotified: friendIds.length,
    })
  } catch (error: any) {
    console.error('[API Milestones Check] Internal Server Error:', error)
    return NextResponse.json(
      { error: error.message || 'Internal Server Error' },
      { status: 500 }
    )
  }
}
