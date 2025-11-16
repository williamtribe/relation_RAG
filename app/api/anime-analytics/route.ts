import { NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { supabaseAdmin } from '@/lib/db'

export async function POST(req: Request) {
  try {
    const kakaoUser = await getSession()
    const body = await req.json()

    const {
      type,
      questionId,
      answer,
      responseMs,
      swipeDirection,
      dropPosition,
      sessionId,
      timestamp,
      metadata,
    } = body

    if (!type || !sessionId) {
      return NextResponse.json(
        { error: 'type과 sessionId가 필요합니다.' },
        { status: 400 },
      )
    }

    // 애널리틱스 이벤트 저장
    const eventData = {
      event_type: type,
      session_id: sessionId,
      user_id: kakaoUser?.id || null,
      kakao_id: kakaoUser?.id || null,
      question_id: questionId || null,
      answer: answer || null,
      response_ms: responseMs || null,
      swipe_direction: swipeDirection || null,
      drop_position_x: dropPosition?.x || null,
      drop_position_y: dropPosition?.y || null,
      timestamp: timestamp ? new Date(timestamp).toISOString() : new Date().toISOString(),
      metadata: metadata || {},
      created_at: new Date().toISOString(),
    }

    const { data, error } = await supabaseAdmin
      .from('anime_analytics')
      .insert(eventData)
      .select()
      .single()

    if (error) {
      console.error('애널리틱스 저장 실패:', error)
      // 애널리틱스는 실패해도 게임 플레이에 영향 없도록 200 반환
      return NextResponse.json({ success: false, error: error.message }, { status: 200 })
    }

    return NextResponse.json({ data, success: true })
  } catch (error) {
    console.error('애널리틱스 저장 중 오류:', error)
    // 애널리틱스는 실패해도 게임 플레이에 영향 없도록 200 반환
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : '알 수 없는 오류' },
      { status: 200 },
    )
  }
}

export async function GET(req: Request) {
  try {
    const kakaoUser = await getSession()
    const { searchParams } = new URL(req.url)
    const sessionId = searchParams.get('sessionId')
    const eventType = searchParams.get('type')

    let query = supabaseAdmin.from('anime_analytics').select('*')

    if (sessionId) {
      query = query.eq('session_id', sessionId)
    }

    if (eventType) {
      query = query.eq('event_type', eventType)
    }

    if (kakaoUser?.id) {
      query = query.eq('user_id', kakaoUser.id)
    }

    query = query.order('created_at', { ascending: false }).limit(1000)

    const { data, error } = await query

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ data })
  } catch (error) {
    console.error('애널리틱스 조회 중 오류:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : '알 수 없는 오류' },
      { status: 500 },
    )
  }
}

