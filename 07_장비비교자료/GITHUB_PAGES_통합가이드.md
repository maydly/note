# GitHub Pages note 통합 가이드

대상 사이트: `https://bucket0825.github.io/note/`

## 통합 방향

현재 `note` 사이트는 Design, Development, AI, Workflow 섹션을 가진 개인 학습 아카이브 구조다. 장비 비교자료는 촬영/조명/렌즈 공부 자료이므로 1차 통합 위치는 Design 섹션의 장비 공부 카드가 적합하다.

## 배포할 폴더

아래 폴더를 `note` 저장소에 그대로 복사하는 것을 기준으로 한다.

```text
07_장비비교자료/
```

복사 후 예상 공개 URL은 아래와 같다.

```text
https://bucket0825.github.io/note/07_장비비교자료/
```

## note 메인에서 연결할 파일

메인 카드의 링크는 아래 파일을 우선 연결한다.

```text
07_장비비교자료/index.html
```

또는 GitHub Pages 공개 경로에서는 아래처럼 연결한다.

```text
/note/07_장비비교자료/
```

## 유지할 규칙

- HTML 내부 링크는 같은 폴더 기준 상대경로를 유지한다.
- 로컬 이미지 assets는 `07_장비비교자료/assets/` 안에 둔다.
- 현재 조명 이미지는 `07_장비비교자료/assets/lighting/`에 있다.
- 새 자료를 추가할 때는 카메라, 렌즈, 필터, 조명, 악세사리 중 하나의 최신 파일에만 넣는다.
- 최신 파일을 수정하면 `VERSION_MANIFEST.json`과 `CHANGELOG.md`도 같이 갱신한다.
