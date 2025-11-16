import { NextResponse } from 'next/server'

export async function GET() {
  try {
    // TODO: 실제로는 Supabase나 CMS에서 후보군을 가져옴
    // 현재는 프론트엔드에서 로컬 JSON을 사용하므로 빈 배열 반환
    // 필요시 Supabase 테이블에서 후보군을 가져오도록 구현
    
    return NextResponse.json([])
  } catch (error) {
    console.error('후보군 조회 중 오류:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : '알 수 없는 오류' },
      { status: 500 },
    )
  }
}

