import { NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { supabaseAdmin } from '@/lib/db'

export async function POST(req: Request) {
  try {
    const kakaoUser = await getSession()
    const body = await req.json()

    const { sessionId, userId, responses, startedAt, completedAt, topCandidate } = body

    if (!sessionId || !responses || !Array.isArray(responses)) {
      return NextResponse.json(
        { error: 'sessionId와 responses 배열이 필요합니다.' },
        { status: 400 },
      )
    }

    // 세션 데이터 저장
    const sessionData = {
      session_id: sessionId,
      user_id: userId || kakaoUser?.id || null,
      kakao_id: kakaoUser?.id || null,
      responses: responses,
      started_at: new Date(startedAt).toISOString(),
      completed_at: completedAt ? new Date(completedAt).toISOString() : null,
      top_candidate_id: topCandidate?.id || null,
      top_candidate_title: topCandidate?.title || null,
      top_candidate_score: topCandidate?.score || null,
      created_at: new Date().toISOString(),
    }

    const { data, error } = await supabaseAdmin
      .from('anime_sessions')
      .insert(sessionData)
      .select()
      .single()

    if (error) {
      console.error('Supabase 저장 실패:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ data, success: true })
  } catch (error) {
    console.error('세션 저장 중 오류:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : '알 수 없는 오류' },
      { status: 500 },
    )
  }
}

export async function GET(req: Request) {
  try {
    const kakaoUser = await getSession()
    const { searchParams } = new URL(req.url)
    const sessionId = searchParams.get('sessionId')

    if (sessionId) {
      // 특정 세션 조회
      const { data, error } = await supabaseAdmin
        .from('anime_sessions')
        .select('*')
        .eq('session_id', sessionId)
        .single()

      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 })
      }

      return NextResponse.json({ data })
    }

    // 사용자 세션 목록 조회
    if (!kakaoUser?.id) {
      return NextResponse.json({ data: [] })
    }

    const { data, error } = await supabaseAdmin
      .from('anime_sessions')
      .select('*')
      .eq('user_id', kakaoUser.id)
      .order('created_at', { ascending: false })
      .limit(50)

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ data })
  } catch (error) {
    console.error('세션 조회 중 오류:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : '알 수 없는 오류' },
      { status: 500 },
    )
  }
}

