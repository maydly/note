# Maydly Study Archive

공부한 내용을 보기 좋은 HTML 파일로 정리해서 GitHub Pages에 모으는 개인 학습 아카이브입니다.

## 구조

- `index.html`: 전체 공부 노트 목록
- `styles.css`: 공통 디자인 스타일
- `03_AI에이전트운영체계/`: 작업장 AI 에이전트 운영 체계 교육용 페이지
- `07_장비비교자료/`: 카메라, 렌즈, 필터, 조명, 악세사리, 촬영지원장비, 포토프린터 비교자료
- `studies/collage-design.html`: 예시 공부 노트
- `studies/template.html`: 새 노트를 만들 때 복사해서 쓰는 템플릿

## 새 노트 추가 방법

1. `studies/template.html`을 복사해서 `studies/새-파일명.html`로 저장합니다.
2. 제목, 커버 문구, 챕터 내용을 수정합니다.
3. `index.html`의 알맞은 섹션에 새 카드와 링크를 추가합니다.

## GitHub Pages 배포

1. GitHub에 새 저장소를 만듭니다.
2. 이 폴더를 커밋하고 GitHub에 푸시합니다.
3. 저장소의 `Settings > Pages`에서 `Deploy from a branch`를 선택합니다.
4. Branch는 `main`, folder는 `/root`로 설정합니다.

설정 후 보통 `https://사용자명.github.io/저장소명/` 주소로 접속할 수 있습니다.

현재 공개 기준 주소는 아래와 같습니다.

- 메인: `https://bucket0825.github.io/note/`
- AI 에이전트 운영 체계: `https://bucket0825.github.io/note/03_AI에이전트운영체계/`
- 장비 비교자료: `https://bucket0825.github.io/note/07_장비비교자료/`
