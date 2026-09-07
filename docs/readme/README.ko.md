<div align="center">

# QGraphFlow

### 복잡한 코드를 탐색할 수 있는 다이어그램으로.

경로를 따라가고, 근거를 확인하고, 오프라인 파일 하나로 공유하세요.

[English](../../README.md) · [中文](../../docs/readme/README.zh-CN.md) · [日本語](../../docs/readme/README.ja.md) · [한국어](../../docs/readme/README.ko.md) · [Deutsch](../../docs/readme/README.de.md) · [Français](../../docs/readme/README.fr.md) · [Español](../../docs/readme/README.es.md)

[클라이언트 설치](../../docs/clients.md) · [문제 보고](https://github.com/supermax92/qgraphflow/issues) · [MIT](../../LICENSE)

</div>

![Apache Kafka 소스를 바탕으로 녹화한 실제 QGraphFlow 조작 화면입니다. 아키텍처](https://github.com/supermax92/qgraphflow/releases/download/showcase-v1/kafka.ko.architecture.gif)

*Apache Kafka 소스를 바탕으로 녹화한 실제 QGraphFlow 조작 화면입니다.*

QGraphFlow는 소스 코드, 스키마, 설정, 요구사항을 인터랙티브 소프트웨어 다이어그램으로 만듭니다. 근거를 확인하고 오프라인 HTML 파일로 공유할 수 있습니다.

- **탐색:** 작성된 경로를 재생하고 노드를 검색해 역할을 살펴보세요.
- **검증:** 소스 파일, 줄 번호, 심벌과 불확실한 부분을 명시합니다.
- **공유:** 오프라인 HTML을 열거나 전체 다이어그램을 SVG / PNG로 내보내세요.

README 애니메이션은 문서를 볼 때만 다운로드됩니다. Git 복제와 플러그인 패키지에는 GIF가 포함되지 않습니다. 경량 패키지에는 주문 흐름 예제와 영어 Kafka 도표 모음이 포함되며, 7개 언어의 도표 모음은 Git 저장소에서 이용할 수 있습니다.

## Kafka의 아홉 가지 다이어그램 체험하기

Node.js 22를 준비하고 저장소를 복제한 뒤 실행하세요.

```bash
git clone https://github.com/supermax92/qgraphflow.git
cd qgraphflow
node skills/q-flow/scripts/validate-graph.mjs examples/showcase/kafka.ko.graph.json
node skills/q-flow/scripts/generate-viewer.mjs examples/showcase/kafka.ko.graph.json output/kafka
```

브라우저에서 `output/kafka/index.html`을 열고 도구 패널에서 다이어그램을 선택하세요. 같은 폴더의 `graph.json`에 편집 가능한 모델이 저장됩니다. 입력 JSON을 수정한 후 새 출력 폴더에 생성하면 이전 결과를 보존할 수 있습니다.

포함된 Viewer로 생성할 때는 의존성 설치, API 키, 백엔드 서비스가 필요하지 않습니다. AI로 근거를 조사하고 다이어그램을 작성할 때는 선택한 클라이언트의 모델 서비스를 사용합니다.

## 하나의 코드베이스를 이해하는 아홉 가지 방법.

위 아키텍처는 프로듀서부터 리더 로그까지의 경로를 보여줍니다. 아래 항목을 펼쳐 다른 관점도 확인하세요. 각 GIF의 화면과 설명은 이 README의 언어와 일치합니다.

**01 · 아키텍처** — 소스 코드에 근거한 Leader 로그 추가 경로입니다. 네트워크 내부, 복제, 확인 응답은 이 그림에서 다루지 않습니다.

<details>
<summary><strong>02 · 순서도</strong> · Kafka: send()는 언제 Sender를 깨울까?</summary>

![Apache Kafka 소스를 바탕으로 녹화한 실제 QGraphFlow 조작 화면입니다. 순서도](https://github.com/supermax92/qgraphflow/releases/download/showcase-v1/kafka.ko.flowchart.gif)

RecordAccumulator.append() 이후의 분기입니다. 앞선 검증과 예외 경로는 생략했습니다. Future 반환은 Broker의 확인 응답을 의미하지 않습니다.

</details>

<details>
<summary><strong>03 · 시퀀스 다이어그램</strong> · Kafka: acks=1인 프로듀스 요청</summary>

![Apache Kafka 소스를 바탕으로 녹화한 실제 QGraphFlow 조작 화면입니다. 시퀀스 다이어그램](https://github.com/supermax92/qgraphflow/releases/download/showcase-v1/kafka.ko.sequence.gif)

성공하는 비트랜잭션 프로듀스 요청입니다. KafkaApis는 Broker 요청 경계를 나타내며 네트워크와 파티션 내부는 참여자에 포함했습니다. acks=1은 Follower의 확인 응답을 요구하지 않습니다.

</details>

<details>
<summary><strong>04 · ER 다이어그램</strong> · Kafka: ProduceRequest v13의 내부 구조</summary>

![Apache Kafka 소스를 바탕으로 녹화한 실제 QGraphFlow 조작 화면입니다. ER 다이어그램](https://github.com/supermax92/qgraphflow/releases/download/showcase-v1/kafka.ko.er.gif)

SQL 테이블이 아닌 프로토콜 포함 관계입니다. 배열은 0개 이상을 포함하는 구조 관계로 표시하며 데이터베이스 기본 키나 외래 키를 뜻하지 않습니다. 버전 13은 TopicId로 토픽을 식별합니다.

</details>

<details>
<summary><strong>05 · 배포 다이어그램</strong> · Kafka: 분리된 KRaft 역할</summary>

![Apache Kafka 소스를 바탕으로 녹화한 실제 QGraphFlow 조작 화면입니다. 배포 다이어그램](https://github.com/supermax92/qgraphflow/releases/download/showcase-v1/kafka.ko.deployment.gif)

저장소의 Docker Compose 평문 통신 예제입니다. Broker 3개와 별도 Controller 컨테이너 3개가 있습니다. Controller 쿼럼은 하나의 시각적 노드로 묶었습니다. 개발용 설정이며 운영 배포 권장 구성이 아닙니다.

</details>

<details>
<summary><strong>06 · 클래스 다이어그램</strong> · Kafka: 프로듀서 API와 구현 클래스</summary>

![Apache Kafka 소스를 바탕으로 녹화한 실제 QGraphFlow 조작 화면입니다. 클래스 다이어그램](https://github.com/supermax92/qgraphflow/releases/download/showcase-v1/kafka.ko.class.gif)

일부 Java 타입과 멤버를 표시합니다. KafkaProducer와 MockProducer는 모두 Producer<K,V>를 구현하고 ProducerRecord가 입력을 담습니다. 시그니처는 축약했으며 소유 관계는 추론하지 않습니다.

</details>

<details>
<summary><strong>07 · 상태 다이어그램</strong> · Kafka: 컨슈머가 그룹에 참여하는 과정</summary>

![Apache Kafka 소스를 바탕으로 녹화한 실제 QGraphFlow 조작 화면입니다. 상태 다이어그램](https://github.com/supermax92/qgraphflow/releases/download/showcase-v1/kafka.ko.state.gif)

MemberState의 정상 할당 과정입니다. 오류, 펜싱, 탈퇴 상태는 생략했습니다. Broker가 새 할당을 보내면 조정 과정이 반복될 수 있습니다.

</details>

<details>
<summary><strong>08 · 유스케이스 다이어그램</strong> · Kafka: 클라이언트별 기능</summary>

![Apache Kafka 소스를 바탕으로 녹화한 실제 QGraphFlow 조작 화면입니다. 유스케이스 다이어그램](https://github.com/supermax92/qgraphflow/releases/download/showcase-v1/kafka.ko.usecase.gif)

클라이언트 역할을 공개 Java API에 연결합니다. 행위자 관계는 기능을 나타내며 실행 순서가 아닙니다. 오프셋 커밋과 관리 작업은 애플리케이션이 명시적으로 선택합니다.

</details>

<details>
<summary><strong>09 · 데이터 흐름도</strong> · Kafka: 애플리케이션 값에서 컨슈머 레코드까지</summary>

![Apache Kafka 소스를 바탕으로 녹화한 실제 QGraphFlow 조작 화면입니다. 데이터 흐름도](https://github.com/supermax92/qgraphflow/releases/download/showcase-v1/kafka.ko.dataflow.gif)

직렬화, 파티션 저장, 역직렬화를 거치는 데이터 경로입니다. 배치 처리, Produce/Fetch 네트워크와 복제는 간략히 표시했습니다. 오프셋 커밋이나 처리 보장은 다루지 않습니다.

</details>

## 내 프로젝트의 다이어그램 만들기

설치 안내에 따라 플러그인을 설치하세요. Codex에서는 `$q-flow`, Claude Code에서는 `/qgraphflow:q-flow`를 사용합니다. Qoder와 Cursor에서는 클라이언트가 제공하는 스킬 선택 기능을 사용하세요. 안내 문서에 설치 절차와 네이티브 클라이언트 검증 상태가 정리되어 있습니다.

> 이 모듈의 진입점, 핵심 구성 요소와 관계를 분석하고 한국어 인터랙티브 아키텍처 다이어그램을 만들어 주세요. 소스 파일과 줄 번호 근거를 남기고 확인할 수 없는 관계는 표시해 주세요.

CodeGraph는 선택 사항입니다. 설정하지 않으면 스킬이 소스를 직접 읽습니다. 기본 출력 위치는 대상 프로젝트의 `docs/qgraphflow/<scope>-<diagram-type>/`이며 다른 폴더도 지정할 수 있습니다.

## 확인 가능한 코드에 근거한 예제

아홉 예제는 모두 Apache Kafka 커밋 `634a935e7291`을 사용합니다(체크아웃에 선언된 버전은 `4.4.0`). 주요 근거 위치:

| 다이어그램 | 소스 근거 |
| --- | --- |
| 아키텍처 | [`ReplicaManager.appendToLocalLog` · L1376](https://github.com/apache/kafka/blob/634a935e729197848ffd958c06458215f96f103e/core/src/main/scala/kafka/server/ReplicaManager.scala#L1376) |
| 순서도 | [`KafkaProducer.doSend` · L1241](https://github.com/apache/kafka/blob/634a935e729197848ffd958c06458215f96f103e/clients/src/main/java/org/apache/kafka/clients/producer/KafkaProducer.java#L1241) |
| 시퀀스 다이어그램 | [`KafkaApis.handleProduceRequest` · L457](https://github.com/apache/kafka/blob/634a935e729197848ffd958c06458215f96f103e/core/src/main/scala/kafka/server/KafkaApis.scala#L457) |
| ER 다이어그램 | [`ProduceRequest` · L50](https://github.com/apache/kafka/blob/634a935e729197848ffd958c06458215f96f103e/clients/src/main/resources/common/message/ProduceRequest.json#L50) |
| 배포 다이어그램 | [`controller-1 / controller-2 / controller-3` · L18](https://github.com/apache/kafka/blob/634a935e729197848ffd958c06458215f96f103e/docker/examples/docker-compose-files/cluster/isolated/plaintext/docker-compose.yml#L18) |
| 클래스 다이어그램 | [`Producer` · L97](https://github.com/apache/kafka/blob/634a935e729197848ffd958c06458215f96f103e/clients/src/main/java/org/apache/kafka/clients/producer/Producer.java#L97) |
| 상태 다이어그램 | [`STABLE` · L67](https://github.com/apache/kafka/blob/634a935e729197848ffd958c06458215f96f103e/clients/src/main/java/org/apache/kafka/clients/consumer/internals/MemberState.java#L67) |
| 유스케이스 다이어그램 | [`Producer.send` · L97](https://github.com/apache/kafka/blob/634a935e729197848ffd958c06458215f96f103e/clients/src/main/java/org/apache/kafka/clients/producer/Producer.java#L97) |
| 데이터 흐름도 | [`KafkaProducer.doSend` · L1197](https://github.com/apache/kafka/blob/634a935e729197848ffd958c06458215f96f103e/clients/src/main/java/org/apache/kafka/clients/producer/KafkaProducer.java#L1197) |

## 예제를 읽을 때 알아둘 점

- 재생은 작성된 경로나 노드의 읽기 순서를 보여주며 실제 실행 추적을 수집하지 않습니다. 리더 로그 추가, 프로듀서 확인 응답, 컨슈머 처리 완료는 서로 다른 사건입니다.
- 정확성은 근거에 달려 있습니다. 핵심 관계는 검토해야 합니다. 소스, 스키마, 설정, 관례와 추론을 구분합니다.
- 화면에서 바꾼 배치는 SVG / PNG에 반영되지만 `graph.json`에는 자동 저장되지 않습니다.
- 모든 언어는 같은 소스 근거와 그래프 구조를 사용합니다. 코드 식별자, API 이름, 스키마 필드와 표준 표기법은 원문을 유지합니다.

## 개발 및 기여

```bash
npm ci --prefix skills/q-flow/assets/viewer
npm run build --prefix skills/q-flow/assets/viewer
node --test tests/*.test.mjs skills/q-flow/scripts/*.test.mjs
```

개발에는 Node.js 22, npm, tar, zip, unzip이 필요합니다. 문제를 보고할 때 민감 정보를 제거한 최소 그래프, 클라이언트와 브라우저 버전, 재현 절차를 포함해 주세요.

[그래프 데이터 형식](../../skills/q-flow/references/graph-schema.md) · [브라우저 검증 안내](../../skills/q-flow/references/viewer-development.md)

## 라이선스 및 출처

[MIT](../../LICENSE) · [제삼자 고지](../../THIRD_PARTY_NOTICES.md)

QGraphFlow는 MIT 라이선스의 독립 프로젝트입니다. Apache Kafka는 데모의 분석 대상입니다. 언급된 제품명은 각 권리자에게 속하며 제휴, 후원, 보증 관계를 뜻하지 않습니다.
