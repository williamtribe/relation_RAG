# 카카오 로그인 설정 가이드

## KAKAO_CLIENT_ID 찾는 방법

**KAKAO_CLIENT_ID**는 카카오 개발자 콘솔에서 **REST API 키**를 의미합니다.

### 단계별 안내:

1. **카카오 개발자 콘솔 접속**
   - https://developers.kakao.com 접속
   - 카카오 계정으로 로그인

2. **내 애플리케이션 선택**
   - 로그인 후 "내 애플리케이션" 메뉴 클릭
   - 사용할 앱 선택 (없으면 새로 생성)

3. **REST API 키 확인**
   - 앱 선택 후 **"앱 키"** 섹션으로 이동
   - **"REST API 키"** 값을 복사
   - 이 값이 바로 `KAKAO_CLIENT_ID`입니다

### 예시:
```
REST API 키: abc123def456ghi789jkl012mno345pqr
```

`.env` 파일에 다음과 같이 입력:
```
KAKAO_CLIENT_ID=abc123def456ghi789jkl012mno345pqr
```

## 추가 설정 확인 사항

### 1. 카카오 로그인 사용 설정
- [카카오 로그인] > [사용 설정] > [상태]를 **ON**으로 설정

### 2. 리다이렉트 URI 등록 (필수)
- [카카오 로그인] > [일반] > [리다이렉트 URI]에서 등록
- 예시:
  - 개발 환경: `http://localhost:3000/api/auth/kakao/callback`
  - 프로덕션: `https://yourdomain.com/api/auth/kakao/callback`

### 3. Client Secret 발급 (선택사항, 보안 강화 권장)
- [카카오 로그인] > [일반] > [Client Secret]에서 발급
- 발급 후 `.env`의 `KAKAO_CLIENT_SECRET`에 입력

### 4. 동의항목 설정
- 필요한 사용자 정보에 대한 동의항목 설정
- 예: 닉네임, 프로필 이미지, 이메일 등

## 참고
- REST API 키는 공개되어도 상대적으로 안전하지만, Client Secret은 절대 공개하지 마세요
- 리다이렉트 URI는 정확히 일치해야 하므로 오타에 주의하세요

