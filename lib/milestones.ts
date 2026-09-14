import { supabase } from '@/lib/supabase/client'
import { dispatchPushMilestoneToFriends } from '@/lib/push-notifications'

export const MAX_MILESTONE_WEEKS = 20

export interface MilestoneCopy {
  weeks: number
  days: number
  title: string
  pushTitle: string
  message: string
  detailedMessage: string
}

/**
 * Calculates days and weeks clean since the given smoke_free_since date.
 */
export function getSmokerWeeksClean(smokeFreeSince?: string | null): { days: number; weeks: number } {
  if (!smokeFreeSince) return { days: 0, weeks: 0 }
  const diffMs = Math.max(0, Date.now() - new Date(smokeFreeSince).getTime())
  const days = Math.floor(diffMs / (1000 * 60 * 60 * 24))
  const weeks = Math.min(MAX_MILESTONE_WEEKS, Math.floor(days / 7))
  return { days, weeks }
}

/**
 * Returns formatted messages for a milestone week (1 to 20).
 */
export function getMilestoneCopy(smokerName: string, weeks: number): MilestoneCopy {
  const safeName = smokerName?.trim() || 'Tu amigo'
  const weeksText = weeks === 1 ? '1 semana' : `${weeks} semanas`
  const days = weeks * 7

  return {
    weeks,
    days,
    title: `🎉 ¡${weeksText} sin fumar!`,
    pushTitle: `🎉 ¡${weeksText} sin fumar!`,
    message: `¡Enhorabuena! ${safeName} lleva ${weeksText} sin fumar.`,
    detailedMessage: `¡Enhorabuena! ${safeName} lleva ${weeksText} sin fumar (${days} días). ¡Envíale tu felicitación y apoyo!`,
  }
}

/**
 * Evaluates whether the smoker has reached weekly milestones (1 to 20 weeks)
 * that have not yet been notified to their friends, and dispatches them.
 */
export async function checkAndDispatchSmokerMilestones(profile: {
  id: string
  role?: string
  full_name?: string | null
  smoke_free_since?: string | null
}): Promise<{ newlyDispatched: number[]; totalWeeks: number }> {
  if (!profile || profile.role === 'friend' || !profile.smoke_free_since) {
    return { newlyDispatched: [], totalWeeks: 0 }
  }

  const { days, weeks: currentWeeks } = getSmokerWeeksClean(profile.smoke_free_since)
  if (currentWeeks < 1) {
    return { newlyDispatched: [], totalWeeks: 0 }
  }

  const smokerId = profile.id
  const smokerName = profile.full_name || 'Compañero'
  const streakStart = profile.smoke_free_since
  const streakKey = streakStart.slice(0, 10)

  // 1. Check local storage cache as fast safeguard
  const localCacheKey = `exhala_notified_milestones_${smokerId}_${streakKey}`
  let localNotifiedWeeks: number[] = []
  if (typeof window !== 'undefined') {
    try {
      const stored = localStorage.getItem(localCacheKey)
      if (stored) {
        localNotifiedWeeks = JSON.parse(stored)
      }
    } catch {}
  }

  // 2. Fetch already recorded milestones in Supabase
  let dbNotifiedWeeks = new Set<number>(localNotifiedWeeks)
  try {
    const { data: existing, error } = await supabase
      .from('milestone_notifications')
      .select('weeks')
      .eq('smoker_id', smokerId)

    if (!error && existing) {
      existing.forEach((row: any) => {
        if (typeof row.weeks === 'number') {
          dbNotifiedWeeks.add(row.weeks)
        }
      })
    }
  } catch (err) {
    console.warn('Could not query milestone_notifications table:', err)
  }

  // 3. Find weeks between 1 and currentWeeks that have not been dispatched
  const weeksToDispatch: number[] = []
  for (let w = 1; w <= currentWeeks; w++) {
    if (!dbNotifiedWeeks.has(w)) {
      weeksToDispatch.push(w)
    }
  }

  if (weeksToDispatch.length === 0) {
    return { newlyDispatched: [], totalWeeks: currentWeeks }
  }

  // 4. Fetch accepted friends
  let friendIds: string[] = []
  try {
    const { data: friendships } = await supabase
      .from('friendships')
      .select('friend_id, smoker_id')
      .or(`smoker_id.eq.${smokerId},friend_id.eq.${smokerId}`)
      .eq('status', 'accepted')

    if (friendships && friendships.length > 0) {
      friendIds = Array.from(
        new Set(
          friendships
            .map((f) => (f.smoker_id === smokerId ? f.friend_id : f.smoker_id))
            .filter((id) => id && id !== smokerId)
        )
      )
    }
  } catch (err) {
    console.warn('Error fetching friendships for milestone dispatch:', err)
  }

  const dispatchedWeeks: number[] = []

  // 5. For each unnotified week, insert DB rows and send push notification
  for (const week of weeksToDispatch) {
    const copy = getMilestoneCopy(smokerName, week)

    // Insert in database for all friends
    if (friendIds.length > 0) {
      try {
        const rows = friendIds.map((fId) => ({
          smoker_id: smokerId,
          friend_id: fId,
          weeks: week,
          streak_start: streakStart,
          title: copy.title,
          message: copy.message,
        }))

        await supabase.from('milestone_notifications').insert(rows)
      } catch (err) {
        console.warn(`Error inserting milestone_notifications for week ${week}:`, err)
      }

      // Dispatch Web Push to friends
      await dispatchPushMilestoneToFriends(smokerId, smokerName, week)
    }

    dispatchedWeeks.push(week)
    dbNotifiedWeeks.add(week)
  }

  // 6. Update local storage cache
  if (typeof window !== 'undefined' && dispatchedWeeks.length > 0) {
    try {
      const updatedCache = Array.from(dbNotifiedWeeks)
      localStorage.setItem(localCacheKey, JSON.stringify(updatedCache))
    } catch {}
  }

  return { newlyDispatched: dispatchedWeeks, totalWeeks: currentWeeks }
}
